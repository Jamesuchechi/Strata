"""Route Parity Verification Script for Strata.

Inspects backend FastAPI routes and verifies against frontend API calls to ensure zero broken routes.
"""

import sys
import re
from pathlib import Path

# Add backend source to Python path
repo_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(repo_root / "backend" / "src"))

from strata_api.main import app


def get_backend_routes():
    schema = app.openapi()
    return set(schema.get("paths", {}).keys())


def scan_frontend_endpoints(frontend_dir: Path):
    """Scans frontend ts/tsx files for API calls and extracts relative paths."""
    endpoints = []
    # Pattern to match fetch/apiFetch calls with template strings or url strings
    pattern = re.compile(r'(?:apiFetch|fetch)\s*\(\s*[`\'"]\$\{API_BASE\}(/[^`\'"?\s]*)')
    pattern_direct = re.compile(r'(?:apiFetch|fetch)\s*\(\s*[`\'"](/api/[^`\'"?\s]*)')

    for file_path in frontend_dir.rglob("*.ts*"):
        if "node_modules" in str(file_path) or ".next" in str(file_path):
            continue
        try:
            content = file_path.read_text(encoding="utf-8")
            for match in pattern.finditer(content):
                endpoints.append((match.group(1), str(file_path.relative_to(repo_root))))
            for match in pattern_direct.finditer(content):
                endpoints.append((match.group(1), str(file_path.relative_to(repo_root))))
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
    return endpoints


def route_matches(frontend_path: str, backend_routes: set) -> bool:
    # If frontend path doesn't start with /api, normalize it
    norm_fe = frontend_path if frontend_path.startswith("/api") else f"/api{frontend_path}"
    # Remove query string if any
    norm_fe = norm_fe.split("?")[0]
    
    # Replace JS template literals like ${encodeURIComponent(param)} or ${param} with a wildcard regex
    # e.g. /api/diff/commits/${commitId}/tags/${encodeURIComponent(tag)} -> /api/diff/commits/[^/]+/tags/[^/]+
    norm_fe_regex = re.sub(r"\$\{[^}]+\}", r"[^/]+", norm_fe)
    norm_fe_pattern = f"^{norm_fe_regex}$"

    for b_route in backend_routes:
        # replace {param} with regex pattern
        b_route_regex = "^" + re.sub(r"\{[a-zA-Z0-9_]+\}", r"[^/]+", b_route) + "$"
        if re.match(b_route_regex, norm_fe) or re.match(norm_fe_pattern, b_route):
            return True
        if norm_fe == b_route:
            return True
    return False


def main():
    backend_routes = get_backend_routes()
    print(f"Found {len(backend_routes)} backend routes registered on FastAPI.")
    
    frontend_dir = repo_root / "frontend" / "src"
    frontend_calls = scan_frontend_endpoints(frontend_dir)
    print(f"Found {len(frontend_calls)} frontend API calls.")

    unmatched = []
    for fe_path, source_file in frontend_calls:
        if not route_matches(fe_path, backend_routes):
            unmatched.append((fe_path, source_file))

    if unmatched:
        print(f"\n[FAIL] Found {len(unmatched)} potentially unmatched frontend endpoints:")
        for path, src in unmatched:
            print(f"  - {path} in {src}")
        return 1
    else:
        print("\n[SUCCESS] All frontend API endpoints match backend FastAPI routes perfectly!")
        return 0


if __name__ == "__main__":
    sys.exit(main())
