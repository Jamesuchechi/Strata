"""Query and AI analysis execution router."""

from fastapi import APIRouter, HTTPException
from strata_api.core.duckdb_engine import get_duckdb_engine
from strata_api.ai.executor import QueryExecutor
from strata_api.ai.analyst import ConversationalAnalyst
from strata_api.schemas.query import QueryRequest, QueryResponse

router = APIRouter(prefix="/query", tags=["Query"])


@router.post("", response_model=QueryResponse)
async def execute_query(req: QueryRequest):
    """Execute raw DuckDB SQL or conversational natural language questions."""
    engine = get_duckdb_engine()
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
