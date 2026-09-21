"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileSpreadsheet,
  Code2,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  GitCommit,
  Layers,
  Search,
  BarChart3,
  Copy,
  Check,
  Table as TableIcon,
  Wand2,
  Grid,
  Share2,
  ExternalLink,
  Flame,
  BrainCircuit,
  Download,
  Atom,
  MapPin,
  ChevronDown,
} from "lucide-react";
import { fetchDatasetPreview, createShareLink, convertDatasetFormat } from "@/lib/api";
import { PreviewData, ColumnStat } from "@/lib/types";
import { useStudio } from "@/context/StudioContext";
import { VisualChartStudio } from "@/components/studio/VisualChartStudio";
import { WranglingRecipes } from "@/components/studio/WranglingRecipes";
import { MissingnessMatrix } from "@/components/studio/MissingnessMatrix";
import { DeepEDADossier } from "@/components/studio/DeepEDADossier";
import { AutoMLSandbox } from "@/components/studio/AutoMLSandbox";
import { SpecializedFormatViewer } from "@/components/studio/SpecializedFormatViewer";

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
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [copiedHash, setCopiedHash] = useState(false);

  // Top View Mode
  const [activeTab, setActiveTab] = useState<
    "grid" | "visualizer" | "eda" | "automl" | "wrangling" | "quality" | "specialized"
  >("grid");

  // Share Dialog state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);

  // Format Conversion State
  const [isConverting, setIsConverting] = useState(false);

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
      // If format is specialized, default to specialized viewer or keep grid
      if (data.format === "geojson" || data.format === "scientific_sdf") {
        setActiveTab("specialized");
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

  const handleCreateShareLink = async () => {
    setIsSharing(true);
    setIsShareModalOpen(true);
    try {
      const res = await createShareLink(datasetId);
      const fullUrl = `${window.location.origin}${res.share_url}`;
      setShareUrl(fullUrl);
    } catch (err: any) {
      setError(err.message || "Failed to create share link");
    } finally {
      setIsSharing(false);
    }
  };

  const copyShareLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopiedShareUrl(true);
      setTimeout(() => setCopiedShareUrl(false), 2000);
    }
  };

  const handleExportConvert = async (targetFormat: string) => {
    setIsConverting(true);
    try {
      const blob = await convertDatasetFormat(datasetId, targetFormat);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const base = previewData?.filename ? previewData.filename.split(".")[0] : datasetId;
      a.download = `${base}.${targetFormat === "excel" ? "xlsx" : targetFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Conversion failed: ${err.message}`);
    } finally {
      setIsConverting(false);
    }
  };

  const getColStat = (colName: string): ColumnStat | undefined => {
    return previewData?.column_stats?.find((s) => s.name === colName);
  };

  const filteredRows = (previewData?.preview_rows || []).filter((row) => {
    if (!searchFilter.trim()) return true;
    return Object.values(row).some((val) =>
      String(val).toLowerCase().includes(searchFilter.toLowerCase())
    );
  });

  const hasSpecializedFormat =
    previewData?.format === "geojson" || previewData?.format === "scientific_sdf";

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F5F2] overflow-hidden">
      {/* Top Action & Breadcrumb Bar */}
      <div className="border-b border-[#E8E4DF] bg-white px-6 py-3 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
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

          {/* Format Conversion & Export Dropdown */}
          <div className="relative group">
            <button
              disabled={isConverting}
              className="px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-[#0061FE]" />
              <span>{isConverting ? "Exporting..." : "Convert / Export"}</span>
              <ChevronDown className="w-3 h-3 text-[#8C827A]" />
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-white rounded-xl border border-[#E8E4DF] shadow-lg p-1.5 z-40 w-36 text-xs font-medium space-y-0.5">
              <button
                onClick={() => handleExportConvert("parquet")}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#FAF8F5] text-[#1E1915]"
              >
                Parquet (.parquet)
              </button>
              <button
                onClick={() => handleExportConvert("csv")}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#FAF8F5] text-[#1E1915]"
              >
                CSV (.csv)
              </button>
              <button
                onClick={() => handleExportConvert("excel")}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#FAF8F5] text-[#1E1915]"
              >
                Excel (.xlsx)
              </button>
              <button
                onClick={() => handleExportConvert("json")}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#FAF8F5] text-[#1E1915]"
              >
                JSON (.json)
              </button>
            </div>
          </div>

          <button
            onClick={handleCreateShareLink}
            className="px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 transition-colors shadow-2xs"
            title="Create Shareable Read-Only Preview Link"
          >
            <Share2 className="w-3.5 h-3.5 text-[#736B63]" />
            <span className="hidden sm:inline">Share</span>
          </button>

          <Link
            href="/versions"
            className="px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <GitCommit className="w-3.5 h-3.5 text-[#0061FE]" />
            <span className="hidden sm:inline">Diff Studio</span>
          </Link>

          <Link
            href={`/query?view=${previewData?.view_name || "view_" + datasetId}`}
            className="px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Code2 className="w-3.5 h-3.5 text-[#0061FE]" />
            <span>SQL</span>
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

      {/* Segmented Mode Navigation Bar */}
      <div className="border-b border-[#E8E4DF] bg-white/60 px-6 py-2 flex items-center justify-between shrink-0 overflow-x-auto select-none">
        <div className="flex items-center gap-1.5 bg-[#FAF8F5] p-1 rounded-xl border border-[#E8E4DF]">
          <button
            onClick={() => setActiveTab("grid")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === "grid"
                ? "bg-white text-[#0061FE] shadow-2xs font-bold"
                : "text-[#736B63] hover:text-[#1E1915]"
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Data Grid</span>
          </button>

          <button
            onClick={() => setActiveTab("visualizer")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === "visualizer"
                ? "bg-white text-[#0061FE] shadow-2xs font-bold"
                : "text-[#736B63] hover:text-[#1E1915]"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Visual Chart Studio</span>
            <span className="text-[9px] font-mono px-1 rounded bg-blue-50 text-[#0061FE] font-bold">
              16 Charts
            </span>
          </button>

          <button
            onClick={() => setActiveTab("eda")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === "eda"
                ? "bg-white text-[#0061FE] shadow-2xs font-bold"
                : "text-[#736B63] hover:text-[#1E1915]"
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-600" />
            <span>Deep EDA & Tests</span>
          </button>

          <button
            onClick={() => setActiveTab("automl")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === "automl"
                ? "bg-white text-[#0061FE] shadow-2xs font-bold"
                : "text-[#736B63] hover:text-[#1E1915]"
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5 text-purple-600" />
            <span>AutoML Sandbox</span>
          </button>

          <button
            onClick={() => setActiveTab("wrangling")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === "wrangling"
                ? "bg-white text-[#0061FE] shadow-2xs font-bold"
                : "text-[#736B63] hover:text-[#1E1915]"
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Wrangling Recipes</span>
          </button>

          <button
            onClick={() => setActiveTab("quality")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === "quality"
                ? "bg-white text-[#0061FE] shadow-2xs font-bold"
                : "text-[#736B63] hover:text-[#1E1915]"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Missingness</span>
          </button>

          {hasSpecializedFormat && (
            <button
              onClick={() => setActiveTab("specialized")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === "specialized"
                  ? "bg-white text-[#0061FE] shadow-2xs font-bold"
                  : "text-[#736B63] hover:text-[#1E1915]"
              }`}
            >
              {previewData.format === "geojson" ? (
                <MapPin className="w-3.5 h-3.5 text-rose-600" />
              ) : (
                <Atom className="w-3.5 h-3.5 text-purple-600" />
              )}
              <span>{previewData.format === "geojson" ? "Map View" : "Molecular View"}</span>
            </button>
          )}
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
        <div className="mx-6 mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>PII Caution:</strong> Sensitive information detected in columns:{" "}
              {Object.entries(previewData.pii_flags)
                .map(([col, type]) => `${col} (${type})`)
                .join(", ")}
            </span>
          </div>
          <button
            onClick={() => setActiveTab("wrangling")}
            className="text-[11px] font-semibold underline text-amber-900 hover:text-amber-950"
          >
            Clean with Recipe →
          </button>
        </div>
      )}

      {/* Tab 1: Data Grid View */}
      {activeTab === "grid" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-3 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3 flex-1 max-w-sm">
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C827A]" />
                <input
                  type="text"
                  placeholder="Search table values..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border border-[#E8E4DF] focus:border-[#0061FE] text-xs text-[#1E1915] outline-none shadow-2xs"
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

          <div className="flex-1 flex overflow-hidden px-6 pb-6 gap-4">
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

                            <div className="flex items-center justify-between text-[10px] font-normal text-[#8C827A] mt-1">
                              <span>
                                {stat?.null_pct === 0
                                  ? "100% Valid"
                                  : `${(100 - (stat?.null_pct || 0)).toFixed(0)}% Valid`}
                              </span>
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

                  <tbody className="divide-y divide-[#E8E4DF] font-mono text-[11px]">
                    {filteredRows.map((row, idx) => {
                      const isRowSelected = selectedRowIndex === idx;
                      return (
                        <tr
                          key={idx}
                          onClick={() => setSelectedRowIndex(isRowSelected ? null : idx)}
                          className={`hover:bg-[#FAF8F5]/60 transition-colors cursor-pointer ${
                            isRowSelected ? "bg-blue-50/40" : ""
                          }`}
                        >
                          <td className="py-2 px-3 text-[#8C827A] text-center bg-[#FAF8F5]/30 border-r border-[#E8E4DF] select-none text-[10px]">
                            {idx + 1}
                          </td>
                          {previewData?.schema_fields.map((col) => {
                            const val = row[col.name];
                            const isNull = val === null || val === undefined;
                            const isColSelected = selectedColumn?.name === col.name;

                            return (
                              <td
                                key={col.name}
                                className={`py-2 px-3 border-r border-[#E8E4DF] truncate max-w-[240px] ${
                                  isNull ? "text-[#8C827A] italic" : "text-[#1E1915]"
                                } ${isColSelected ? "bg-[#0061FE]/5" : ""}`}
                              >
                                {isNull
                                  ? "null"
                                  : typeof val === "boolean"
                                  ? val
                                    ? "true"
                                    : "false"
                                  : String(val)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Visual Chart Studio (16 Supported Chart Types) */}
      {activeTab === "visualizer" && previewData && (
        <VisualChartStudio
          columns={previewData.schema_fields}
          rows={previewData.preview_rows}
          initialX={selectedColumn?.name}
          datasetName={previewData.filename}
        />
      )}

      {/* Tab 3: Deep EDA Dossier & Hypothesis Testing */}
      {activeTab === "eda" && previewData && (
        <DeepEDADossier datasetId={datasetId} />
      )}

      {/* Tab 4: AutoML Sandbox */}
      {activeTab === "automl" && previewData && (
        <AutoMLSandbox datasetId={datasetId} previewData={previewData} />
      )}

      {/* Tab 5: Wrangling Recipes */}
      {activeTab === "wrangling" && previewData && (
        <WranglingRecipes
          datasetId={datasetId}
          previewData={previewData}
          onDatasetUpdated={(updated) => {
            setPreviewData(updated);
            setActiveDataset(updated);
          }}
        />
      )}

      {/* Tab 6: Quality & Missingness Matrix */}
      {activeTab === "quality" && previewData && (
        <MissingnessMatrix previewData={previewData} />
      )}

      {/* Tab 7: Specialized Format Viewer (GeoJSON & Scientific SDF) */}
      {activeTab === "specialized" && previewData && (
        <SpecializedFormatViewer previewData={previewData} />
      )}

      {/* Share Link Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E8E4DF] shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in">
            <div className="px-6 py-4 border-b border-[#E8E4DF] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-[#0061FE]" />
                <h3 className="text-sm font-bold text-[#1E1915]">
                  Shareable Read-Only Preview Link
                </h3>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="text-xs text-[#736B63] hover:text-[#1E1915]"
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-[#736B63]">
                Anyone with this link can view an interactive, read-only preview of this snapshot without requiring an account.
              </p>

              {isSharing ? (
                <div className="flex items-center justify-center py-6 space-x-2 text-xs text-[#736B63]">
                  <div className="w-4 h-4 border-2 border-[#0061FE] border-t-transparent rounded-full animate-spin" />
                  <span>Generating secure token...</span>
                </div>
              ) : shareUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="flex-1 px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] font-mono text-xs text-[#1E1915] select-all outline-none"
                    />
                    <button
                      onClick={copyShareLink}
                      className="px-3.5 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs shrink-0"
                    >
                      {copiedShareUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedShareUrl ? "Copied" : "Copy"}</span>
                    </button>
                  </div>

                  <div className="flex justify-end">
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#0061FE] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>Open Preview in New Tab</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
