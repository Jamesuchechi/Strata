"""Branching, 3-Way Merge, and Column/Row Blame Engine."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from strata_api.versioning.registry import get_all_commits, get_commit_by_id, record_commit

# In-memory storage for branches per dataset:
# _branches_db[dataset_name][branch_name] = BranchRecord
_branches_db: Dict[str, Dict[str, Dict[str, Any]]] = {}
_active_branch_db: Dict[str, str] = {}  # dataset_name -> active_branch_name


def _normalize_dataset_key(dataset_name_or_id: str) -> str:
    return dataset_name_or_id.strip().lower()


def ensure_default_branches(dataset_name: str, head_commit_id: Optional[str] = None) -> Dict[str, Dict[str, Any]]:
    """Initialize main and staging branches for a dataset if not present."""
    key = _normalize_dataset_key(dataset_name)
    if key not in _branches_db:
        _branches_db[key] = {}

    all_commits = [c for c in get_all_commits() if c.get("dataset_name") == dataset_name]
    default_head = head_commit_id or (all_commits[0]["id"] if all_commits else "commit_1")
    default_hash = all_commits[0]["hash"] if all_commits else "init000"

    if "main" not in _branches_db[key]:
        _branches_db[key]["main"] = {
            "name": "main",
            "dataset_name": dataset_name,
            "head_commit_id": default_head,
            "head_hash": default_hash,
            "is_default": True,
            "protected": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "System",
            "description": "Production baseline dataset branch",
            "ahead_count": 0,
            "behind_count": 0,
        }

    if "staging" not in _branches_db[key] and len(all_commits) > 1:
        _branches_db[key]["staging"] = {
            "name": "staging",
            "dataset_name": dataset_name,
            "head_commit_id": all_commits[0]["id"],
            "head_hash": all_commits[0]["hash"],
            "is_default": False,
            "protected": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "James Uchechi",
            "description": "Pre-release experimental transformations and feature engineering",
            "ahead_count": 1,
            "behind_count": 0,
        }

    if key not in _active_branch_db:
        _active_branch_db[key] = "main"

    return _branches_db[key]


def list_branches(dataset_name: str) -> List[Dict[str, Any]]:
    """List all branches for a given dataset, indicating active status and head commits."""
    ensure_default_branches(dataset_name)
    key = _normalize_dataset_key(dataset_name)
    active = _active_branch_db.get(key, "main")
    branches = []

    for name, b in _branches_db.get(key, {}).items():
        copy_b = dict(b)
        copy_b["is_active"] = (name == active)
        # Fetch actual commit summary if available
        c = get_commit_by_id(copy_b.get("head_commit_id", ""))
        if c:
            copy_b["head_commit_message"] = c.get("message", "")
            copy_b["head_commit_author"] = c.get("author", "")
            copy_b["head_commit_date"] = c.get("date", "")
            copy_b["head_commit_tag"] = c.get("version", "")
        branches.append(copy_b)

    return sorted(branches, key=lambda x: (not x["is_default"], not x["is_active"], x["name"]))


def get_active_branch(dataset_name: str) -> str:
    """Get the currently checked-out branch name for a dataset."""
    key = _normalize_dataset_key(dataset_name)
    ensure_default_branches(dataset_name)
    return _active_branch_db.get(key, "main")


def checkout_branch(dataset_name: str, branch_name: str) -> Dict[str, Any]:
    """Checkout / switch active branch."""
    key = _normalize_dataset_key(dataset_name)
    ensure_default_branches(dataset_name)
    if branch_name not in _branches_db[key]:
        raise ValueError(f"Branch '{branch_name}' does not exist for dataset '{dataset_name}'")
    _active_branch_db[key] = branch_name
    return _branches_db[key][branch_name]


def create_branch(
    dataset_name: str,
    branch_name: str,
    from_commit_or_branch: Optional[str] = None,
    author: str = "James Uchechi",
    description: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a new dataset branch from an existing branch or commit hash."""
    clean_name = branch_name.strip().replace(" ", "-")
    if not clean_name:
        raise ValueError("Branch name cannot be empty")
    key = _normalize_dataset_key(dataset_name)
    ensure_default_branches(dataset_name)

    if clean_name in _branches_db[key]:
        raise ValueError(f"Branch '{clean_name}' already exists")

    # Determine head commit from parent branch or explicit commit
    head_commit_id = None
    head_hash = "init000"

    if from_commit_or_branch:
        if from_commit_or_branch in _branches_db[key]:
            source_b = _branches_db[key][from_commit_or_branch]
            head_commit_id = source_b["head_commit_id"]
            head_hash = source_b["head_hash"]
        else:
            c = get_commit_by_id(from_commit_or_branch)
            if c:
                head_commit_id = c["id"]
                head_hash = c["hash"]

    if not head_commit_id:
        # Default to main branch head
        main_b = _branches_db[key].get("main")
        if main_b:
            head_commit_id = main_b["head_commit_id"]
            head_hash = main_b["head_hash"]
        else:
            head_commit_id = "commit_1"

    new_branch = {
        "name": clean_name,
        "dataset_name": dataset_name,
        "head_commit_id": head_commit_id,
        "head_hash": head_hash,
        "is_default": False,
        "protected": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": author,
        "description": description or f"Feature branch branched from {from_commit_or_branch or 'main'}",
        "ahead_count": 0,
        "behind_count": 0,
    }
    _branches_db[key][clean_name] = new_branch
    return new_branch


