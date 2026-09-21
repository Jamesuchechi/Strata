"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Code2,
  Play,
  Database,
  Layers,
  Sparkles,
  Download,
  Copy,
  Check,
  Zap,
  Clock,
  AlertCircle,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { executeQuery, fetchDatasets } from "@/lib/api";
import { QueryResult, DatasetItem } from "@/lib/types";
import { useStudio } from "@/context/StudioContext";

export default function QueryPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-xs text-[#8C827A]">Loading DuckDB query studio...</div>}>
      <QueryContent />
    </React.Suspense>
  );
}

function QueryContent() {
  const { setActiveQueryPlan, setActiveContextTab } = useStudio();
  const searchParams = useSearchParams();
  const initialViewParam = searchParams.get("view");

  const [selectedView, setSelectedView] = useState<string>(initialViewParam || "");
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [sqlQuery, setSqlQuery] = useState<string>(
    initialViewParam ? `SELECT * FROM ${initialViewParam} LIMIT 25;` : ""
  );
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [copiedQuery, setCopiedQuery] = useState(false);

  useEffect(() => {
    fetchDatasets()
      .then((data) => {
        setDatasets(data);
        if (data.length > 0 && !searchParams.get("view")) {
          const firstView = data[0].view_name || `view_${data[0].id}`;
          setSelectedView(firstView);
          setSqlQuery(`SELECT * FROM ${firstView} LIMIT 25;`);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  const handleExecute = async () => {
    if (!sqlQuery.trim()) return;
    setIsExecuting(true);
    setResult(null);

    const startTime = performance.now();
    try {
      const res = await executeQuery(selectedView, sqlQuery);
      const endTime = performance.now();
      const timeMs = Math.round(endTime - startTime);
      setExecutionTimeMs(timeMs);
      setResult(res);

      setActiveQueryPlan({
        sql: sqlQuery,
        executionTimeMs: timeMs,
        rowCount: res.row_count,
        columns: res.columns,
        viewName: selectedView,
      });
      setActiveContextTab("sql");
    } catch (err: any) {
      const endTime = performance.now();
      const timeMs = Math.round(endTime - startTime);
      setExecutionTimeMs(timeMs);
      const failResult = {
        success: false,
        row_count: 0,
        columns: [],
        data: [],
        error: err.message || "Query execution failed.",
      };
      setResult(failResult);
      setActiveQueryPlan({
        sql: sqlQuery,
        executionTimeMs: timeMs,
        rowCount: 0,
        columns: [],
        viewName: selectedView,
        error: err.message || "Query execution failed.",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleExecute();
    }
  };

  const copySql = () => {
    navigator.clipboard.writeText(sqlQuery);
    setCopiedQuery(true);
    setTimeout(() => setCopiedQuery(false), 2000);
  };

  const selectView = (viewName: string) => {
    setSelectedView(viewName);
    setSqlQuery(`SELECT * FROM ${viewName} LIMIT 25;`);
  };

  const exportCSV = () => {
    if (!result || !result.data.length) return;
    const headers = result.columns.join(",");
    const rows = result.data.map((r) =>
      result.columns.map((col) => `"${String(r[col] ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `strata_query_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F5F2] overflow-hidden">
      {/* Top Header */}
      <div className="border-b border-[#E8E4DF] bg-white px-6 py-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#0061FE]/10 text-[#0061FE]">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-[#1E1915]">
              DuckDB SQL Studio
            </h1>
            <p className="text-xs text-[#8C827A]">
              Vectorized in-memory SQL execution over zero-copy Arrow memory buffers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono">
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            <span>DuckDB 1.5 Active</span>
          </div>

          <button
            onClick={handleExecute}
            disabled={isExecuting}
            className="px-4 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold flex items-center gap-2 shadow-sm shadow-[#0061FE]/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isExecuting ? "animate-spin" : ""}`} />
            <span>{isExecuting ? "Executing..." : "Run Query"}</span>
            <kbd className="hidden md:inline font-mono text-[9px] bg-white/20 px-1.5 py-0.5 rounded ml-1">
              ⌘↵
            </kbd>
          </button>
        </div>
      </div>

      {/* Main Studio Body: 2 Columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Drawer: Views & Schema Catalog */}
        <aside className="w-64 border-r border-[#E8E4DF] bg-[#FAF8F5] p-3 overflow-y-auto space-y-4 shrink-0 hidden lg:block">
          <div>
            <div className="text-[10px] font-mono uppercase text-[#8C827A] px-2 mb-2 font-bold">
              Available DuckDB Views
            </div>
            <div className="space-y-1">
              {datasets.map((ds) => {
                const viewName = ds.view_name || `view_${ds.id}`;
                const isSelected = selectedView === viewName;

                return (
                  <button
                    key={ds.id}
                    onClick={() => selectView(viewName)}
                    className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition-all ${
                      isSelected
                        ? "bg-white text-[#0061FE] font-bold border border-[#E8E4DF] shadow-2xs"
                        : "text-[#5C554D] hover:bg-white/60 hover:text-[#1E1915]"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Database className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{viewName}</span>
                    </div>
                    <span className="text-[9px] font-mono px-1 rounded bg-[#F7F5F2] text-[#8C827A] uppercase">
                      {ds.format}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-[#E8E4DF]">
            <div className="text-[10px] font-mono uppercase text-[#8C827A] px-2 mb-2 font-bold">
              Sample Query Presets
            </div>
            <div className="space-y-1.5">
              {[
                { label: "Sample 25 Rows", sql: `SELECT * FROM ${selectedView} LIMIT 25;` },
                { label: "Aggregate Summary", sql: `SELECT COUNT(*) as total_rows FROM ${selectedView};` },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setSqlQuery(preset.sql)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] text-[#736B63] hover:text-[#1E1915] hover:bg-white border border-transparent hover:border-[#E8E4DF] transition-all"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Center: Editor + Results */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* SQL Editor Area */}
          <div className="h-48 border-b border-[#E8E4DF] bg-white flex flex-col shrink-0">
            <div className="px-4 py-2 border-b border-[#E8E4DF] bg-[#FAF8F5] flex items-center justify-between text-xs text-[#736B63]">
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span>Active Target:</span>
                <span className="font-bold text-[#0061FE]">{selectedView}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copySql}
                  className="flex items-center gap-1 hover:text-[#1E1915] text-[11px] p-1 rounded"
                >
                  {copiedQuery ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedQuery ? "Copied" : "Copy SQL"}</span>
                </button>
              </div>
            </div>

            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedView
                  ? `Write SQL query (e.g. SELECT * FROM ${selectedView} WHERE ...)`
                  : "Write SQL query (e.g. SELECT * FROM ...) [Press ⌘↵ to run]"
              }
              className="flex-1 p-4 font-mono text-xs text-[#1E1915] outline-none resize-none bg-white selection:bg-[#0061FE]/20"
              spellCheck={false}
            />
          </div>

          {/* Results Header */}
          <div className="px-6 py-2.5 bg-[#FAF8F5] border-b border-[#E8E4DF] flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-bold text-[#1E1915]">Execution Results</span>
              {executionTimeMs !== null && (
                <span className="flex items-center gap-1 font-mono text-[#057A55] text-[11px]">
                  <Clock className="w-3 h-3" />
                  <span>{executionTimeMs}ms</span>
                </span>
              )}
              {result && result.success && (
                <span className="font-mono text-[#736B63] text-[11px]">
                  {result.row_count} rows returned
                </span>
              )}
            </div>

            {result && result.data && result.data.length > 0 && (
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 text-xs text-[#0061FE] font-semibold hover:underline"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            )}
          </div>

          {/* Results Table Area */}
          <div className="flex-1 overflow-auto bg-white">
            {isExecuting ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3 text-[#736B63]">
                <div className="w-7 h-7 border-2 border-[#0061FE] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-mono">Running vectorized query on DuckDB engine...</p>
              </div>
            ) : result?.error ? (
              <div className="p-6">
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>SQL Error</span>
                  </div>
                  <pre className="font-mono text-[11px] whitespace-pre-wrap">{result.error}</pre>
                </div>
              </div>
            ) : result && result.data ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#FAF8F5] border-b border-[#E8E4DF] z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-12 font-mono text-[10px] text-[#8C827A] text-center border-r border-[#E8E4DF]">
                      #
                    </th>
                    {result.columns.map((col) => (
                      <th
                        key={col}
                        className="py-2.5 px-3 font-semibold text-[#1E1915] border-r border-[#E8E4DF]"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E4DF] font-mono text-[11px]">
                  {result.data.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#FAF8F5]/60">
                      <td className="py-2 px-3 text-[#8C827A] text-center bg-[#FAF8F5]/30 border-r border-[#E8E4DF] text-[10px]">
                        {idx + 1}
                      </td>
                      {result.columns.map((col) => (
                        <td
                          key={col}
                          className="py-2 px-3 border-r border-[#E8E4DF] truncate max-w-[260px] text-[#1E1915]"
                        >
                          {row[col] === null ? "null" : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2 text-[#8C827A]">
                <Code2 className="w-8 h-8 stroke-1 text-[#D6D0C7]" />
                <p className="text-xs">Write a query above and press <strong>Run Query</strong> (⌘↵)</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
