"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileSpreadsheet,
  Database,
  FileText,
  Code2,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Download,
  GitCommit,
  Layers,
  Search,
  Filter,
  BarChart3,
  Copy,
  Check,
  Maximize2,
  Table as TableIcon,
  ChevronDown,
  Info,
} from "lucide-react";
import { fetchDatasetPreview } from "@/lib/api";
import { PreviewData, ColumnStat } from "@/lib/types";
import { useStudio } from "@/context/StudioContext";

export default function DatasetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const datasetId = resolvedParams.id;
  const router = useRouter();

  const {
    setSelectedColumn: setStudioColumn,
    setActiveContextTab,
    setActiveDataset,
    setIsContextBarOpen,
  } = useStudio();

  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [activeSheet, setActiveSheet] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<ColumnStat | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [copiedHash, setCopiedHash] = useState(false);

  const loadPreview = async (sheet?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchDatasetPreview(datasetId, sheet);
      setPreviewData(data);
      setActiveDataset(data);
      if (data.active_sheet) {
        setActiveSheet(data.active_sheet);
      } else if (data.sheets && data.sheets.length > 0 && !sheet) {
        setActiveSheet(data.sheets[0]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load dataset preview");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPreview();
  }, [datasetId]);

  const handleColumnSelect = (colName: string, colType: string) => {
    const stat = getColStat(colName) || {
      name: colName,
      type: colType,
      null_count: 0,
      null_pct: 0,
      distinct_count: 0,
      is_unique: false,
    };
    setSelectedColumn(stat);
    setStudioColumn(stat);
    setActiveContextTab("column");
    setIsContextBarOpen(true);
  };

  const handleSheetChange = (sheet: string) => {
    setActiveSheet(sheet);
    loadPreview(sheet);
  };

  const copyHash = () => {
    if (previewData?.content_hash) {
      navigator.clipboard.writeText(previewData.content_hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  // Find column stat helper
  const getColStat = (colName: string): ColumnStat | undefined => {
    return previewData?.column_stats?.find((s) => s.name === colName);
  };

  // Filter rows based on search
  const filteredRows = (previewData?.preview_rows || []).filter((row) => {
    if (!searchFilter.trim()) return true;
    return Object.values(row).some((val) =>
      String(val).toLowerCase().includes(searchFilter.toLowerCase())
    );
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F5F2] overflow-hidden">
      {/* Top Action & Breadcrumb Bar */}
      <div className="border-b border-[#E8E4DF] bg-white/90 backdrop-blur-sm px-6 py-3 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-3">
          <Link
            href="/datasets"
            className="p-1.5 rounded-lg border border-[#E8E4DF] hover:bg-[#FAF8F5] text-[#736B63] hover:text-[#1E1915] transition-colors"
            title="Back to Datasets"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-[#1E1915] truncate">
                {previewData?.filename || datasetId}
              </h1>
              {previewData?.format && (
                <span className="px-2 py-0.5 rounded-full bg-[#FAF8F5] border border-[#E8E4DF] text-[10px] font-mono uppercase font-bold text-[#736B63]">
                  {previewData.format}
                </span>
              )}
            </div>

            {previewData?.content_hash && (
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#8C827A] mt-0.5">
                <span>SHA-256: {previewData.content_hash.slice(0, 16)}...</span>
                <button
                  onClick={copyHash}
                  className="p-0.5 hover:text-[#1E1915] transition-colors"
                  title="Copy full hash"
                >
                  {copiedHash ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right CTA Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {previewData?.quality_score && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{previewData.quality_score.overall_score}% Clean</span>
            </div>
          )}

          <Link
            href={`/query?view=${previewData?.view_name || "view_" + datasetId}`}
            className="px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 transition-colors"
          >
            <Code2 className="w-3.5 h-3.5 text-[#0061FE]" />
            <span>SQL Studio</span>
          </Link>

          <Link
            href={`/analyst?dataset=${previewData?.filename || datasetId}`}
            className="px-3 py-1.5 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Analyst</span>
          </Link>
        </div>
      </div>

      {/* Multi-Sheet Workbook Switcher (If Excel) */}
      {previewData?.sheets && previewData.sheets.length > 1 && (
        <div className="border-b border-[#E8E4DF] bg-[#FAF8F5] px-6 py-2 flex items-center gap-2 overflow-x-auto shrink-0 select-none">
          <div className="flex items-center gap-1.5 text-xs text-[#8C827A] font-semibold mr-2 shrink-0">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Workbook Sheets:</span>
          </div>
          {previewData.sheets.map((sheet) => (
            <button
              key={sheet}
              onClick={() => handleSheetChange(sheet)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                activeSheet === sheet
                  ? "bg-white text-[#0061FE] border border-[#E8E4DF] shadow-2xs font-bold"
                  : "text-[#736B63] hover:text-[#1E1915] hover:bg-white/60"
              }`}
            >
              {sheet}
            </button>
          ))}
        </div>
      )}

      {/* PII Alert Banner if detected */}
      {previewData?.pii_flags && Object.keys(previewData.pii_flags).length > 0 && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>PII Caution:</strong> Sensitive information detected in columns:{" "}
              {Object.entries(previewData.pii_flags)
                .map(([col, type]) => `${col} (${type})`)
                .join(", ")}
            </span>
          </div>
          <span className="text-[10px] font-mono uppercase bg-amber-200/60 px-2 py-0.5 rounded font-bold">
            Masking Available
          </span>
        </div>
      )}

      {/* Grid Controls Toolbar */}
      <div className="px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C827A]" />
            <input
              type="text"
              placeholder="Search table values..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border border-[#E8E4DF] focus:border-[#0061FE] text-xs text-[#1E1915] outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-[#736B63] font-mono">
          <span>
            Showing <strong>{filteredRows.length}</strong> of{" "}
            <strong>{previewData?.total_rows.toLocaleString() || 0}</strong> rows
          </span>
          <span>·</span>
          <span>
            <strong>{previewData?.total_columns || 0}</strong> columns
          </span>
        </div>
      </div>

      {/* Main Table & Profiler Container */}
      <div className="flex-1 flex overflow-hidden px-6 pb-6 gap-4">
        {/* Virtualized Data Grid */}
        <div className="flex-1 bg-white rounded-2xl border border-[#E8E4DF] shadow-2xs overflow-auto relative">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-3 text-[#736B63]">
              <div className="w-8 h-8 border-2 border-[#0061FE] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-mono">Streaming virtual preview rows...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full space-y-2 text-rose-600 p-6 text-center">
              <p className="font-bold text-sm">Failed to load preview</p>
              <p className="text-xs text-[#8C827A]">{error}</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse select-text">
              {/* Table Header with Micro-stats trigger */}
              <thead className="sticky top-0 bg-[#FAF8F5] border-b border-[#E8E4DF] z-10 shadow-2xs">
                <tr>
                  <th className="py-2.5 px-3 w-12 font-mono text-[10px] text-[#8C827A] text-center border-r border-[#E8E4DF]">
                    #
                  </th>
                  {previewData?.schema_fields.map((col) => {
                    const stat = getColStat(col.name);
                    const isPii = previewData.pii_flags && previewData.pii_flags[col.name];
                    const isSelected = selectedColumn?.name === col.name;

                    return (
                      <th
                        key={col.name}
                        onClick={() => handleColumnSelect(col.name, col.type)}
                        className={`py-2.5 px-3 font-semibold text-[#1E1915] border-r border-[#E8E4DF] cursor-pointer hover:bg-white transition-colors select-none ${
                          isSelected ? "bg-white ring-1 ring-inset ring-[#0061FE]" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{col.name}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#F7F5F2] border border-[#E8E4DF] text-[#736B63] shrink-0 uppercase">
                            {col.type}
                          </span>
                        </div>

                        {/* Column micro-sparkline or mini-indicator */}
                        <div className="flex items-center justify-between text-[10px] font-normal text-[#8C827A] mt-1">
                          <span>{stat?.null_pct === 0 ? "100% Valid" : `${(100 - (stat?.null_pct || 0)).toFixed(0)}% Valid`}</span>
                          {isPii && (
                            <span className="text-[9px] font-bold text-amber-600 bg-amber-100/70 px-1 rounded">
                              PII
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-[#E8E4DF] font-mono text-[11px]">
                {filteredRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#FAF8F5]/60 transition-colors">
                    <td className="py-2 px-3 text-[#8C827A] text-center bg-[#FAF8F5]/30 border-r border-[#E8E4DF] select-none text-[10px]">
                      {idx + 1}
                    </td>
                    {previewData?.schema_fields.map((col) => {
                      const val = row[col.name];
                      const isNull = val === null || val === undefined;
                      const isSelected = selectedColumn?.name === col.name;

                      return (
                        <td
                          key={col.name}
                          className={`py-2 px-3 border-r border-[#E8E4DF] truncate max-w-[240px] ${
                            isNull ? "text-[#8C827A] italic" : "text-[#1E1915]"
                          } ${isSelected ? "bg-[#0061FE]/5" : ""}`}
                        >
                          {isNull ? "null" : typeof val === "boolean" ? (val ? "true" : "false") : String(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