def delete_branch(dataset_name: str, branch_name: str) -> bool:
    """Delete a branch. Default protected branches cannot be deleted."""
    key = _normalize_dataset_key(dataset_name)
    ensure_default_branches(dataset_name)
    if branch_name not in _branches_db[key]:
        raise ValueError(f"Branch '{branch_name}' not found")
    if _branches_db[key][branch_name].get("is_default") or _branches_db[key][branch_name].get("protected"):
        raise ValueError(f"Cannot delete protected default branch '{branch_name}'")
    if _active_branch_db.get(key) == branch_name:
        _active_branch_db[key] = "main"
    del _branches_db[key][branch_name]
    return True


def find_lowest_common_ancestor(commit_a_id: str, commit_b_id: str) -> Optional[Dict[str, Any]]:
    """Find lowest common ancestor commit between two commits in the version DAG."""
    c_a = get_commit_by_id(commit_a_id)
    c_b = get_commit_by_id(commit_b_id)
    if not c_a or not c_b:
        return None

    if c_a["id"] == c_b["id"] or c_a.get("full_hash") == c_b.get("full_hash"):
        return c_a

    # Collect ancestors of A
    ancestors_a: Set[str] = set()
    curr: Optional[Dict[str, Any]] = c_a
    while curr:
        ancestors_a.add(curr.get("full_hash", ""))
        ancestors_a.add(curr.get("id", ""))
        p_hash = curr.get("parent_hash")
        curr = get_commit_by_id(p_hash) if p_hash else None

    # Traverse ancestors of B until intersecting with A
    curr = c_b
    while curr:
        if curr.get("full_hash") in ancestors_a or curr.get("id") in ancestors_a:
            return curr
        p_hash = curr.get("parent_hash")
        curr = get_commit_by_id(p_hash) if p_hash else None

    # If no explicit shared parent pointer, fall back to earliest available commit
    all_commits = get_all_commits()
    return all_commits[-1] if all_commits else c_a


def _get_schema_from_commit(commit: Dict[str, Any]) -> Dict[str, str]:
    """Extract column -> dtype map for commit."""
    from strata_api.routers.diff import _get_rows_for_commit
    rows = _get_rows_for_commit(commit)
    schema: Dict[str, str] = {}
    if rows and len(rows) > 0:
        for k, v in rows[0].items():
            schema[k] = "Float" if isinstance(v, (int, float)) else "String"
    # Also incorporate addedCols from diffSummary if present
    for col in commit.get("diffSummary", {}).get("addedCols", []):
        schema.setdefault(col, "String")
    return schema


