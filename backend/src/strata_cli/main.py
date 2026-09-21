"""Strata Command-Line Interface (CLI).

Git-like version control, dataset management, and DuckDB analytical queries
directly from the terminal.
"""

import sys
import os
import argparse
from typing import Optional
from strata_sdk.client import StrataClient


def get_client() -> StrataClient:
    api_url = os.environ.get("STRATA_API_URL", "http://127.0.0.1:8000/api")
    token = os.environ.get("STRATA_API_TOKEN")
    return StrataClient(base_url=api_url, auth_token=token)


def cmd_status(args):
    client = get_client()
    healthy = client.check_health()
    if healthy:
        print(f"✓ Strata API connected at {client.base_url} [Healthy]")
    else:
        print(f"✗ Strata API unreachable at {client.base_url}")
        sys.exit(1)


def cmd_push(args):
    client = get_client()
    file_path = args.file
    if not os.path.exists(file_path):
        print(f"Error: File not found: {file_path}")
        sys.exit(1)

    print(f"Uploading and computing cryptographic SHA-256 hash for {file_path}...")
    try:
        res = client.upload_dataset(file_path, sheet=args.sheet)
        if res.get("is_duplicate"):
            print(f"⚠ Content deduplication hit: identical dataset already registered as '{res.get('existing_dataset_name')}'")
        else:
            print(f"✓ Successfully ingested {res['filename']}")
        print(f"  ID:          {res['content_hash'][:12]}")
        print(f"  SHA-256:     {res['content_hash']}")
        print(f"  Shape:       {res['total_rows']:,} rows × {res['total_columns']} columns")
        print(f"  DuckDB View: {res.get('view_name')}")
        if res.get("quality_score"):
            print(f"  Cleanliness: {res['quality_score']['overall_score']}%")
    except Exception as e:
        print(f"Error pushing dataset: {e}")
        sys.exit(1)


def cmd_list(args):
    client = get_client()
    try:
        datasets = client.list_datasets()
        if not datasets:
            print("No datasets found in active workspace.")
            return

        print(f"{'ID':<14} {'NAME':<24} {'FORMAT':<8} {'ROWS':<10} {'VERSION':<10} {'QUALITY'}")
        print("-" * 75)
        for d in datasets:
            q = f"{d.get('quality_score')}%" if d.get('quality_score') else "N/A"
            v = d.get('latest_version') or "v1.0.0"
            print(f"{d['id']:<14} {d['name'][:22]:<24} {d['format']:<8} {d['total_rows']:<10} {v:<10} {q}")
    except Exception as e:
        print(f"Error listing datasets: {e}")
        sys.exit(1)


def cmd_log(args):
    client = get_client()
    try:
        commits = client.get_commit_log(dataset_name=args.dataset)
        if not commits:
            print("No commit history found.")
            return

        print("=== Strata Immutable Version DAG ===")
        for c in commits:
            print(f"\ncommit {c['id']}")
            print(f"Author:  {c.get('author', 'Unknown')}")
            print(f"Date:    {c.get('timestamp')}")
            print(f"Tag:     {c.get('version_tag', 'v1.0.0')}")
            print(f"Deltas:  {c.get('delta_rows', '0')} | {c.get('delta_columns', '0')}")
            print(f"\n    {c.get('message', 'No commit message')}")
    except Exception as e:
        print(f"Error fetching commit log: {e}")
        sys.exit(1)


def cmd_diff(args):
    client = get_client()
    try:
        diff_res = client.compare_snapshots(args.base_id, args.target_id)
        print(f"=== Multi-Dimensional Diff ({args.base_id[:8]}... -> {args.target_id[:8]}...) ===")
        print(f"Row Delta:        {diff_res.get('row_count_delta', 0):+d} rows")
        print(f"Structural Equal: {diff_res.get('is_structurally_equal')}")
        
        added = diff_res.get("added_columns", [])
        removed = diff_res.get("removed_columns", [])
        common = diff_res.get("common_columns", [])
        
        if added:
            print(f"\n[+] Added Columns ({len(added)}):   {', '.join(added)}")
        if removed:
            print(f"[-] Removed Columns ({len(removed)}): {', '.join(removed)}")
        print(f"[*] Common Columns ({len(common)}):  {', '.join(common)}")

        drift = diff_res.get("statistical_drift", {})
        if drift:
            print("\nStatistical Drift:")
            for col, d in drift.items():
                print(f"  {col}: mean shift {d.get('mean_delta', 0):+.2f}, null rate {d.get('target_null_pct', 0)}%")
    except Exception as e:
        print(f"Error comparing snapshots: {e}")
        sys.exit(1)


def cmd_query(args):
    client = get_client()
    try:
        res = client.query(view_name=args.view, sql=args.sql, natural_language_question=args.nl)
        if not res.get("success"):
            print(f"Query Error: {res.get('error')}")
            sys.exit(1)

        cols = res.get("columns", [])
        data = res.get("data", [])
        print(f"Returned {len(data)} rows:\n")
        
        # Simple formatted table
        header = " | ".join(cols)
        print(header)
        print("-" * len(header))
        for row in data[:20]:
            print(" | ".join(str(row.get(c, "")) for c in cols))
        if len(data) > 20:
            print(f"... and {len(data) - 20} more rows.")
    except Exception as e:
        print(f"Error executing query: {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        prog="strata",
        description="Strata CLI: Git-like version control, dataset management, and DuckDB analytical queries.",
    )
    subparsers = parser.add_subparsers(dest="command", help="Available subcommands")

    # status
    sub = subparsers.add_parser("status", help="Check Strata API connection")
    sub.set_defaults(func=cmd_status)

    # push
    sub = subparsers.add_parser("push", help="Upload a dataset file to Strata")
    sub.add_argument("file", help="Path to CSV, Parquet, Excel, JSON, or SDF file")
    sub.add_argument("--sheet", help="Specific Excel sheet to parse")
    sub.set_defaults(func=cmd_push)

    # list
    sub = subparsers.add_parser("list", help="List registered datasets in workspace")
    sub.set_defaults(func=cmd_list)

    # log
    sub = subparsers.add_parser("log", help="Display immutable version commit history DAG")
    sub.add_argument("--dataset", help="Optional filter by dataset name")
    sub.set_defaults(func=cmd_log)

    # diff
    sub = subparsers.add_parser("diff", help="Compare two snapshot versions")
    sub.add_argument("base_id", help="Base commit hash or version ID")
    sub.add_argument("target_id", help="Target commit hash or version ID")
    sub.set_defaults(func=cmd_diff)

    # query
    sub = subparsers.add_parser("query", help="Execute DuckDB SQL query against dataset view")
    sub.add_argument("view", help="Target DuckDB view name (e.g. view_abc123)")
    sub.add_argument("--sql", help="DuckDB SQL statement to run")
    sub.add_argument("--nl", help="Natural language question to translate to SQL")
    sub.set_defaults(func=cmd_query)

    args = parser.parse_args()
    if not hasattr(args, "func"):
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
