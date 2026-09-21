"""Entrypoint wrapper for Strata API service."""

import sys
from pathlib import Path

# Add src to python path for direct script invocation
sys.path.insert(0, str(Path(__file__).parent / "src"))

from strata_api.main import start

if __name__ == "__main__":
    start()