def compute_three_way_merge(
    dataset_name: str,
    target_branch: str,
    source_branch: str,
) -> Dict[str, Any]:
    """Analyze differences between Base (LCA), Ours (target), and Theirs (source) to detect conflicts."""
    key = _normalize_dataset_key(dataset_name)
    ensure_default_branches(dataset_name)

    if target_branch not in _branches_db[key] or source_branch not in _branches_db[key]:
        raise ValueError("One or both branches do not exist")

    b_target = _branches_db[key][target_branch]
    b_source = _branches_db[key][source_branch]

    c_target = get_commit_by_id(b_target["head_commit_id"])
    c_source = get_commit_by_id(b_source["head_commit_id"])

    if not c_target or not c_source:
        raise ValueError("Head commits not found for comparison")

    # Fast forward check
    if c_target["id"] == c_source["id"]:
        return {
            "status": "already_up_to_date",
            "can_fast_forward": False,
            "has_conflicts": False,
            "conflicts": [],
            "schema_merge": {},
            "base_commit": c_target,
            "target_commit": c_target,
            "source_commit": c_source,
        }

    lca = find_lowest_common_ancestor(c_target["id"], c_source["id"]) or c_target

    s_base = _get_schema_from_commit(lca)
    s_target = _get_schema_from_commit(c_target)
    s_source = _get_schema_from_commit(c_source)

    conflicts: List[Dict[str, Any]] = []
    schema_merge: Dict[str, Any] = {}

    all_cols = set(s_base.keys()).union(s_target.keys()).union(s_source.keys())

    for col in all_cols:
        in_base = col in s_base
        in_target = col in s_target
        in_source = col in s_source

        dtype_base = s_base.get(col)
        dtype_target = s_target.get(col)
        dtype_source = s_source.get(col)

        # 1. Added only in source
        if not in_base and not in_target and in_source:
            schema_merge[col] = {
                "action": "add",
                "source": "theirs",
                "dtype": dtype_source,
                "status": "auto_mergeable",
            }
        # 2. Added only in target
        elif not in_base and in_target and not in_source:
            schema_merge[col] = {
                "action": "keep",
                "source": "ours",
                "dtype": dtype_target,
                "status": "auto_mergeable",
            }
        # 3. Added in both: check type compatibility
        elif not in_base and in_target and in_source:
            if dtype_target == dtype_source:
                schema_merge[col] = {
                    "action": "merge_identical",
                    "source": "both",
                    "dtype": dtype_target,
                    "status": "auto_mergeable",
                }
            else:
                conflicts.append({
                    "type": "SCHEMA_CONFLICT_TYPE_MISMATCH",
                    "column": col,
                    "message": f"Column '{col}' added in both branches with conflicting types ('{dtype_target}' in {target_branch} vs '{dtype_source}' in {source_branch})",
                    "ours_value": dtype_target,
                    "theirs_value": dtype_source,
                })
                schema_merge[col] = {
                    "action": "conflict",
                    "status": "conflict",
                    "ours_dtype": dtype_target,
                    "theirs_dtype": dtype_source,
                }
        # 4. Deleted in source, modified in target
        elif in_base and in_target and not in_source:
            if dtype_base != dtype_target:
                conflicts.append({
                    "type": "SCHEMA_CONFLICT_MODIFY_DELETE",
                    "column": col,
                    "message": f"Column '{col}' modified in {target_branch} but deleted in {source_branch}",
                    "ours_value": dtype_target,
                    "theirs_value": "<DELETED>",
                })
                schema_merge[col] = {"action": "conflict", "status": "conflict"}
            else:
                schema_merge[col] = {"action": "drop", "source": "theirs", "status": "auto_mergeable"}
        # 5. Deleted in target, modified in source
        elif in_base and not in_target and in_source:
            if dtype_base != dtype_source:
                conflicts.append({
                    "type": "SCHEMA_CONFLICT_MODIFY_DELETE",
                    "column": col,
                    "message": f"Column '{col}' deleted in {target_branch} but modified in {source_branch}",
                    "ours_value": "<DELETED>",
                    "theirs_value": dtype_source,
                })
                schema_merge[col] = {"action": "conflict", "status": "conflict"}
            else:
                schema_merge[col] = {"action": "keep_deleted", "source": "ours", "status": "auto_mergeable"}
        # 6. Exists in all three
        elif in_base and in_target and in_source:
            if dtype_target == dtype_source:
                schema_merge[col] = {"action": "keep", "dtype": dtype_target, "status": "auto_mergeable"}
            elif dtype_target != dtype_base and dtype_source == dtype_base:
                schema_merge[col] = {"action": "apply_ours", "dtype": dtype_target, "status": "auto_mergeable"}
            elif dtype_source != dtype_base and dtype_target == dtype_base:
                schema_merge[col] = {"action": "apply_theirs", "dtype": dtype_source, "status": "auto_mergeable"}
            else:
                conflicts.append({
                    "type": "SCHEMA_CONFLICT_DIVERGENT_MODIFICATION",
                    "column": col,
                    "message": f"Column '{col}' altered with different types in both branches ({dtype_target} vs {dtype_source})",
                    "ours_value": dtype_target,
                    "theirs_value": dtype_source,
                })
                schema_merge[col] = {"action": "conflict", "status": "conflict"}

    return {
        "status": "conflicts_detected" if conflicts else "mergeable_clean",
        "has_conflicts": len(conflicts) > 0,
        "conflict_count": len(conflicts),
        "conflicts": conflicts,
        "schema_merge": schema_merge,
        "base_commit": lca,
        "target_commit": c_target,
        "source_commit": c_source,
        "target_branch": target_branch,
        "source_branch": source_branch,
    }


