"""Global version registry tracking DAG of commits."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from strata_api.versioning.graph import VersionGraph

_graph = VersionGraph()
_commits: List[Dict[str, Any]] = []


def record_commit(
    version_hash: str,
    dataset_name: str,
    parent_hash: Optional[str] = None,
    version_tag: str = "v1.0.0",
    message: str = "Dataset version commit",
    author: str = "James Uchechi",
    delta_rows: str = "+0 rows",
    delta_columns: str = "+0 cols",
    added_cols: Optional[List[str]] = None,
    removed_cols: Optional[List[str]] = None,
    modified_cols: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Store commit in DAG and chronological list."""
    # Avoid duplicate initial commit for same hash and dataset
    for existing in _commits:
        if existing["full_hash"] == version_hash and existing["dataset_name"] == dataset_name:
            return existing

    commit_record = {
        "id": f"commit_{len(_commits) + 1}",
        "hash": version_hash[:7],
        "full_hash": version_hash,
        "version": version_tag,
        "dataset_name": dataset_name,
        "parent_hash": parent_hash,
        "message": message,
        "author": author,
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "deltaRows": delta_rows,
        "deltaColumns": delta_columns,
        "status": "verified",
        "diffSummary": {
            "addedCols": added_cols or [],
            "removedCols": removed_cols or [],
            "modifiedCols": modified_cols or [],
        },
    }
    _graph.add_version(
        version_hash=version_hash,
        dataset_name=dataset_name,
        parent_hash=parent_hash,
        message=message,
        metadata=commit_record,
    )
    _commits.insert(0, commit_record)
    return commit_record


def get_all_commits() -> List[Dict[str, Any]]:
    return _commits


def get_commit_by_id(commit_id: str) -> Optional[Dict[str, Any]]:
    for c in _commits:
        if c["id"] == commit_id or c["hash"] == commit_id:
            return c
    return None


def clear_commits():
    """Clear all commits and reset DAG."""
    global _commits, _graph
    _commits.clear()
    _graph = VersionGraph()

