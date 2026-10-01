import re
from fastapi import APIRouter, Depends, HTTPException, Request
from strata_api.core.duckdb_engine import get_duckdb_engine, validate_sql
from strata_api.core.rate_limiter import check_query_rate_limit
from strata_api.ai.executor import QueryExecutor
from strata_api.ai.analyst import ConversationalAnalyst
from strata_api.models.user import UserModel
from strata_api.routers.auth import get_current_user
from strata_api.routers.datasets import _datasets_db, check_dataset_access, find_dataset_by_name_or_id
from strata_api.schemas.query import QueryRequest, QueryResponse

router = APIRouter(prefix="/query", tags=["Query"])

TABLE_REF_PATTERN = re.compile(r"\b(?:FROM|JOIN)\s+([a-zA-Z0-9_\"`]+)", re.IGNORECASE)


def _extract_referenced_tables(sql: str) -> set[str]:
    """Extract table/view identifiers from FROM and JOIN clauses."""
    tables = set()
    for match in TABLE_REF_PATTERN.finditer(sql):
        raw = match.group(1).strip('"` ')
        if raw:
            tables.add(raw)
    return tables


@router.post("", response_model=QueryResponse)
async def execute_query(
    req: QueryRequest,
    request: Request,
    current_user: UserModel = Depends(get_current_user),
):
    """Execute raw DuckDB SQL or conversational natural language questions."""
    await check_query_rate_limit(request, current_user)

    engine = get_duckdb_engine()

    # Validate raw SQL if provided
    if req.sql:
        try:
            validate_sql(req.sql, engine.conn)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    # Check dataset access if view_name is provided
    if req.view_name:
        ds = find_dataset_by_name_or_id(req.view_name)
        if ds:
            check_dataset_access(ds, current_user.id)

    # Check dataset access for any referenced tables or views in raw SQL
    if req.sql:
        referenced_tables = _extract_referenced_tables(req.sql)
        for tbl in referenced_tables:
            ds = find_dataset_by_name_or_id(tbl)
            if ds:
                check_dataset_access(ds, current_user.id)

        # Cross-reference against registered views
        for ds in _datasets_db.values():
            v_name = ds.get("view_name")
            d_id = ds.get("id")
            if (v_name and (v_name in referenced_tables or v_name in req.sql)) or (
                d_id and (f"view_{d_id}" in referenced_tables or f"view_{d_id}" in req.sql)
            ):
                check_dataset_access(ds, current_user.id)

    executor = QueryExecutor(engine)

    if req.sql:
        result = executor.execute_sql(req.sql, limit=req.limit)
        return QueryResponse(
            success=result["success"],
            executed_sql=result.get("executed_sql"),
            row_count=result.get("row_count", 0),
            columns=result.get("columns", []),
            data=result.get("data", []),
            error=result.get("error"),
        )
    elif req.natural_language_question:
        if not req.view_name:
            raise HTTPException(status_code=400, detail="'view_name' is required when asking natural language questions.")
        
        target_view = req.view_name
        schema_data = None
        summary_data = []

        ds = find_dataset_by_name_or_id(req.view_name)
        if ds:
            target_view = ds.get("view_name") or req.view_name
            schema_data = ds.get("schema")
            summary_data = ds.get("column_summaries", [])

        analyst = ConversationalAnalyst(executor)
        res = await analyst.analyze(
            view_name=target_view,
            question=req.natural_language_question,
            schema=schema_data,
            column_summaries=summary_data,
            user_id=current_user.id,
            workspace_id=ds.get("workspace_id") if ds else None,
            plan_tier=getattr(current_user, "plan_tier", "free"),
            dataset_version=ds.get("current_version") if ds else None,
        )
        exec_res = res["results"]
        return QueryResponse(
            success=exec_res["success"],
            executed_sql=res.get("sql"),
            row_count=exec_res.get("row_count", 0),
            columns=exec_res.get("columns", []),
            data=exec_res.get("data", []),
            explanation=res.get("explanation"),
            error=exec_res.get("error"),
        )
    else:
        raise HTTPException(status_code=400, detail="Either 'sql' or 'natural_language_question' must be provided.")
