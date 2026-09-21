"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Database,
  Upload,
  Layers,
  ChevronDown,
  Code2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { fetchDatasets, fetchDatasetPreview } from "@/lib/api";
import { DatasetItem, PreviewData } from "@/lib/types";
import { VisualChartStudio } from "@/components/studio/VisualChartStudio";

export default function VisualizerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center h-full bg-[#F7F5F2] text-xs text-[#736B63] font-mono">
          Loading Visual Chart Studio...
        </div>
      }
    >
      <VisualizerContent />
    </Suspense>
  );
}

function VisualizerContent() {
  const searchParams = useSearchParams();
  const datasetParam = searchParams.get("dataset") || searchParams.get("id");

  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Load datasets list
  useEffect(() => {
    async function init() {
      setIsLoading(true);
      setError(null);
      try {
        const list = await fetchDatasets();
        setDatasets(list);

        if (list.length > 0) {
          // If query param matches an ID or filename, select it; otherwise default to first dataset
          let match = list.find((d) => d.id === datasetParam || d.filename === datasetParam);
          if (!match) {
            match = list[0];
          }
          setSelectedDatasetId(match.id);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load datasets");
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [datasetParam]);

  // 2. Load preview data whenever selectedDatasetId changes
  useEffect(() => {
    if (!selectedDatasetId) {
      setPreviewData(null);
      return;
    }

    async function loadDatasetPreview() {
      setIsLoadingPreview(true);
      try {
        const data = await fetchDatasetPreview(selectedDatasetId);
        setPreviewData(data);
      } catch (err: any) {
        console.error("Failed to load preview for visualizer:", err);
      } finally {
        setIsLoadingPreview(false);
      }
    }
    loadDatasetPreview();
  }, [selectedDatasetId]);

  const activeDatasetMeta = datasets.find((d) => d.id === selectedDatasetId);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F5F2] overflow-hidden">
      {/* Top Header & Dataset Switcher Toolbar */}
      <div className="border-b border-[#E8E4DF] bg-white px-6 py-3 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0061FE] shrink-0 shadow-2xs">
            <BarChart3 className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#1E1915]">Visual Chart Studio</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[#0061FE] font-bold">
                16 Chart Types
              </span>
            </div>
            <p className="text-[11px] text-[#736B63]">
              Interactive shelf builder, automated statistical moments, and AI data science takeaways.
            </p>
          </div>
        </div>

        {/* Dataset Switcher & Secondary Links */}
        <div className="flex items-center gap-2.5">
          {datasets.length > 0 && (
            <div className="relative">
              <select
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] focus:border-[#0061FE] text-xs font-semibold text-[#1E1915] outline-none cursor-pointer transition-colors shadow-2xs"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name || d.filename} ({d.total_rows.toLocaleString()} rows)
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C827A] pointer-events-none" />
            </div>
          )}

          {activeDatasetMeta && (
            <>
              <Link
                href={`/datasets/${selectedDatasetId}`}
                className="px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Layers className="w-3.5 h-3.5 text-[#736B63]" />
                <span className="hidden md:inline">Data Grid</span>
              </Link>

              <Link
                href={`/query?view=${activeDatasetMeta.view_name || "view_" + selectedDatasetId}`}
                className="px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Code2 className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden md:inline">SQL</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Main Studio Viewport */}
      <div className="flex-1 flex overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-3 text-[#736B63]">
            <div className="w-8 h-8 border-2 border-[#0061FE] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-mono">Initializing Visual Chart Studio...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-rose-600 space-y-2">
            <p className="font-bold text-sm">Failed to load datasets</p>
            <p className="text-xs text-[#8C827A]">{error}</p>
          </div>
        ) : datasets.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs flex items-center justify-center mb-4">
              <BarChart3 className="w-8 h-8 text-[#0061FE]" />
            </div>
            <h3 className="text-base font-bold text-[#1E1915] mb-1">
              No Datasets Available to Visualize
            </h3>
            <p className="text-xs text-[#736B63] max-w-md mb-6">
              Upload a CSV, Excel, Parquet, JSON, or SDF file to immediately unlock the 16-chart shelf builder and data science exploration dock.
            </p>
            <Link
              href="/upload"
              className="px-4 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Your First Dataset</span>
            </Link>
          </div>
        ) : isLoadingPreview ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-3 text-[#736B63]">
            <div className="w-8 h-8 border-2 border-[#0061FE] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-mono">Loading dataset schema and samples...</p>
          </div>
        ) : previewData ? (
          <VisualChartStudio
            columns={previewData.schema_fields}
            rows={previewData.preview_rows}
            datasetName={previewData.filename}
          />
        ) : null}
      </div>
    </div>
  );
}
