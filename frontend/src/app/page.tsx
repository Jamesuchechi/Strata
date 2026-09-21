"use client";

import React, { useState, useEffect } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  Layers,
  Database,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  Activity,
  Terminal,
} from "lucide-react";
import { uploadAndPreviewFile, checkBackendHealth } from "@/lib/api";
import { PreviewData } from "@/lib/types";
import { VirtualGrid } from "@/components/preview/VirtualGrid";
import { SheetTabs } from "@/components/preview/SheetTabs";
import { ChatDock } from "@/components/analyst/ChatDock";

export default function Home() {
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataset, setDataset] = useState<PreviewData | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>("Sheet1");

  useEffect(() => {
    checkBackendHealth().then((status) => setBackendOnline(status));
  }, []);

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const data = await uploadAndPreviewFile(file);
      setDataset(data);
      if (data.sheets && data.sheets.length > 0) {
        setActiveSheet(data.sheets[0]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to parse and preview file.");
    } finally {
      setLoading(false);
    }
  };

  const loadSampleDataset = () => {
    // Demo fallback dataset
    const sampleData: PreviewData = {
      filename: "customer_churn_q3.parquet",
      format: "parquet",
      content_hash: "8f3b49c0e29b47a6d81234ef",
      total_rows: 15420,
      total_columns: 6,
      schema_fields: [
        { name: "customer_id", type: "string" },
        { name: "tenure_months", type: "int64" },
        { name: "monthly_charges", type: "float64" },
        { name: "contract_type", type: "string" },
        { name: "email", type: "string" },
        { name: "churned", type: "boolean" },
      ],
      preview_rows: [
        { customer_id: "CUST-1001", tenure_months: 12, monthly_charges: 65.5, contract_type: "Month-to-month", email: "user1@example.com", churned: true },
        { customer_id: "CUST-1002", tenure_months: 34, monthly_charges: 89.2, contract_type: "One year", email: "alex99@gmail.com", churned: false },
        { customer_id: "CUST-1003", tenure_months: 2, monthly_charges: 29.0, contract_type: "Month-to-month", email: "j.doe@company.org", churned: true },
        { customer_id: "CUST-1004", tenure_months: 48, monthly_charges: 104.5, contract_type: "Two year", email: "sarah_m@domain.com", churned: false },
        { customer_id: "CUST-1005", tenure_months: 21, monthly_charges: 75.0, contract_type: "Month-to-month", email: "client_test@mail.com", churned: false },
      ],
      column_stats: [
        { name: "customer_id", type: "string", null_count: 0, null_pct: 0, distinct_count: 15420, is_unique: true },
        { name: "tenure_months", type: "int64", null_count: 0, null_pct: 0, distinct_count: 65, is_unique: false, min: 1, max: 72, mean: 31.4 },
        { name: "monthly_charges", type: "float64", null_count: 42, null_pct: 0.27, distinct_count: 1420, is_unique: false, min: 18.5, max: 118.75, mean: 64.8 },
        { name: "contract_type", type: "string", null_count: 0, null_pct: 0, distinct_count: 3, is_unique: false },
        { name: "email", type: "string", null_count: 0, null_pct: 0, distinct_count: 15420, is_unique: true },
        { name: "churned", type: "boolean", null_count: 0, null_pct: 0, distinct_count: 2, is_unique: false },
      ],
      pii_flags: { email: "email" },
      quality_score: {
        overall_score: 96.5,
        completeness: 99.7,
        pii_risk_score: 80,
        flagged_pii_count: 1,
        issues: ["Detected PII in 1 column(s): email"],
      },
    };
    setDataset(sampleData);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-lg text-white">Strata</span>
              <span className="ml-2 text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Next.js 16 + DuckDB
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
              <span className={`w-2 h-2 rounded-full ${backendOnline ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              <span className="text-slate-300">FastAPI Backend: {backendOnline ? "Connected" : "Offline (Mock Mode)"}</span>
            </div>
            <a
              href="https://github.com/Jamesuchechi/Strata"
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full space-y-8">
        {/* Dropzone & Ingestion Bar */}
        <section className="relative rounded-2xl border border-dashed border-slate-800 bg-gradient-to-b from-slate-900/50 to-slate-950/80 p-8 text-center transition-all hover:border-slate-700">
          <input
            type="file"
            id="fileInput"
            className="hidden"
            accept=".csv,.tsv,.parquet,.pq,.xlsx,.xls,.json,.jsonl,.sdf,.mol,.geojson"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />
          <label htmlFor="fileInput" className="cursor-pointer flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
              <UploadCloud className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Drag & drop any dataset to preview & analyze</h2>
              <p className="text-xs text-slate-400 mt-1">
                Supports CSV, Excel (<span className="text-indigo-300 font-mono">.xlsx, .xls</span>), Parquet, JSON, PubChem (<span className="text-indigo-300 font-mono">.sdf</span>), and GeoJSON
              </p>
            </div>
          </label>

          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => document.getElementById("fileInput")?.click()}
              disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm"
            >
              {loading ? "Parsing File..." : "Browse Local Files"}
            </button>
            <button
              onClick={loadSampleDataset}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              Load Sample Parquet Dataset
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </section>

        {/* Dataset Workspace View */}
        {dataset && (
          <section className="space-y-6">
            {/* Quick Metrics Header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
                <span className="text-[11px] text-slate-500 font-mono uppercase">Dataset File</span>
                <p className="text-sm font-semibold text-white truncate mt-1">{dataset.filename}</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
                <span className="text-[11px] text-slate-500 font-mono uppercase">Format & Rows</span>
                <p className="text-sm font-semibold text-indigo-400 mt-1 font-mono">
                  {dataset.format.toUpperCase()} · {dataset.total_rows.toLocaleString()} rows
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
                <span className="text-[11px] text-slate-500 font-mono uppercase">Columns</span>
                <p className="text-sm font-semibold text-white mt-1 font-mono">{dataset.total_columns} cols</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
                <span className="text-[11px] text-slate-500 font-mono uppercase">Quality Score</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <p className="text-sm font-semibold text-emerald-400 font-mono">
                    {dataset.quality_score?.overall_score ?? 100}%
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
                <span className="text-[11px] text-slate-500 font-mono uppercase">PII Guard</span>
                <div className="flex items-center gap-1.5 mt-1">
                  {dataset.pii_flags && Object.keys(dataset.pii_flags).length > 0 ? (
                    <>
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      <p className="text-sm font-semibold text-rose-400 font-mono">
                        {Object.keys(dataset.pii_flags).length} Flagged
                      </p>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-slate-400" />
                      <p className="text-sm font-semibold text-slate-300 font-mono">Clean</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Split View: Virtual Grid & AI Chat Dock */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Virtual Data Grid */}
              <div className="lg:col-span-2 space-y-2">
                <SheetTabs
                  sheets={dataset.sheets || []}
                  activeSheet={activeSheet}
                  onSelectSheet={setActiveSheet}
                />
                <VirtualGrid
                  columns={dataset.schema_fields}
                  rows={dataset.preview_rows}
                  columnStats={dataset.column_stats}
                  piiFlags={dataset.pii_flags}
                />
              </div>

              {/* Conversational Analyst */}
              <div className="lg:col-span-1">
                <ChatDock viewName={`view_${dataset.content_hash.slice(0, 10)}`} />
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-6 text-center text-xs text-slate-500 font-mono">
        Strata — Version control for data · The AI-native Data Science Studio
      </footer>
    </div>
  );
}
