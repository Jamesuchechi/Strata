"use client";

import React, { useState } from "react";
import {
  Code2,
  Terminal,
  Database,
  Copy,
  Check,
  X,
  ExternalLink,
  BookOpen,
} from "lucide-react";

interface SdkDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetName?: string;
  datasetId?: string;
}

export function SdkDocsModal({ isOpen, onClose, datasetName = "my_dataset.csv", datasetId = "dataset_id" }: SdkDocsModalProps) {
  const [activeTab, setActiveTab] = useState<"python" | "cli" | "sql">("python");
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const pythonSnippet = `# Install: pip install strata-sdk
import strata

# Connect to Strata local or remote workspace
client = strata.Client(api_url="http://localhost:8000/api")

# Load dataset as Polars / Pandas DataFrame
ds = client.get_dataset("${datasetId}")
df = ds.to_polars()
print(f"Loaded {len(df)} rows from {ds.name}")

# Compute statistical distribution drift
diff = ds.diff(base_version="v1.0.0", target_version="v1.1.0")
print(diff.distribution_shifts)

# Execute point-and-click transformation & auto-commit new version
new_version = ds.transform([
    {"op": "drop_nulls", "column": "monthly_charges"},
    {"op": "fill_null", "column": "tenure_months", "strategy": "median"}
], message="Cleaned outliers and imputed tenure via Python SDK")

print(f"Created commit: {new_version.commit_hash} (Tag: {new_version.version_tag})")
`;

  const cliSnippet = `# Strata Command-Line Interface (Pillar 8)
# Upload dataset to active workspace
strata upload ./data/${datasetName} --tag v1.0.0 --message "Initial baseline upload"

# Inspect dataset schema and column micro-stats
strata info ${datasetId}

# Compare two versions across DAG
strata diff ${datasetId} --base v1.0.0 --target v1.1.0 --format markdown > diff_report.md

# Execute sub-second analytical query
strata query "SELECT country, AVG(monthly_charges) FROM ${datasetName.replace('.', '_')} GROUP BY country"

# Tag and pin version
strata tag ${datasetId} v1.0.0 prod-release
strata pin ${datasetId} v1.0.0
`;

  const sqlSnippet = `-- Strata DuckDB SQL WASM Query Engine (Pillar 23)
-- Registered table view: view_${datasetId}
SELECT 
    country,
    COUNT(*) AS total_customers,
    ROUND(AVG(monthly_charges), 2) AS avg_monthly_bill,
    ROUND(AVG(churn_probability), 3) AS avg_churn_risk
FROM view_${datasetId}
GROUP BY country
HAVING COUNT(*) > 1
ORDER BY avg_churn_risk DESC;
`;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-[#E8E4DF] shadow-2xl max-w-2xl w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-[#E8E4DF] pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#0061FE]" />
            <h2 className="text-sm font-bold text-[#1E1915]">
              Interactive API & SDK Documentation (Pillar 18.3)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#8C827A] hover:text-[#1E1915] p-1 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex items-center gap-2 bg-[#FAF8F5] p-1 rounded-xl border border-[#E8E4DF] text-xs font-semibold">
          <button
            onClick={() => setActiveTab("python")}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === "python"
                ? "bg-white text-[#0061FE] font-bold shadow-2xs"
                : "text-[#736B63] hover:text-[#1E1915]"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Python SDK (`strata`)</span>
          </button>
          <button
            onClick={() => setActiveTab("cli")}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === "cli"
                ? "bg-white text-[#0061FE] font-bold shadow-2xs"
                : "text-[#736B63] hover:text-[#1E1915]"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>CLI (`strata`)</span>
          </button>
          <button
            onClick={() => setActiveTab("sql")}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === "sql"
                ? "bg-white text-[#0061FE] font-bold shadow-2xs"
                : "text-[#736B63] hover:text-[#1E1915]"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>DuckDB SQL</span>
          </button>
        </div>

        {/* Code Snippet Box */}
        <div className="relative rounded-2xl bg-[#1E1915] text-[#FAF8F5] p-4 font-mono text-xs overflow-x-auto border border-stone-800">
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-stone-800 text-[11px] text-stone-400">
            <span>
              {activeTab === "python"
                ? "strata_example.py"
                : activeTab === "cli"
                ? "terminal_session.sh"
                : "duckdb_query.sql"}
            </span>
            <button
              onClick={() => {
                const text =
                  activeTab === "python"
                    ? pythonSnippet
                    : activeTab === "cli"
                    ? cliSnippet
                    : sqlSnippet;
                copyToClipboard(text, activeTab);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer"
            >
              {copied === activeTab ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px]">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span className="text-[10px]">Copy Snippet</span>
                </>
              )}
            </button>
          </div>

          <pre className="text-xs leading-relaxed text-emerald-400/90 whitespace-pre">
            {activeTab === "python" && pythonSnippet}
            {activeTab === "cli" && cliSnippet}
            {activeTab === "sql" && sqlSnippet}
          </pre>
        </div>

        <div className="flex items-center justify-between text-xs text-[#8C827A] pt-2">
          <span>Targeting dataset: <code className="text-[#1E1915] font-bold font-mono">{datasetName}</code></span>
          <a
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
            className="text-[#0061FE] hover:underline flex items-center gap-1 font-semibold"
          >
            <span>Open OpenAPI / Swagger Docs</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
