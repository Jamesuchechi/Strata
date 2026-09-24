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

    # Check dataset access if other users' views are referenced in raw SQL
    if req.sql:
        for ds in _datasets_db.values():
            v_name = ds.get("view_name")
            d_id = ds.get("id")
            if (v_name and v_name in req.sql) or (d_id and f"view_{d_id}" in req.sql):
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
        analyst = ConversationalAnalyst(executor)
        # Mock schema inspection for query coordinator
        res = await analyst.analyze(
            view_name=req.view_name,
            question=req.natural_language_question,
            schema=[{"name": "*"}],
            column_summaries=[],
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
