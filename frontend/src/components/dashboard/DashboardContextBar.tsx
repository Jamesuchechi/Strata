"use client";

import React, { useState } from "react";
import {
  X,
  BarChart3,
  Code2,
  GitBranch,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  TrendingUp,
  Cpu,
  Layers,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

interface SelectedColumn {
  name: string;
  type: string;
  nullCount: number;
  nullPercentage: number;
  uniqueCount: number;
  min?: string | number;
  max?: string | number;
  mean?: string | number;
  hasPiiAlert?: boolean;
}

interface DashboardContextBarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedColumn?: SelectedColumn | null;
  activeContextMode?: "column" | "sql" | "git" | "analyst";
}

export function DashboardContextBar({
  isOpen,
  onClose,
  selectedColumn = {
    name: "revenue_usd",
    type: "DOUBLE",
    nullCount: 24,
    nullPercentage: 0.8,
    uniqueCount: 1420,
    min: "$12.50",
    max: "$9,450.00",
    mean: "$1,842.30",
    hasPiiAlert: false,
  },
  activeContextMode = "column",
}: DashboardContextBarProps) {
  const [activeTab, setActiveTab] = useState<"column" | "sql" | "git" | "analyst">(
    activeContextMode
  );
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <aside className="w-80 h-[calc(100vh-3.5rem)] sticky top-14 bg-[#FAF8F5] border-l border-[#E8E4DF] flex flex-col justify-between select-none z-30 shadow-lg sm:shadow-none animate-in slide-in-from-right-10 duration-200">
      {/* Header */}
      <div>
        <div className="p-3 border-b border-[#E8E4DF] flex items-center justify-between bg-white/70">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#1E1915]">Context Inspector</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#EFECE6] text-[#736B63]">
              {activeTab.toUpperCase()}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#8C827A] hover:text-[#1E1915] hover:bg-[#EFECE6] transition-colors"
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
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-1 px-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
                activeTab === tab.id
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
        {/* TAB 1: COLUMN PROFILER */}
        {activeTab === "column" && selectedColumn && (
          <div className="space-y-4">
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
            </div>

            {/* Quality & PII Checks */}
            <div className="p-3 rounded-xl bg-white border border-[#E8E4DF] space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#1E1915]">
                <ShieldCheck className="w-4 h-4 text-[#057A55]" />
                <span>Zero-PII Compliance</span>
              </div>
              <p className="text-[11px] text-[#5C554D]">
                No plaintext Social Security numbers, tokens, or credit cards detected in this column.
              </p>
            </div>

            {/* Distribution Summary */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#8C827A] block">
                Summary Statistics
              </span>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-[#FAF8F5]">
                  <span className="text-[10px] text-[#8C827A] block">Unique Values</span>
                  <span className="font-mono font-bold text-[#1E1915]">{selectedColumn.uniqueCount}</span>
                </div>
                <div className="p-2 rounded-xl bg-[#FAF8F5]">
                  <span className="text-[10px] text-[#8C827A] block">Null Count</span>
                  <span className="font-mono font-bold text-amber-700">
                    {selectedColumn.nullCount} ({selectedColumn.nullPercentage}%)
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-[#FAF8F5]">
                  <span className="text-[10px] text-[#8C827A] block">Min Value</span>
                  <span className="font-mono font-bold text-[#1E1915]">{selectedColumn.min ?? "N/A"}</span>
                </div>
                <div className="p-2 rounded-xl bg-[#FAF8F5]">
                  <span className="text-[10px] text-[#8C827A] block">Max Value</span>
                  <span className="font-mono font-bold text-[#1E1915]">{selectedColumn.max ?? "N/A"}</span>
                </div>
              </div>

              {/* Mini Sparkline Histogram Bar Simulation */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[10px] font-mono text-[#8C827A]">
                  <span>Distribution</span>
                  <span>Mean: {selectedColumn.mean}</span>
                </div>
                <div className="flex items-end gap-1 h-12 bg-[#FAF8F5] p-1.5 rounded-xl">
                  {[20, 35, 55, 80, 100, 75, 45, 30, 15, 10].map((h, i) => (
                    <div
                      key={i}
                      style={{ height: `${h}%` }}
                      className="flex-1 bg-[#0061FE]/70 hover:bg-[#0061FE] rounded-t-xs transition-colors"
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Imputation Actions */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#8C827A] block px-1">
                Quick Transformations
              </span>
              <div className="space-y-1">
                <button
                  onClick={() => alert("Null rows dropped via DuckDB")}
                  className="w-full text-left px-3 py-2 rounded-xl bg-white hover:bg-[#EFECE6] border border-[#E8E4DF] text-xs font-semibold text-[#1E1915] flex items-center justify-between"
                >
                  <span>Drop {selectedColumn.nullCount} Null Rows</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#8C827A]" />
                </button>
                <button
                  onClick={() => alert("Filled with column median via Polars")}
                  className="w-full text-left px-3 py-2 rounded-xl bg-white hover:bg-[#EFECE6] border border-[#E8E4DF] text-xs font-semibold text-[#1E1915] flex items-center justify-between"
                >
                  <span>Fill Nulls with Median</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#8C827A]" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: QUERY PLAN */}
        {activeTab === "sql" && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-[#1E1915] text-white space-y-2 font-mono">
              <div className="flex items-center justify-between text-[11px] text-[#A89F95]">
                <span>Execution Metrics</span>
                <span className="text-emerald-400">12.4ms</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div>
                  <span className="text-[10px] text-[#8C827A] block">Rows Scanned</span>
                  <span className="font-bold">1,420,500</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#8C827A] block">Peak Memory</span>
                  <span className="font-bold">14.2 MB</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white border border-[#E8E4DF] space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#8C827A]">
                DuckDB EXPLAIN Operator Tree
              </span>
              <div className="space-y-1.5 font-mono text-[11px] text-[#1E1915]">
                <div className="p-1.5 rounded bg-[#FAF8F5] border border-[#E8E4DF]">
                  ▶ PROJECTION [revenue, user_id]
                </div>
                <div className="p-1.5 rounded bg-[#FAF8F5] border border-[#E8E4DF] ml-3">
                  ▶ FILTER (status = &apos;completed&apos;)
                </div>
                <div className="p-1.5 rounded bg-[#FAF8F5] border border-[#E8E4DF] ml-6">
                  ▶ PARQUET_SCAN [telecom_churn.parquet]
                </div>
              </div>
            </div>

            <button
              onClick={() => handleCopyCode("import polars as pl\ndf = pl.read_parquet('telecom_churn.parquet')\nprint(df.filter(pl.col('status') == 'completed'))")}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white border border-[#D6D0C7] text-xs font-semibold text-[#1E1915] hover:bg-[#FAF8F5]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#057A55]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied Polars Code" : "Copy as Python / Polars"}</span>
            </button>
          </div>
        )}

        {/* TAB 3: GIT VERSION DIFF */}
        {activeTab === "git" && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#8C827A]">
                  Active Snapshot
                </span>
                <span className="font-mono text-[10px] text-[#736B63]">v1.2-imputed</span>
              </div>
              <h4 className="font-bold text-[#1E1915]">Cleaned missing revenues & encrypted PII</h4>
              <p className="text-[11px] text-[#736B63]">Authored by Ada Lovelace 42m ago</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#8C827A] block">
                Delta Summary
              </span>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-emerald-700">
                  <span>+ Rows Inserted</span>
                  <span className="font-bold">+1,240</span>
                </div>
                <div className="flex justify-between text-rose-700">
                  <span>- Rows Deduplicated</span>
                  <span className="font-bold">-45</span>
                </div>
                <div className="flex justify-between text-[#0061FE]">
                  <span>~ Columns Modified</span>
                  <span className="font-bold">3 cols</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => alert("Dataset reverted to previous snapshot.")}
              className="w-full py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition-colors"
            >
              Rollback to v1.1-raw
            </button>
          </div>
        )}

        {/* TAB 4: AI ANALYST GROUNDING */}
        {activeTab === "analyst" && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-[#0061FE]/5 border border-[#0061FE]/20 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#0061FE]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Schema-Verified Grounding</span>
              </div>
              <p className="text-[11px] text-[#1E1915]/80 leading-relaxed">
                Strata validates all generated analytical questions against DuckDB catalog types before returning responses.
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#8C827A] block px-1">
                Suggested Prompts
              </span>
              {[
                "Which customer segment drove the highest churn in Q3?",
                "Calculate rolling 30-day average transaction size",
                "Find 3 outliers exceeding 3 standard deviations",
              ].map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => alert(`Running AI prompt: "${prompt}"`)}
                  className="w-full text-left p-2.5 rounded-xl bg-white hover:bg-[#EFECE6] border border-[#E8E4DF] text-[11px] text-[#1E1915] font-medium leading-snug"
                >
                  &ldquo;{prompt}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-[#E8E4DF] bg-white/50 text-[10px] font-mono text-[#8C827A] flex items-center justify-between">
        <span>Strata Studio v0.1</span>
        <span>Cmd+I to toggle</span>
      </div>
    </aside>
  );
}
