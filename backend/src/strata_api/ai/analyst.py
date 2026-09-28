"""Conversational AI analyst with zero-PII prompts, provider integration, and self-correction."""

import json
import logging
import re
from typing import Any, Dict, List, Optional
from strata_api.ai.executor import QueryExecutor
from strata_api.ai.guardrails import llm_cache, quota_manager
from strata_api.ai.prompts import (
    SELF_CORRECTION_PROMPT_TEMPLATE,
    SYSTEM_PROMPT_ANALYST,
    USER_QUERY_TEMPLATE,
)
from strata_api.ai.providers import LLMProvider, get_default_llm_provider
from strata_api.core.duckdb_engine import validate_sql

logger = logging.getLogger(__name__)


class ConversationalAnalyst:
    """Coordinates natural language queries to SQL execution, self-correction, and verified summaries."""

    def __init__(
        self,
        executor: QueryExecutor,
        provider: Optional[LLMProvider] = None,
    ):
        self.executor = executor
        self.provider = provider or get_default_llm_provider()

    def _introspect_schema(self, view_name: str) -> List[Dict[str, Any]]:
        """Introspect DuckDB view schema if not explicitly provided."""
        try:
            conn = self.executor.engine.conn
            rows = conn.execute(f"DESCRIBE {view_name}").fetchall()
            return [{"name": r[0], "type": str(r[1])} for r in rows]
        except Exception as e:
            logger.debug("Failed to introspect view '%s': %s", view_name, e)
            return []

    def _format_schema_description(
        self,
        schema: Optional[List[Dict[str, Any]]],
        view_name: str,
    ) -> str:
        """Format column definitions and semantic types for the zero-PII prompt."""
        columns = schema if schema and schema != [{"name": "*"}] else self._introspect_schema(view_name)
        if not columns:
            return f"View: '{view_name}' (columns dynamically determined)"

        lines = [f"View Name: '{view_name}'", "Columns:"]
        for col in columns:
            name = col.get("name", "")
            dtype = col.get("type", col.get("dtype", "unknown"))
            semantic = col.get("semantic_type", "")
            extra = f" (semantic: {semantic})" if semantic else ""
            lines.append(f"  - {name}: {dtype}{extra}")
        return "\n".join(lines)

    def _format_column_summaries(
        self,
        column_summaries: Optional[List[Dict[str, Any]]],
    ) -> str:
        """Format aggregated statistics (min, max, nulls, distinct count) for the prompt."""
        if not column_summaries:
            return "No statistical summaries provided."

        lines = []
        for summary in column_summaries:
            col_name = summary.get("column", summary.get("name", "unknown"))
            parts = [f"Column '{col_name}':"]
            for k, v in summary.items():
                if k not in ("column", "name") and v is not None:
                    parts.append(f"{k}={v}")
            lines.append("  " + ", ".join(parts))
        return "\n".join(lines) if lines else "No statistical summaries provided."

    def _extract_clean_sql(self, sql_raw: Any, fallback_text: str = "") -> Optional[str]:
        """Extract a single clean SQL statement from various LLM response formats."""
        if sql_raw is None:
            # Check if there is an embedded SQL code fence in the fallback text
            match = re.search(
                r"```(?:sql)?\s*(SELECT\b[\s\S]*?|WITH\b[\s\S]*?|DESCRIBE\b[\s\S]*?|EXPLAIN\b[\s\S]*?|SHOW\b[\s\S]*?)\s*```",
                fallback_text,
                re.IGNORECASE,
            )
            if match:
                return match.group(1).strip()
            return None

        # If it's a list (e.g. [{"sql": "SELECT ..."}], ["SELECT ..."])
        if isinstance(sql_raw, list):
            for item in sql_raw:
                extracted = self._extract_clean_sql(item)
                if extracted:
                    return extracted
            return None

        # If it's a dict (e.g. {"sql": "SELECT ..."}, {"query": "SELECT ..."})
        if isinstance(sql_raw, dict):
            for k in ("sql", "query", "sql_query", "statement"):
                if k in sql_raw:
                    extracted = self._extract_clean_sql(sql_raw[k])
                    if extracted:
                        return extracted
            return None

        # If it's a string
        if isinstance(sql_raw, str):
            s = sql_raw.strip()
            if s.lower() in ("null", "none", "", "n/a"):
                return None

            # Remove markdown code blocks if present
            if "```" in s:
                fence_match = re.search(
                    r"```(?:sql)?\s*([\s\S]*?)\s*```",
                    s,
                    re.IGNORECASE,
                )
                if fence_match:
                    s = fence_match.group(1).strip()

            # If the string looks like a JSON array or object string "[{...}]" or '{"sql": ...}'
            if (s.startswith("[") and s.endswith("]")) or (s.startswith("{") and s.endswith("}")):
                try:
                    nested_parsed = json.loads(s)
                    extracted = self._extract_clean_sql(nested_parsed)
                    if extracted:
                        return extracted
                except Exception:
                    pass

            # If it's a python list-like string `[{...}]` that failed json.loads
            if s.startswith("[") and s.endswith("]"):
                sql_pattern = re.search(
                    r"(SELECT\b[\s\S]+?|WITH\b[\s\S]+?)(?:'|\"|\Z)",
                    s,
                    re.IGNORECASE,
                )
                if sql_pattern:
                    s = sql_pattern.group(1).strip()
                else:
                    return None

            # If it still starts with curly brace or bracket, it's not a valid SQL string
            if s.startswith("{") or s.startswith("["):
                return None

            return s

        return None

    def _parse_llm_json(self, raw_text: str) -> Dict[str, Any]:
        """Extract and parse structured JSON from LLM completion output."""
        cleaned = raw_text.strip()
        # Remove markdown code fences if wrapped in ```json ... ``` or ``` ... ```
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
            cleaned = cleaned.strip()

        parsed: Any = None
        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError:
            match = re.search(r"\{[\s\S]*\}", cleaned)
            if match:
                try:
                    parsed = json.loads(match.group(0))
                except json.JSONDecodeError:
                    pass
            if not parsed:
                arr_match = re.search(r"\[[\s\S]*\]", cleaned)
                if arr_match:
                    try:
                        parsed = json.loads(arr_match.group(0))
                    except json.JSONDecodeError:
                        pass

        if isinstance(parsed, list):
            for item in parsed:
                if isinstance(item, dict) and ("sql" in item or "explanation" in item or "query" in item):
                    parsed = item
                    break

        if isinstance(parsed, dict):
            raw_sql = parsed.get("sql", parsed.get("query", parsed.get("sql_query")))
            explanation = parsed.get("explanation", parsed.get("summary", ""))
            clean_sql = self._extract_clean_sql(raw_sql, fallback_text=cleaned)
            return {
                "sql": clean_sql,
                "explanation": str(explanation) if explanation else "",
            }

        # Fallback regex extraction for sql and explanation
        clean_sql = self._extract_clean_sql(None, fallback_text=cleaned)
        if not clean_sql:
            sql_match = re.search(r'"sql"\s*:\s*"([^"]+)"', cleaned)
            if sql_match:
                clean_sql = self._extract_clean_sql(sql_match.group(1))

        explanation_match = re.search(r'"explanation"\s*:\s*"([^"]+)"', cleaned)
        return {
            "sql": clean_sql,
            "explanation": explanation_match.group(1) if explanation_match else cleaned,
        }

    async def analyze(
        self,
        view_name: str,
        question: str,
        schema: Optional[List[Dict[str, Any]]] = None,
        column_summaries: Optional[List[Dict[str, Any]]] = None,
        max_retries: int = 2,
        user_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        plan_tier: str = "free",
        dataset_version: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Convert natural language to DuckDB SQL, execute, self-correct if needed, and verify."""
        # 1. Check response cache first (cache hit bypasses daily provider usage cap)
        cache_key = llm_cache.make_key(dataset_version or view_name, question)
        cached_result = llm_cache.get(cache_key)
        if cached_result is not None:
            return cached_result

        # 2. Check quota BEFORE invoking any LLM provider
        await quota_manager.check_quota(user_id=user_id, workspace_id=workspace_id, plan_tier=plan_tier)

        schema_desc = self._format_schema_description(schema, view_name)
        col_summaries_desc = self._format_column_summaries(column_summaries)

        system_prompt = SYSTEM_PROMPT_ANALYST.format(view_name=view_name)
        user_prompt = USER_QUERY_TEMPLATE.format(
            schema_description=schema_desc,
            column_summaries=col_summaries_desc,
            question=question,
        )

        logger.info("Generating analytical SQL for question: '%s' against view: '%s'", question, view_name)
        # Record provider call atomically on real provider execution
        await quota_manager.record_call(user_id=user_id, workspace_id=workspace_id, plan_tier=plan_tier)

        raw_completion = await self.provider.complete(system_prompt, user_prompt, json_mode=True)
        parsed = self._parse_llm_json(raw_completion)

        current_sql = parsed.get("sql")
        explanation = parsed.get("explanation", "")

        # If LLM deemed the question unanswerable or provided no SQL
        if not current_sql or str(current_sql).strip().lower() in ("null", "none", ""):
            unanswerable_res = {
                "question": question,
                "sql": None,
                "explanation": explanation or "The question cannot be answered with the available dataset schema.",
                "results": {
                    "success": True,
                    "row_count": 0,
                    "columns": [],
                    "data": [],
                    "executed_sql": None,
                },
                "retries": 0,
            }
            llm_cache.set(cache_key, unanswerable_res)
            return unanswerable_res

        current_sql = str(current_sql).strip()
        retries = 0

        # Self-correction loop (up to max_retries attempts)
        while True:
            # 1. Validate SQL using allowlist security rules from A2
            validation_error: Optional[str] = None
            try:
                validate_sql(current_sql, self.executor.engine.conn)
            except ValueError as ve:
                validation_error = str(ve)
                logger.warning("SQL validation failed on attempt %d: %s", retries, validation_error)

            # 2. If validation succeeded, execute SQL
            if not validation_error:
                exec_result = self.executor.execute_sql(current_sql)
                if exec_result.get("success"):
                    logger.info("SQL execution succeeded after %d retries.", retries)
                    final_success = {
                        "question": question,
                        "sql": current_sql,
                        "explanation": explanation,
                        "results": exec_result,
                        "retries": retries,
                    }
                    llm_cache.set(cache_key, final_success)
                    return final_success
                else:
                    error_message = exec_result.get("error", "Unknown execution error")
                    logger.warning("SQL execution failed on attempt %d: %s", retries, error_message)
            else:
                error_message = f"Validation Error: {validation_error}"
                exec_result = {
                    "success": False,
                    "error": error_message,
                    "executed_sql": current_sql,
                    "row_count": 0,
                    "columns": [],
                    "data": [],
                }

            # If we've reached max_retries, return failure
            if retries >= max_retries:
                logger.error("Query failed after %d retries. Error: %s", retries, error_message)
                return {
                    "question": question,
                    "sql": current_sql,
                    "explanation": explanation,
                    "results": exec_result,
                    "retries": retries,
                }

            # 3. Request Self-Correction from LLM
            retries += 1
            logger.info("Initiating self-correction turn %d for view '%s'", retries, view_name)
            correction_prompt = SELF_CORRECTION_PROMPT_TEMPLATE.format(
                question=question,
                view_name=view_name,
                schema_description=schema_desc,
                previous_sql=current_sql,
                error_message=error_message,
            )

            correction_completion = await self.provider.complete(
                system_prompt,
                correction_prompt,
                json_mode=True,
            )
            correction_parsed = self._parse_llm_json(correction_completion)
            new_sql = correction_parsed.get("sql")
            explanation = correction_parsed.get("explanation", explanation)

            if not new_sql or str(new_sql).strip().lower() in ("null", "none", ""):
                return {
                    "question": question,
                    "sql": None,
                    "explanation": explanation or f"Could not self-correct query: {error_message}",
                    "results": exec_result,
                    "retries": retries,
                }

            current_sql = str(new_sql).strip()