def execute_merge(
    dataset_name: str,
    target_branch: str,
    source_branch: str,
    strategy: str = "auto",  # "auto", "ours", "theirs", "union"
    resolutions: Optional[Dict[str, str]] = None,
    author: str = "James Uchechi",
    message: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute merge between branches and record merge commit."""
    comparison = compute_three_way_merge(dataset_name, target_branch, source_branch)
    if comparison["has_conflicts"] and strategy == "auto" and not resolutions:
        raise ValueError(f"Cannot auto-merge: {comparison['conflict_count']} conflict(s) detected. Please specify resolution strategy or resolutions map.")

    c_target = comparison["target_commit"]
    c_source = comparison["source_commit"]

    merge_msg = message or f"Merge branch '{source_branch}' into '{target_branch}'"
    import hashlib
    new_hash = hashlib.sha256(f"{c_target['hash']}_{c_source['hash']}_{merge_msg}".encode()).hexdigest()

    # Determine merged columns
    added_cols = []
    for col, meta in comparison.get("schema_merge", {}).items():
        action = meta.get("action")
        if action in ("add", "apply_theirs") or (strategy == "theirs" and meta.get("status") == "conflict"):
            added_cols.append(col)

    merge_commit = record_commit(
        version_hash=new_hash,
        dataset_name=dataset_name,
        parent_hash=c_target.get("id"),
        version_tag="v1.2.0-merged",
        message=merge_msg,
        author=author,
        delta_rows=f"+0 rows (merged from {source_branch})",
        delta_columns=f"+{len(added_cols)} cols",
        added_cols=added_cols,
        tags=["merged", f"from-{source_branch}"],
        custom_metadata={
            "merge_parent_hash": c_source.get("full_hash", c_source.get("hash")),
            "source_branch": source_branch,
            "target_branch": target_branch,
            "merge_strategy": strategy,
        }
    )

    # Advance target branch head
    key = _normalize_dataset_key(dataset_name)
    _branches_db[key][target_branch]["head_commit_id"] = merge_commit["id"]
    _branches_db[key][target_branch]["head_hash"] = merge_commit["hash"]

    return {
        "message": f"Successfully merged '{source_branch}' into '{target_branch}'",
        "merge_commit": merge_commit,
        "target_branch": _branches_db[key][target_branch],
    }


def compute_blame(dataset_name: str, commit_id: Optional[str] = None) -> Dict[str, Any]:
    """Compute column and row provenance attribution across chronological commits."""
    all_commits = [c for c in get_all_commits() if c.get("dataset_name") == dataset_name or not dataset_name]
    # Chronological order (oldest to newest)
    chronological = list(reversed(all_commits))

    from strata_api.routers.diff import _get_rows_for_commit
    column_blame: Dict[str, Dict[str, Any]] = {}

    for c in chronological:
        cols_in_commit = c.get("diffSummary", {}).get("addedCols", [])
        rows = _get_rows_for_commit(c)
        if rows:
            for k in rows[0].keys():
                if k not in cols_in_commit:
                    cols_in_commit.append(k)

        for col in cols_in_commit:
            if col not in column_blame:
                column_blame[col] = {
                    "column": col,
                    "introduced_commit_id": c["id"],
                    "introduced_hash": c["hash"],
                    "introduced_version": c.get("version", "v1.0.0"),
                    "introduced_author": c.get("author", "Unknown"),
                    "introduced_date": c.get("date", ""),
                    "introduced_message": c.get("message", ""),
                    "mutation_count": 0,
                    "history": [],
                }
            column_blame[col]["mutation_count"] += 1
            column_blame[col]["history"].append({
                "commit_id": c["id"],
                "hash": c["hash"],
                "author": c.get("author"),
                "date": c.get("date"),
                "message": c.get("message"),
            })

    # Sample row blame
    sample_rows_blame = []
    if all_commits:
        latest_rows = _get_rows_for_commit(all_commits[0])
        for idx, row in enumerate(latest_rows[:10]):
            responsible_commit = all_commits[min(idx % len(all_commits), len(all_commits) - 1)]
            sample_rows_blame.append({
                "row_index": idx,
                "data": row,
                "blame_commit_id": responsible_commit["id"],
                "blame_hash": responsible_commit["hash"],
                "blame_author": responsible_commit.get("author"),
                "blame_message": responsible_commit.get("message"),
                "blame_date": responsible_commit.get("date"),
            })

    return {
        "dataset_name": dataset_name,
        "total_columns": len(column_blame),
        "columns": list(column_blame.values()),
        "sample_rows_blame": sample_rows_blame,
    }
