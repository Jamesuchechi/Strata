# Strata Python SDK & CLI

Official Python client and command-line interface for Strata.

## Installation

```bash
pip install strata-sdk
```

## Quickstart

```python
import strata as st

# Upload and version a dataset
dataset = st.Dataset("customer_churn")
version = dataset.upload("./data.csv", message="Initial dataset upload")

# Load latest or specific version
df = dataset.load(version="latest")  # Returns Polars or Pandas DataFrame
print(df.head())

# Compute diff between versions
diff = st.diff("customer_churn", v1="v1.0", v2="v1.1")
print(diff.summary())
```

## CLI Usage

```bash
strata preview ./data.xlsx
strata upload ./dataset.parquet --name churn
strata diff v1.0 v1.1
strata profile churn
```
