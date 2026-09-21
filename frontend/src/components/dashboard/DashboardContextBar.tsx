"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  X,
  BarChart3,
  Code2,
  GitBranch,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  Zap,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Database,
  Info,
} from "lucide-react";
import { useStudio } from "@/context/StudioContext";

export function DashboardContextBar() {
  const {
    isContextBarOpen,
    setIsContextBarOpen,
    activeContextTab,
    setActiveContextTab,
    selectedColumn,
    activeDataset,
    activeQueryPlan,
    activeCommit,
  } = useStudio();

  const [copied, setCopied] = useState(false);

  if (!isContextBarOpen) return null;

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const datasetName =
    activeDataset?.filename ||
    (activeDataset as any)?.name ||
    "None Active";

  return (
    <aside className="w-80 h-full shrink-0 bg-[#FAF8F5] border-l border-[#E8E4DF] flex flex-col justify-between select-none z-30 shadow-lg sm:shadow-none animate-in slide-in-from-right-10 duration-200">
      {/* Header */}
      <div>
        <div className="p-3 border-b border-[#E8E4DF] flex items-center justify-between bg-white/70">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#1E1915]">Context Inspector</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#EFECE6] text-[#736B63]">
              {activeContextTab.toUpperCase()}
            </span>
          </div>
          <button
            onClick={() => setIsContextBarOpen(false)}
            className="p-1 rounded-lg text-[#8C827A] hover:text-[#1E1915] hover:bg-[#EFECE6] transition-colors cursor-pointer"
            title="Close Inspector (⌘I)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex p-1.5 gap-1 bg-[#FAF8F5] border-b border-[#E8E4DF] text-[11px] font-semibold">
          {[
            { id: "column", label: "Column", icon: <BarChart3 className="w-3.5 h-3.5" /> },
            { id: "sql", label: "Query Plan", icon: <Code2 className="w-3.5 h-3.5" /> },
            { id: "git", label: "Version Diff", icon: <GitBranch className="w-3.5 h-3.5" /> },
            { id: "analyst", label: "AI Grounding", icon: <Sparkles className="w-3.5 h-3.5 text-[#0061FE]" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveContextTab(tab.id as any)}
              className={`flex-1 py-1 px-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                activeContextTab === tab.id
                  ? "bg-white text-[#0061FE] font-bold shadow-2xs border border-[#E8E4DF]"
                  : "text-[#736B63] hover:text-[#1E1915]"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* TAB 1: REAL COLUMN PROFILER */}
        {activeContextTab === "column" && (
          <div className="space-y-4">
            {selectedColumn ? (
              <>
                {/* Column Title Card */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#8C827A]">
                      Selected Column
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#0061FE]/10 text-[#0061FE] text-[10px] font-mono font-bold">
                      {selectedColumn.type}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold font-mono text-[#1E1915] truncate">
                    {selectedColumn.name}
                  </h3>
                  <div className="text-[11px] text-[#736B63] flex items-center gap-1">
                    <Database className="w-3 h-3 text-[#0061FE]" />
                    <span className="truncate">{datasetName}</span>
                  </div>
                </div>

                {/* Real Distribution Summary */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-3">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#8C827A] block">
                    Calculated Statistics
                  </span>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-[#FAF8F5]">
                      <span className="text-[10px] text-[#8C827A] block">Unique Values</span>
                      <span className="font-mono font-bold text-[#1E1915]">
                        {selectedColumn.distinct_count}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-[#FAF8F5]">
                      <span className="text-[10px] text-[#8C827A] block">Null Count</span>
                      <span className={`font-mono font-bold ${selectedColumn.null_count > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                        {selectedColumn.null_count} ({selectedColumn.null_pct}%)
                      </span>
                    </div>

                    {selectedColumn.min !== undefined && (
                      <>
                        <div className="p-2 rounded-xl bg-[#FAF8F5]">
                          <span className="text-[10px] text-[#8C827A] block">Min Value</span>
                          <span className="font-mono font-bold text-[#1E1915] truncate block">
                            {selectedColumn.min}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-[#FAF8F5]">
                          <span className="text-[10px] text-[#8C827A] block">Max Value</span>
                          <span className="font-mono font-bold text-[#1E1915] truncate block">
                            {selectedColumn.max}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-[#FAF8F5]">
                          <span className="text-[10px] text-[#8C827A] block">Mean</span>
                          <span className="font-mono font-bold text-[#1E1915]">
                            {selectedColumn.mean !== undefined ? selectedColumn.mean.toFixed(2) : "N/A"}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-[#FAF8F5]">
                          <span className="text-[10px] text-[#8C827A] block">Median</span>
                          <span className="font-mono font-bold text-[#1E1915]">
                            {selectedColumn.median !== undefined ? selectedColumn.median.toFixed(2) : "N/A"}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Real Sparkline Histogram */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[10px] font-mono text-[#8C827A]">
                      <span>Distribution Profile</span>
                      <span>Unique: {selectedColumn.is_unique ? "Yes" : "No"}</span>
                    </div>
                    {(() => {
                      const dist =
                        (selectedColumn.distribution && selectedColumn.distribution.length > 0)
                          ? selectedColumn.distribution
                          : (selectedColumn.sparkline && selectedColumn.sparkline.length > 0)
                          ? selectedColumn.sparkline
                          : [];
                      const hasValues = dist.length > 0 && dist.some((c) => c > 0);

                      if (!hasValues) {
                        return (
                          <div className="h-12 bg-[#FAF8F5] p-2 rounded-xl border border-[#E8E4DF] flex items-center justify-center text-[10px] font-mono text-[#8C827A] text-center">
                            Discrete / high-cardinality text (no distribution curve)
                          </div>
                        );
                      }

                      const maxVal = Math.max(...dist) || 1;
                      return (
                        <div className="flex items-end gap-1 h-14 bg-[#FAF8F5] p-2 rounded-xl border border-[#E8E4DF]">
                          {dist.map((count, i) => {
                            const heightPct = Math.max(10, Math.round((count / maxVal) * 100));
                            return (
                              <div
                                key={i}
                                title={`Bin ${i + 1}: ${count} rows`}
                                style={{ height: `${heightPct}%` }}
                                className="flex-1 bg-[#0061FE] hover:bg-[#0052D4] rounded-t-xs transition-all cursor-pointer"
                              />
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* AI Investigation Link */}
                <Link
                  href={`/analyst?dataset=${datasetName}&question=Analyze distribution and outliers of ${selectedColumn.name}`}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#0061FE]/10 text-[#0061FE] hover:bg-[#0061FE] hover:text-white font-semibold text-xs transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask AI about {selectedColumn.name}</span>
                </Link>
              </>
            ) : (
              <div className="p-6 text-center rounded-2xl bg-white border border-[#E8E4DF] space-y-3">
                <div className="w-10 h-10 mx-auto rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] flex items-center justify-center text-[#8C827A]">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-[#1E1915]">No Column Selected</h4>
                  <p className="text-xs text-[#8C827A] leading-relaxed">
                    Click any column header in the table previewer to see its real micro-statistics, distribution histogram, and null profile.
                  </p>
                </div>
                <Link
                  href="/datasets"
                  className="inline-flex items-center gap-1 text-xs text-[#0061FE] font-semibold hover:underline"
                >
                  <span>Open Universal Previewer</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: REAL QUERY PLAN */}
        {activeContextTab === "sql" && (
          <div className="space-y-4">
            {activeQueryPlan ? (
              <>
                <div className="p-3.5 rounded-2xl bg-[#1E1915] text-white space-y-2 font-mono">
                  <div className="flex items-center justify-between text-[11px] text-[#A89F95]">
                    <span>DuckDB Execution</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      {activeQueryPlan.executionTimeMs !== undefined ? `${activeQueryPlan.executionTimeMs}ms` : "< 2ms"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-white/10">
                    <div>
                      <span className="text-[10px] text-[#8C827A] block">Rows Returned</span>
                      <span className="font-bold">
                        {activeQueryPlan.rowCount !== undefined ? activeQueryPlan.rowCount.toLocaleString() : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#8C827A] block">Columns</span>
                      <span className="font-bold">
                        {activeQueryPlan.columns ? activeQueryPlan.columns.length : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-[#E8E4DF] space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#8C827A]">
                    Executed SQL Statement
                  </span>
                  <pre className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] font-mono text-[11px] text-[#1E1915] whitespace-pre-wrap overflow-x-auto">
                    {activeQueryPlan.sql}
                  </pre>
                </div>

                <button
                  onClick={() => handleCopyCode(activeQueryPlan.sql)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white border border-[#D6D0C7] text-xs font-semibold text-[#1E1915] hover:bg-[#FAF8F5] cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#057A55]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied SQL" : "Copy SQL Statement"}</span>
                </button>
              </>
            ) : (
              <div className="p-6 text-center rounded-2xl bg-white border border-[#E8E4DF] space-y-3">
                <div className="w-10 h-10 mx-auto rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] flex items-center justify-center text-[#8C827A]">
                  <Code2 className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-[#1E1915]">No Query Executed Yet</h4>
                  <p className="text-xs text-[#8C827A] leading-relaxed">
                    Execute a SQL statement in the DuckDB SQL Studio to inspect its runtime performance, scanned row count, and query plan.
                  </p>
                </div>
                <Link
                  href="/query"
                  className="inline-flex items-center gap-1 text-xs text-[#0061FE] font-semibold hover:underline"
                >
                  <span>Go to SQL Studio</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: REAL GIT VERSION DIFF */}
        {activeContextTab === "git" && (
          <div className="space-y-4">
            {activeCommit ? (
              <>
                <div className="p-3.5 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#8C827A]">
                      Active Version Snapshot
                    </span>
                    <span className="font-mono text-[10px] font-bold text-[#0061FE] bg-[#0061FE]/10 px-2 py-0.5 rounded-full">
                      {activeCommit.version}
                    </span>
                  </div>
                  <h4 className="font-bold text-[#1E1915] text-xs leading-snug">
                    {activeCommit.message}
                  </h4>
                  <div className="flex items-center justify-between text-[11px] text-[#736B63] pt-1 border-t border-[#E8E4DF]/60 font-mono">
                    <span>{activeCommit.author}</span>
                    <span>{activeCommit.date}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-3">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#8C827A] block">
                    Structural Deltas
                  </span>
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-[#1E1915]">
                      <span>Rows Delta</span>
                      <span className="font-bold">{activeCommit.deltaRows || "+0 rows"}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700">
                      <span>Columns Added</span>
                      <span className="font-bold">{activeCommit.deltaColumns || "+0 columns"}</span>
                    </div>
                  </div>

                  {activeCommit.addedCols && activeCommit.addedCols.length > 0 && (
                    <div className="pt-2 border-t border-[#E8E4DF] space-y-1">
                      <span className="text-[10px] text-[#8C827A] block">Added Columns:</span>
                      <div className="flex flex-wrap gap-1">
                        {activeCommit.addedCols.map((c) => (
                          <span
                            key={c}
                            className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-mono border border-emerald-200"
                          >
                            +{c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Link
                  href="/versions"
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-[#E8E4DF] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] transition-colors"
                >
                  <GitBranch className="w-3.5 h-3.5 text-[#0061FE]" />
                  <span>Open Full Git Diff Studio</span>
                </Link>
              </>
            ) : (
              <div className="p-6 text-center rounded-2xl bg-white border border-[#E8E4DF] space-y-3">
                <div className="w-10 h-10 mx-auto rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] flex items-center justify-center text-[#8C827A]">
                  <GitBranch className="w-5 h-5 text-purple-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-[#1E1915]">No Snapshot Selected</h4>
                  <p className="text-xs text-[#8C827A] leading-relaxed">
                    Select a version commit from the Git lineage timeline to view row deltas and column schema mutations.
                  </p>
                </div>
                <Link
                  href="/versions"
                  className="inline-flex items-center gap-1 text-xs text-[#0061FE] font-semibold hover:underline"
                >
                  <span>Open Git Versions</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: REAL AI ANALYST GROUNDING */}
        {activeContextTab === "analyst" && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-[#0061FE]/5 border border-[#0061FE]/20 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#0061FE]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Deterministic Grounding</span>
              </div>
              <p className="text-[11px] text-[#1E1915]/80 leading-relaxed">
                Strata validates questions against the verified schema of{" "}
                <strong className="font-mono text-[#0061FE]">{datasetName}</strong>.
              </p>
            </div>

            {/* If dataset has columns, list them dynamically */}
            {activeDataset && "schema_fields" in activeDataset && activeDataset.schema_fields && (
              <div className="p-3.5 rounded-2xl bg-white border border-[#E8E4DF] space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#8C827A] block">
                  Grounding Schema ({activeDataset.schema_fields.length} Columns)
                </span>
                <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                  {activeDataset.schema_fields.map((f) => (
                    <span
                      key={f.name}
                      className="px-2 py-0.5 rounded-md bg-[#FAF8F5] border border-[#E8E4DF] text-[10px] font-mono text-[#1E1915]"
                    >
                      {f.name} <span className="text-[#8C827A]">({f.type})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Link
              href={`/analyst?dataset=${datasetName}`}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold shadow-sm transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask AI Analyst</span>
            </Link>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-[#E8E4DF] bg-white/50 text-[10px] font-mono text-[#8C827A] flex items-center justify-between">
        <span>DuckDB-WASM Grounded</span>
        <span>⌘I toggle</span>
      </div>
    </aside>
  );
}
