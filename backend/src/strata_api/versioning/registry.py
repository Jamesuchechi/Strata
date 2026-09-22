"""Global version registry tracking DAG of commits."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from strata_api.versioning.graph import VersionGraph

_graph = VersionGraph()
_commits: List[Dict[str, Any]] = []


def _parse_semver(version_str: str) -> Dict[str, Any]:
    """Parse semver string like 'v1.2.3' or '1.2.3' into components."""
    clean = version_str.lstrip("v").strip()
    parts = clean.split(".")
    major = int(parts[0]) if len(parts) > 0 and parts[0].isdigit() else 1
    minor = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
    patch = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 0
    return {
        "major": major,
        "minor": minor,
        "patch": patch,
        "semver_str": f"v{major}.{minor}.{patch}",
    }


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
    tags: Optional[List[str]] = None,
    is_pinned: bool = False,
    access_level: str = "workspace",
    custom_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Store commit in DAG and chronological list."""
    # Avoid duplicate initial commit for same hash and dataset
    for existing in _commits:
        if existing["full_hash"] == version_hash and existing["dataset_name"] == dataset_name:
            return existing

    semver_info = _parse_semver(version_tag)
    initial_tags = tags or [semver_info["semver_str"]]
    if "latest" not in initial_tags and len(_commits) == 0:
        initial_tags.append("latest")

    commit_record = {
        "id": f"commit_{len(_commits) + 1}",
        "hash": version_hash[:7],
        "full_hash": version_hash,
        "version": semver_info["semver_str"],
        "semver": semver_info,
        "dataset_name": dataset_name,
        "parent_hash": parent_hash,
        "message": message,
        "author": author,
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "deltaRows": delta_rows,
        "deltaColumns": delta_columns,
        "status": "verified",
        "tags": initial_tags,
        "is_pinned": is_pinned,
        "access_level": access_level,  # "public", "workspace", "private_draft"
        "custom_metadata": custom_metadata or {},
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
        if c["id"] == commit_id or c["hash"] == commit_id or c.get("full_hash") == commit_id:
            return c
    return None


def add_tag_to_commit(commit_id: str, tag: str) -> Optional[Dict[str, Any]]:
    """Add a tag or release alias to a commit."""
    c = get_commit_by_id(commit_id)
    if not c:
        return None
    tags = c.setdefault("tags", [])
    clean_tag = tag.strip().lower()
    if clean_tag and clean_tag not in tags:
        tags.append(clean_tag)
    return c


def remove_tag_from_commit(commit_id: str, tag: str) -> Optional[Dict[str, Any]]:
    """Remove a tag from a commit."""
    c = get_commit_by_id(commit_id)
    if not c:
        return None
    tags = c.setdefault("tags", [])
    clean_tag = tag.strip().lower()
    if clean_tag in tags:
        tags.remove(clean_tag)
    return c


def toggle_commit_pin(commit_id: str, is_pinned: Optional[bool] = None) -> Optional[Dict[str, Any]]:
    """Toggle or set pin protection on a commit to guard against garbage collection."""
    c = get_commit_by_id(commit_id)
    if not c:
        return None
    if is_pinned is not None:
        c["is_pinned"] = is_pinned
    else:
        c["is_pinned"] = not c.get("is_pinned", False)
    return c


def update_commit_permissions(commit_id: str, access_level: str) -> Optional[Dict[str, Any]]:
    """Set version-level access control: 'public', 'workspace', or 'private_draft'."""
    c = get_commit_by_id(commit_id)
    if not c:
        return None
    valid_levels = {"public", "workspace", "private_draft"}
    c["access_level"] = access_level if access_level in valid_levels else "workspace"
    return c


def update_commit_metadata(commit_id: str, metadata: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Add or update custom key-value metadata on a commit."""
    c = get_commit_by_id(commit_id)
    if not c:
        return None
    c.setdefault("custom_metadata", {}).update(metadata)
    return c


def bump_commit_semver(commit_id: str, bump_type: str = "patch") -> Optional[Dict[str, Any]]:
    """Bump semantic version (patch, minor, major) and update version tag."""
    c = get_commit_by_id(commit_id)
    if not c:
        return None
    semver = c.get("semver", _parse_semver(c.get("version", "v1.0.0")))
    major = semver.get("major", 1)
    minor = semver.get("minor", 0)
    patch = semver.get("patch", 0)

    if bump_type == "major":
        major += 1
        minor = 0
        patch = 0
    elif bump_type == "minor":
        minor += 1
        patch = 0
    else:  # patch
        patch += 1

    new_str = f"v{major}.{minor}.{patch}"
    c["semver"] = {
        "major": major,
        "minor": minor,
        "patch": patch,
        "semver_str": new_str,
    }
    c["version"] = new_str
    if new_str not in c.setdefault("tags", []):
        c["tags"].append(new_str)
    return c


def clear_commits():
    """Clear all commits and reset DAG."""
    global _commits, _graph
    _commits.clear()
    _graph = VersionGraph()

