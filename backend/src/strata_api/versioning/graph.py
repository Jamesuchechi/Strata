"""Version graph DAG and commit tracking."""

from typing import Any, Dict, List, Optional


class VersionGraph:
    """Manages parent pointers, tags, and commits for dataset lineage."""

    def __init__(self):
        self.versions: Dict[str, Dict[str, Any]] = {}

    def add_version(
        self,
        version_hash: str,
        dataset_name: str,
        parent_hash: Optional[str],
        message: str,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Record a new immutable version in the DAG."""
        record = {
            "hash": version_hash,
            "dataset": dataset_name,
            "parent_hash": parent_hash,
            "message": message,
            "metadata": metadata,
        }
        self.versions[version_hash] = record
        return record

    def get_history(self, version_hash: str) -> List[Dict[str, Any]]:
        """Traverse backward from a version to its roots."""
        history = []
        curr = version_hash
        while curr and curr in self.versions:
            node = self.versions[curr]
            history.append(node)
            curr = node.get("parent_hash")
        return history
