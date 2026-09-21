"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload,
  FileSpreadsheet,
  Database,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Code2,
  FileText,
  Layers,
  Atom,
  MapPin,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { uploadAndPreviewFile } from "@/lib/api";
import { PreviewData } from "@/lib/types";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<PreviewData | null>(null);

  const handleFileSelection = async (file: File) => {
    setError(null);
    setIsUploading(true);
    setUploadProgress(15);
    setUploadStage("Reading file & computing SHA-256 hash...");

    const progressTimer = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev < 80) return prev + 15;
        return prev;
      });
    }, 200);

    try {
      setTimeout(() => {
        setUploadStage("Polars parsing & DuckDB view registration...");
      }, 300);

      const result = await uploadAndPreviewFile(file);
      clearInterval(progressTimer);
      setUploadProgress(100);
      setUploadStage("Column profiling & PII safety scan complete!");
      setPreviewResult(result);
    } catch (err: any) {
      clearInterval(progressTimer);
      setError(err.message || "Failed to process dataset");
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const supportedFormats = [
    { ext: "CSV / TSV", desc: "Delimited text up to 5GB", icon: <FileText className="w-4 h-4 text-[#0061FE]" /> },
    { ext: "Excel (.xlsx, .xls)", desc: "Multi-sheet workbooks", icon: <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> },
    { ext: "Apache Parquet", desc: "Columnar binary format", icon: <Database className="w-4 h-4 text-purple-600" /> },
    { ext: "JSON / JSONL", desc: "Semi-structured objects", icon: <Code2 className="w-4 h-4 text-amber-600" /> },
    { ext: "Chemical SDF", desc: "Molecular structures", icon: <Atom className="w-4 h-4 text-cyan-600" /> },
    { ext: "GeoJSON", desc: "Spatial geometries", icon: <MapPin className="w-4 h-4 text-rose-600" /> },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-mono text-[#8C827A] uppercase tracking-wider">
          <Link href="/datasets" className="hover:text-[#1E1915] transition-colors">
            Datasets
          </Link>
          <span>/</span>
          <span className="text-[#0061FE] font-bold">Ingestion Studio</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1E1915] tracking-tight">
          Upload & Ingest Dataset
        </h1>
        <p className="text-sm text-[#5C554D] max-w-2xl leading-relaxed">
          Drag and drop any tabular, spreadsheet, or scientific data file. Strata automatically indexes the schema, verifies cryptographic content hashes, profiles column statistics, and registers zero-copy in-memory DuckDB views.
        </p>
      </div>

      {/* Main Upload Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-10 sm:p-14 text-center cursor-pointer transition-all duration-200 bg-white ${
          isDragging
            ? "border-[#0061FE] bg-[#0061FE]/5 shadow-xl scale-[1.01]"
            : "border-[#D6D0C7] hover:border-[#0061FE] hover:shadow-md"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".csv,.tsv,.xlsx,.xls,.parquet,.pq,.json,.jsonl,.sdf,.geojson"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileSelection(e.target.files[0]);
            }
          }}
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
              isDragging
                ? "bg-[#0061FE] text-white scale-110 shadow-lg shadow-[#0061FE]/30"
                : "bg-[#F7F5F2] text-[#0061FE] border border-[#E8E4DF]"
            }`}
          >
            <Upload className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <p className="text-base sm:text-lg font-bold text-[#1E1915]">
              {isDragging ? "Drop your dataset here" : "Click to browse or drag & drop"}
            </p>
            <p className="text-xs sm:text-sm text-[#8C827A]">
              Supports CSV, TSV, Parquet, Excel (.xlsx/.xls), JSON, SDF, and GeoJSON (Up to 5GB per file)
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF8F5] border border-[#E8E4DF] text-xs font-medium text-[#5C554D]">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Instant DuckDB Registration
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF8F5] border border-[#E8E4DF] text-xs font-medium text-[#5C554D]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Automated PII Detection
            </span>
          </div>
        </div>
      </div>

      {/* Upload & Parsing Status */}
      {isUploading && (
        <div className="p-5 rounded-2xl bg-white border border-[#E8E4DF] shadow-sm space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs font-semibold text-[#1E1915]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#0061FE] animate-pulse" />
              <span>{uploadStage}</span>
            </div>
            <span className="font-mono text-[#0061FE]">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-[#EFECE6] h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#0061FE] h-full transition-all duration-300 rounded-full"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 text-sm animate-in fade-in duration-150">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          <div>
            <div className="font-bold">Ingestion failed</div>
            <div className="text-xs text-rose-700 mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* Upload Success Card */}
      {previewResult && (
        <div className="p-6 rounded-2xl bg-white border border-[#057A55]/30 shadow-md space-y-5 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between border-b border-[#E8E4DF] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#057A55]/10 text-[#057A55] flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1E1915] flex items-center gap-2">
                  <span>{previewResult.filename}</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#F7F5F2] border border-[#E8E4DF] text-[10px] font-mono text-[#736B63] uppercase">
                    {previewResult.format}
                  </span>
                </h3>
                <p className="text-xs text-[#8C827A] font-mono mt-0.5">
                  SHA-256: {previewResult.content_hash.slice(0, 16)}...
                </p>
              </div>
            </div>

            {previewResult.quality_score && (
              <div className="text-right">
                <div className="text-xs text-[#8C827A]">Data Health</div>
                <div className="text-lg font-bold text-emerald-600">
                  {previewResult.quality_score.overall_score}% Clean
                </div>
              </div>
            )}
          </div>

          {/* Deduplication Warning Banner */}
          {previewResult.is_duplicate && (
            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold">Cryptographic Deduplication Match Detected (Feature 1.12)</div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  An identical content hash (<span className="font-mono">{previewResult.content_hash.slice(0, 12)}...</span>) already exists in your workspace as{" "}
                  <strong>{previewResult.existing_dataset_name || previewResult.filename}</strong>.
                  Strata linked this upload to the existing zero-copy storage blob to eliminate duplicate disk consumption.
                </p>
              </div>
            </div>
          )}

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF]">
              <div className="text-[10px] uppercase font-mono text-[#8C827A]">Total Rows</div>
              <div className="text-lg font-bold text-[#1E1915]">
                {previewResult.total_rows.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF]">
              <div className="text-[10px] uppercase font-mono text-[#8C827A]">Columns</div>
              <div className="text-lg font-bold text-[#1E1915]">
                {previewResult.total_columns}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF]">
              <div className="text-[10px] uppercase font-mono text-[#8C827A]">DuckDB View</div>
              <div className="text-xs font-mono font-bold text-[#0061FE] truncate mt-1">
                {previewResult.view_name || "view_registered"}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF]">
              <div className="text-[10px] uppercase font-mono text-[#8C827A]">PII Findings</div>
              <div className="text-xs font-semibold text-[#1E1915] mt-1">
                {Object.keys(previewResult.pii_flags || {}).length > 0
                  ? `${Object.keys(previewResult.pii_flags!).length} columns flagged`
                  : "Zero PII detected"}
              </div>
            </div>
          </div>

          {/* Next Steps CTA */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href={`/datasets/${previewResult.content_hash.slice(0, 12)}`}
              className="px-4 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
            >
              <span>Open in Universal Previewer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <Link
              href={`/query?view=${previewResult.view_name || "view_" + previewResult.content_hash.slice(0, 12)}`}
              className="px-4 py-2 rounded-xl bg-white border border-[#E8E4DF] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] flex items-center gap-2 transition-colors"
            >
              <Code2 className="w-3.5 h-3.5 text-[#0061FE]" />
              <span>Query with DuckDB SQL</span>
            </Link>

            <Link
              href={`/analyst?dataset=${previewResult.filename}`}
              className="px-4 py-2 rounded-xl bg-white border border-[#E8E4DF] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] flex items-center gap-2 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#0061FE]" />
              <span>Ask AI Analyst</span>
            </Link>
          </div>
        </div>
      )}

      {/* Supported Formats Grid */}
      <div className="space-y-3 pt-4">
        <h3 className="text-xs font-mono uppercase tracking-wider text-[#8C827A]">
          Supported Ingestion Formats
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {supportedFormats.map((f) => (
            <div
              key={f.ext}
              className="p-3.5 rounded-xl bg-white border border-[#E8E4DF] flex items-start gap-3 shadow-2xs hover:border-[#D6D0C7] transition-all"
            >
              <div className="p-2 rounded-lg bg-[#FAF8F5] border border-[#E8E4DF] shrink-0">
                {f.icon}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#1E1915] truncate">{f.ext}</div>
                <div className="text-[11px] text-[#8C827A] truncate mt-0.5">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
