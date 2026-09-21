"""Composite explainable data quality score."""

from typing import Any, Dict, List


def calculate_quality_score(column_stats: List[Dict[str, Any]], pii_flags: Dict[str, str]) -> Dict[str, Any]:
    """Calculate an overall data quality score (0–100) with sub-scores."""
    if not column_stats:
        return {"overall_score": 100, "completeness": 100, "pii_risk": 0, "issues": []}

    total_cols = len(column_stats)
    issues = []

    # Completeness penalty
    avg_null_pct = sum(c.get("null_pct", 0.0) for c in column_stats) / total_cols
    completeness_score = max(0.0, 100.0 - (avg_null_pct * 1.5))
    if avg_null_pct > 20:
        issues.append(f"High missingness: average {avg_null_pct:.1f}% missing values across columns.")

    # PII Risk score
    pii_count = len(pii_flags)
    pii_score = max(0, 100 - (pii_count * 20))
    if pii_count > 0:
        issues.append(f"Detected PII in {pii_count} column(s): {', '.join(pii_flags.keys())}")

    overall_score = round((completeness_score * 0.7) + (pii_score * 0.3), 1)

    return {
        "overall_score": overall_score,
        "completeness": round(completeness_score, 1),
        "pii_risk_score": pii_score,
        "flagged_pii_count": pii_count,
        "issues": issues,
    }
