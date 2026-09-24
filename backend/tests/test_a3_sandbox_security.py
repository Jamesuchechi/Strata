"""Acceptance tests for A3: Sandbox security, AST validation, and eliminating code execution vulnerabilities."""

import pytest
from httpx import AsyncClient, ASGITransport
import polars as pl
from strata_api.main import app
from strata_api.core.sandbox import _is_ast_safe, validate_safe_code, run_sandboxed_code
from tests.conftest import AUTH_HEADERS_A


def test_ast_safe_unit_checks():
    """Unit tests for _is_ast_safe blocking malicious code patterns."""
    # 1. import os; os.system('whoami')
    is_safe1, err1 = _is_ast_safe("import os; os.system('whoami')")
    assert not is_safe1
    assert "os" in err1

    # 2. ().__class__.__base__.__subclasses__()
    is_safe2, err2 = _is_ast_safe("().__class__.__base__.__subclasses__()")
    assert not is_safe2
    assert "__class__" in err2 or "__subclasses__" in err2 or "private" in err2

    # 3. open('/etc/passwd')
    is_safe3, err3 = _is_ast_safe("open('/etc/passwd')")
    assert not is_safe3
    assert "open" in err3

    # Additional dangerous vectors
    assert not _is_ast_safe("import subprocess")[0]
    assert not _is_ast_safe("eval('1+1')")[0]
    assert not _is_ast_safe("exec('x = 1')")[0]
    assert not _is_ast_safe("breakpoint()")[0]
    assert not _is_ast_safe("__import__('os')")[0]
    assert not _is_ast_safe("x._secret_attr")[0]

    # Safe operations should pass
    assert _is_ast_safe("df = df.filter(pl.col('amount') > 0)")[0]
    assert _is_ast_safe("x = [1, 2, 3]; y = sum(x)")[0]


def test_run_sandboxed_code_execution():
    """Verify safe sandboxed execution of allowed transformations."""
    df = pl.DataFrame({"a": [1, 2, 3], "b": [10, 20, 30]})
    safe_code = "df = df.with_columns((pl.col('a') * 3).alias('tripled_a'))"
    res_df = run_sandboxed_code(safe_code, df)
    assert "tripled_a" in res_df.columns
    assert res_df["tripled_a"].to_list() == [3, 6, 9]

    # Attempting to run unsafe code through runner must fail closed
    with pytest.raises(ValueError, match="Unsafe code detected"):
        run_sandboxed_code("import os; os.system('whoami')", df)


@pytest.mark.asyncio
async def test_transform_endpoint_blocks_code_execution():
    """Acceptance test: Submitting dangerous code via transform endpoint is blocked with HTTP 400."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=AUTH_HEADERS_A) as client:
        # Upload a dataset to transform
        csv_data = b"id,val\n1,10\n2,20\n"
        upload_res = await client.post("/api/preview", files={"file": ("test_trans_sec.csv", csv_data, "text/csv")})
        assert upload_res.status_code == 200
        ds_id = upload_res.json()["existing_dataset_id"] or upload_res.json()["view_name"].replace("view_", "")

        # 1. import os; os.system('whoami')
        res1 = await client.post(
            f"/api/datasets/{ds_id}/transform",
            json={
                "operations": [
                    {
                        "op": "custom_code",
                        "code": "import os; os.system('whoami')",
                    }
                ]
            },
        )
        assert res1.status_code == 400
        assert "unsafe code" in res1.json()["detail"].lower() or "os" in res1.json()["detail"].lower()

        # 2. ().__class__.__base__.__subclasses__()
        res2 = await client.post(
            f"/api/datasets/{ds_id}/transform",
            json={
                "operations": [
                    {
                        "op": "custom_code",
                        "code": "().__class__.__base__.__subclasses__()",
                    }
                ]
            },
        )
        assert res2.status_code == 400
        assert "unsafe code" in res2.json()["detail"].lower()

        # 3. open('/etc/passwd')
        res3 = await client.post(
            f"/api/datasets/{ds_id}/transform",
            json={
                "operations": [
                    {
                        "op": "custom_code",
                        "code": "open('/etc/passwd')",
                    }
                ]
            },
        )
        assert res3.status_code == 400
        assert "unsafe code" in res3.json()["detail"].lower() or "open" in res3.json()["detail"].lower()


@pytest.mark.asyncio
async def test_pipelines_endpoint_blocks_code_execution():
    """Acceptance test: Submitting dangerous code via pipeline steps is blocked with HTTP 400."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=AUTH_HEADERS_A) as client:
        # Upload a dataset
        csv_data = b"id,val\n1,10\n2,20\n"
        upload_res = await client.post("/api/preview", files={"file": ("test_pipe_sec.csv", csv_data, "text/csv")})
        assert upload_res.status_code == 200
        ds_id = upload_res.json()["existing_dataset_id"] or upload_res.json()["view_name"].replace("view_", "")

        # 1. Pipeline creation with import os
        res1 = await client.post(
            "/api/pipelines",
            json={
                "name": "Malicious Pipeline 1",
                "target_dataset_id": ds_id,
                "steps": [
                    {
                        "step_id": "s1",
                        "name": "Exploit Step",
                        "type": "custom",
                        "code": "import os; os.system('whoami')",
                    }
                ],
            },
        )
        assert res1.status_code == 400
        assert "unsafe code" in res1.json()["detail"].lower()

        # 2. Pipeline dry-run with __subclasses__
        res2 = await client.post(
            "/api/pipelines/dry-run",
            json={
                "dataset_id": ds_id,
                "steps": [
                    {
                        "step_id": "s2",
                        "name": "Exploit Step 2",
                        "type": "custom",
                        "code": "().__class__.__base__.__subclasses__()",
                    }
                ],
            },
        )
        assert res2.status_code == 400
        assert "unsafe code" in res2.json()["detail"].lower()

        # 3. Pipeline dry-run with open('/etc/passwd')
        res3 = await client.post(
            "/api/pipelines/dry-run",
            json={
                "dataset_id": ds_id,
                "steps": [
                    {
                        "step_id": "s3",
                        "name": "Exploit Step 3",
                        "type": "custom",
                        "code": "open('/etc/passwd')",
                    }
                ],
            },
        )
        assert res3.status_code == 400
        assert "unsafe code" in res3.json()["detail"].lower()


@pytest.mark.asyncio
async def test_legitimate_pipeline_custom_step_executes_safely():
    """Verify that a legitimate custom Python transformation step in a pipeline succeeds."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=AUTH_HEADERS_A) as client:
        csv_data = b"id,val\n1,10\n2,20\n3,30\n"
        upload_res = await client.post("/api/preview", files={"file": ("test_pipe_safe.csv", csv_data, "text/csv")})
        assert upload_res.status_code == 200
        ds_id = upload_res.json()["existing_dataset_id"] or upload_res.json()["view_name"].replace("view_", "")

        # Run dry run with safe custom step
        dry_res = await client.post(
            "/api/pipelines/dry-run",
            json={
                "dataset_id": ds_id,
                "steps": [
                    {
                        "step_id": "s_safe",
                        "name": "Safe Polars Step",
                        "type": "custom",
                        "code": "df = df.with_columns((pl.col('val') * 2).alias('val_double'))",
                    }
                ],
            },
        )
        assert dry_res.status_code == 200
        dry_data = dry_res.json()
        assert dry_data["status"] == "success"
        assert "val_double" in dry_data["dry_run"]["columns_list"]
