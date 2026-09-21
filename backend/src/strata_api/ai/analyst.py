"""Conversational AI analyst coordinator."""

from typing import Any, Dict, List
from strata_api.ai.executor import QueryExecutor


class ConversationalAnalyst:
    """Coordinates natural language queries to SQL execution and verified summaries."""

    def __init__(self, executor: QueryExecutor):
        self.executor = executor

    async def analyze(
        self,
        view_name: str,
        question: str,
        schema: List[Dict[str, Any]],
        column_summaries: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Convert question to DuckDB SQL, execute, and verify answer."""
        # Baseline deterministic query mapper or LLM call placeholder
        # For Phase 0 stub: simple pattern matching or fallback
        col_names = [c["name"] for c in schema]
        sample_col = col_names[0] if col_names else "*"
        generated_sql = f"SELECT {sample_col}, COUNT(*) as count FROM {view_name} GROUP BY {sample_col} ORDER BY count DESC LIMIT 10;"

        execution_result = self.executor.execute_sql(generated_sql)

        return {
            "question": question,
            "sql": generated_sql,
            "explanation": f"Calculated top frequency distribution for column '{sample_col}'.",
            "results": execution_result,
        }
