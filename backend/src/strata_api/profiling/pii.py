"""PII detection rules and regex heuristics."""

import re
from typing import Dict, List

PII_PATTERNS = {
    "email": re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"),
    "phone": re.compile(r"^\+?[1-9]\d{1,14}$|^(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$"),
    "ssn": re.compile(r"^\d{3}-\d{2}-\d{4}$"),
    "credit_card": re.compile(r"^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})$"),
}


def detect_pii_columns(sample_records: List[Dict[str, str]]) -> Dict[str, str]:
    """Scan sample values in columns for potential PII matches."""
    flagged: Dict[str, str] = {}
    if not sample_records:
        return flagged

    columns = sample_records[0].keys()
    for col in columns:
        col_lower = col.lower()
        if "email" in col_lower:
            flagged[col] = "email"
            continue
        if "phone" in col_lower or "mobile" in col_lower:
            flagged[col] = "phone"
            continue
        if "ssn" in col_lower or "social" in col_lower:
            flagged[col] = "ssn"
            continue

        # Sample value regex testing
        for row in sample_records[:30]:
            val = str(row.get(col, "")).strip()
            if not val:
                continue
            for pii_type, pattern in PII_PATTERNS.items():
                if pattern.match(val):
                    flagged[col] = pii_type
                    break
            if col in flagged:
                break

    return flagged
