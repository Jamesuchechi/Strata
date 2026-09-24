"""Acceptance tests for A2: DuckDB engine lockdown and SQL security validation."""

import pytest
from httpx import AsyncClient, ASGITransport
import duckdb
from strata_api.main import app
from strata_api.core.duckdb_engine import DuckDBEngine, get_duckdb_engine, validate_sql
from tests.conftest import AUTH_HEADERS_A


@pytest.mark.asyncio
async def test_duckdb_engine_security_configuration():
    """Verify DuckDBEngine initializes with security settings locked and external access disabled."""
    engine = DuckDBEngine()
    
    # 1. Attempting to re-enable external access must fail because configuration is locked
    with pytest.raises(duckdb.InvalidInputException) as exc_info:
        engine.conn.execute("SET enable_external_access = true;")
    assert "configuration has been locked" in str(exc_info.value).lower()

    # 2. Direct engine execution of read_csv attempting file access must fail with permission error
    with pytest.raises(duckdb.PermissionException) as exc_info:
        engine.conn.execute("SELECT * FROM read_csv('/etc/passwd');")
    assert "disabled by configuration" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_validate_sql_unit_checks():
    """Unit tests for validate_sql rejecting dangerous keywords, functions, paths, and statements."""
    engine = get_duckdb_engine()

    # Disallowed file system functions
    with pytest.raises(ValueError, match="read_csv_auto|External filesystem"):
        validate_sql("SELECT * FROM read_csv_auto('/etc/passwd')", engine.conn)

    with pytest.raises(ValueError, match="read_parquet|External filesystem"):
        validate_sql("SELECT * FROM read_parquet('/var/log/syslog')", engine.conn)

    with pytest.raises(ValueError, match="read_json|External filesystem"):
        validate_sql("SELECT * FROM read_json('/root/.bash_history')", engine.conn)

    # Disallowed keywords
    with pytest.raises(ValueError, match="Disallowed SQL keyword: INSTALL"):
        validate_sql("INSTALL httpfs", engine.conn)

    with pytest.raises(ValueError, match="Disallowed SQL keyword: LOAD"):
        validate_sql("LOAD httpfs", engine.conn)

    with pytest.raises(ValueError, match="Disallowed SQL keyword: ATTACH"):
        validate_sql("ATTACH 'database.db'", engine.conn)

    with pytest.raises(ValueError, match="Disallowed SQL keyword: COPY|External filesystem"):
        validate_sql("COPY view_name TO '/tmp/leak.csv'", engine.conn)

    with pytest.raises(ValueError, match="Disallowed SQL keyword: PRAGMA"):
        validate_sql("PRAGMA version", engine.conn)

    with pytest.raises(ValueError, match="Disallowed SQL keyword: SET"):
        validate_sql("SET enable_external_access = true", engine.conn)

    # Disallowed external URLs and paths
    with pytest.raises(ValueError, match="External filesystem access or URL disallowed"):
        validate_sql("SELECT * FROM 'http://malicious.com/data.parquet'", engine.conn)

    with pytest.raises(ValueError, match="External filesystem access or URL disallowed"):
        validate_sql("SELECT * FROM 's3://bucket/key.parquet'", engine.conn)

    with pytest.raises(ValueError, match="External filesystem access or URL disallowed"):
        validate_sql("SELECT * FROM '../../secret.csv'", engine.conn)

    # Multi-statement queries
    with pytest.raises(ValueError, match="Multiple SQL statements are not permitted"):
        validate_sql("SELECT 1; SELECT 2;", engine.conn)

    # DDL/DML rejection
    with pytest.raises(ValueError, match="Statement type StatementType.DROP is not allowed"):
        validate_sql("DROP TABLE some_table", engine.conn)


@pytest.mark.asyncio
async def test_api_query_rejects_read_csv_auto():
    """Acceptance test: POST /api/query attempting read_csv_auto('/etc/passwd') returns 400 Bad Request."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=AUTH_HEADERS_A) as client:
        res = await client.post(
            "/api/query",
            json={
                "sql": "SELECT * FROM read_csv_auto('/etc/passwd')",
            },
        )
        assert res.status_code == 400
        data = res.json()
        assert "disallowed" in data["detail"].lower() or "external" in data["detail"].lower()


@pytest.mark.asyncio
async def test_api_query_rejects_install_httpfs():
    """Acceptance test: POST /api/query attempting INSTALL httpfs returns 400 Bad Request."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=AUTH_HEADERS_A) as client:
        res = await client.post(
            "/api/query",
            json={
                "sql": "INSTALL httpfs;",
            },
        )
        assert res.status_code == 400
        data = res.json()
        assert "disallowed sql keyword: install" in data["detail"].lower()


@pytest.mark.asyncio
async def test_api_query_rejects_attach_and_load_and_pragma():
    """Acceptance test: POST /api/query attempting ATTACH, LOAD, and PRAGMA returns 400 Bad Request."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=AUTH_HEADERS_A) as client:
        # ATTACH
        res1 = await client.post("/api/query", json={"sql": "ATTACH 'some_remote.db';"})
        assert res1.status_code == 400
        assert "attach" in res1.json()["detail"].lower()

        # LOAD
        res2 = await client.post("/api/query", json={"sql": "LOAD httpfs;"})
        assert res2.status_code == 400
        assert "load" in res2.json()["detail"].lower()

        # PRAGMA
        res3 = await client.post("/api/query", json={"sql": "PRAGMA database_list;"})
        assert res3.status_code == 400
        assert "pragma" in res3.json()["detail"].lower()

        # COPY
        res4 = await client.post("/api/query", json={"sql": "COPY my_view TO '/tmp/data.csv';"})
        assert res4.status_code == 400
        assert "copy" in res4.json()["detail"].lower() or "external" in res4.json()["detail"].lower()


@pytest.mark.asyncio
async def test_api_query_legitimate_analytical_queries():
    """Verify that legitimate analytical queries over registered datasets continue to work normally."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=AUTH_HEADERS_A) as client:
        csv_content = b"dept,employee,salary\nEngineering,Ada,120000\nEngineering,Charles,110000\nDesign,Grace,115000\n"
        upload_res = await client.post(
            "/api/preview",
            files={"file": ("dept_salaries.csv", csv_content, "text/csv")},
        )
        assert upload_res.status_code == 200
        view_name = upload_res.json()["view_name"]

        # Run legitimate aggregate query with WHERE, GROUP BY, ORDER BY
        query_sql = f"SELECT dept, COUNT(*) as headcount, AVG(salary) as avg_sal FROM {view_name} GROUP BY dept ORDER BY headcount DESC;"
        res = await client.post(
            "/api/query",
            json={"view_name": view_name, "sql": query_sql},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        assert body["row_count"] == 2
        assert body["data"][0]["dept"] == "Engineering"
        assert body["data"][0]["headcount"] == 2
