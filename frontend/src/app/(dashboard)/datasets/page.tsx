"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Database,
  FileSpreadsheet,
  FileText,
  Code2,
  Atom,
  MapPin,
  Search,
  Plus,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  HardDrive,
  LayoutGrid,
  List as ListIcon,
  Trash2,
  RefreshCw,
  Layers,
  CheckCircle2,
  SlidersHorizontal,
  Sliders,
  Filter,
} from "lucide-react";
import { fetchDatasets, deleteDataset, searchDatasets, seedDomainSamples } from "@/lib/api";
import { DatasetItem } from "@/lib/types";

export default function DatasetsPage() {
  const router = useRouter();
  const [datasets, setDatasets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [columnQuery, setColumnQuery] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<string>("all");
  const [minQuality, setMinQuality] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string>("recent");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [isSeeding, setIsSeeding] = useState(false);

  const executeSearch = async () => {
    setIsLoading(true);
    try {
      const resp = await searchDatasets({
        q: searchQuery || undefined,
        column: columnQuery || undefined,
        format: selectedFormat !== "all" ? selectedFormat : undefined,
        min_quality: minQuality,
        sort_by: sortBy,
      });
      setDatasets(resp.results || []);
    } catch (err) {
      console.error("Search failed, falling back to all datasets:", err);
      const fallback = await fetchDatasets();
      setDatasets(fallback);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      executeSearch();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, columnQuery, selectedFormat, minQuality, sortBy]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to remove this dataset from the studio?")) {
      try {
        await deleteDataset(id);
        setDatasets((prev) => prev.filter((d) => d.id !== id));
      } catch (err) {
        alert("Failed to delete dataset");
      }
    }
  };

  const handleSeedSamples = async () => {
    setIsSeeding(true);
    try {
      await seedDomainSamples();
      await executeSearch();
    } catch (err: any) {
      alert(`Failed to load samples: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const totalRows = datasets.reduce((acc, d) => acc + (d.total_rows || 0), 0);
  const totalBytes = datasets.reduce((acc, d) => acc + (d.size_bytes || 0), 0);
  const formatSize = (bytes: number) => {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFormatIcon = (format: string) => {
    switch (format.toLowerCase()) {
      case "excel":
        return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
      case "parquet":
        return <Database className="w-4 h-4 text-[#0061FE]" />;
      case "sdf":
        return <Atom className="w-4 h-4 text-purple-600" />;
      case "geojson":
        return <MapPin className="w-4 h-4 text-rose-600" />;
      default:
        return <FileText className="w-4 h-4 text-blue-600" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E4DF] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#8C827A] uppercase tracking-wider mb-1">
            <span>Workspace</span>
            <span>/</span>
            <span className="text-[#0061FE] font-bold">Data Library & Catalog</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1E1915]">
            Datasets & Tables
          </h1>
          <p className="text-xs sm:text-sm text-[#5C554D] mt-1">
            Multi-format lakehouse with schema-based discovery and DuckDB vectorized execution.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleSeedSamples}
            disabled={isSeeding}
            className="px-3.5 py-2 rounded-xl border border-[#E8E4DF] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
          >
            <Sparkles className={`w-3.5 h-3.5 text-[#0061FE] ${isSeeding ? "animate-spin" : ""}`} />
            <span>{isSeeding ? "Seeding..." : "Load Domain Benchmarks (18.2)"}</span>
          </button>

          <Link
            href="/upload"
            className="px-4 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold flex items-center gap-2 shadow-sm shadow-[#0061FE]/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Dataset</span>
          </Link>
        </div>
      </div>

      {/* Studio Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#8C827A] mb-1">
            <span>Indexed Datasets</span>
            <Database className="w-4 h-4 text-[#0061FE]" />
          </div>
          <div className="text-2xl font-serif font-bold text-[#1E1915]">
            {datasets.length}
          </div>
          <div className="text-[11px] text-[#057A55] font-medium mt-1">
            Active in DuckDB catalog
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#8C827A] mb-1">
            <span>Total Rows Cached</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-serif font-bold text-[#1E1915]">
            {totalRows.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#736B63] font-mono mt-1">
            Zero-copy virtual grid
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#8C827A] mb-1">
            <span>Storage Consumed</span>
            <HardDrive className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-serif font-bold text-[#1E1915]">
            {formatSize(totalBytes)}
          </div>
          <div className="text-[11px] text-[#736B63] font-mono mt-1">
            Fast local disk store
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#8C827A] mb-1">
            <span>Search & Catalog</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-serif font-bold text-emerald-600">
            Faceted
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">
            Full-text + Schema Discovery
          </div>
        </div>
      </div>

      {/* Global & Faceted Search Bar (Pillars 10.1 & 10.5) */}
      <div className="bg-white p-3 rounded-2xl border border-[#E8E4DF] shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Global full-text search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C827A]" />
            <input
              type="text"
              placeholder="Search datasets by title, description, or tags (Pillar 10.1)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#FAF8F5] border border-transparent focus:border-[#0061FE] focus:bg-white text-xs text-[#1E1915] placeholder-[#8C827A] outline-none transition-all"
            />
          </div>

          {/* Schema-based column search (Pillar 10.2) */}
          <div className="relative md:w-64">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-purple-600" />
            <input
              type="text"
              placeholder="Find column name (e.g. churn)..."
              value={columnQuery}
              onChange={(e) => setColumnQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#FAF8F5] border border-transparent focus:border-purple-600 focus:bg-white text-xs text-[#1E1915] placeholder-[#8C827A] outline-none transition-all"
            />
          </div>

          {/* Format Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            {["all", "csv", "parquet", "excel", "sdf", "geojson"].map((fmt) => (
              <button
                key={fmt}
                onClick={() => setSelectedFormat(fmt)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all cursor-pointer ${
                  selectedFormat === fmt
                    ? "bg-[#0061FE] text-white shadow-2xs"
                    : "text-[#736B63] hover:text-[#1E1915] hover:bg-[#FAF8F5]"
                }`}
              >
                {fmt === "all" ? "All Formats" : fmt}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 border-l border-[#E8E4DF] pl-2 shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === "grid" ? "bg-[#FAF8F5] text-[#0061FE]" : "text-[#8C827A] hover:text-[#1E1915]"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === "table" ? "bg-[#FAF8F5] text-[#0061FE]" : "text-[#8C827A] hover:text-[#1E1915]"
              }`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Faceted Filter Toolbar (Pillar 10.5) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E8E4DF] text-xs">
          <div className="flex items-center gap-3">
            <span className="text-[#8C827A] font-semibold flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#0061FE]" />
              <span>Faceted Filters:</span>
            </span>

            {/* Quality filter */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMinQuality(undefined)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  minQuality === undefined ? "bg-[#1E1915] text-white" : "bg-[#FAF8F5] text-[#736B63] hover:bg-[#E8E4DF]"
                }`}
              >
                All Quality
              </button>
              <button
                onClick={() => setMinQuality(80)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  minQuality === 80 ? "bg-emerald-600 text-white" : "bg-[#FAF8F5] text-[#736B63] hover:bg-[#E8E4DF]"
                }`}
              >
                ≥ 80% Clean
              </button>
              <button
                onClick={() => setMinQuality(90)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  minQuality === 90 ? "bg-emerald-600 text-white" : "bg-[#FAF8F5] text-[#736B63] hover:bg-[#E8E4DF]"
                }`}
              >
                ≥ 90% Clean
              </button>
            </div>
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-2">
            <span className="text-[#8C827A]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#FAF8F5] border border-[#E8E4DF] rounded-lg px-2.5 py-1 text-xs font-semibold text-[#1E1915] outline-none cursor-pointer"
            >
              <option value="recent">Recently Added</option>
              <option value="quality">Quality Score (High → Low)</option>
              <option value="rows">Row Count (Most Rows)</option>
              <option value="size">File Size</option>
              <option value="name">Name (A → Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Datasets View */}
      {datasets.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-[#E8E4DF] space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FAF8F5] border border-[#E8E4DF] flex items-center justify-center text-[#8C827A]">
            <Database className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-[#1E1915]">
            No matching datasets found
          </h3>
          <p className="text-xs text-[#8C827A] mt-1">
            Try adjusting your search query, column filter, or quality threshold. Or load pre-loaded domain benchmarks.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleSeedSamples}
              disabled={isSeeding}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load Domain Benchmark Datasets</span>
            </button>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0061FE] text-white text-xs font-semibold hover:bg-[#0052D4] shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload Dataset</span>
            </Link>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {datasets.map((ds) => (
            <div
              key={ds.id}
              onClick={() => router.push(`/datasets/${ds.id}`)}
              className="p-5 rounded-2xl bg-white border border-[#E8E4DF] hover:border-[#0061FE] shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between group space-y-4"
            >
              {/* Card Header */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] group-hover:border-[#0061FE]/30 transition-colors">
                      {getFormatIcon(ds.format)}
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#FAF8F5] border border-[#E8E4DF] text-[10px] font-mono uppercase font-bold text-[#736B63]">
                      {ds.format}
                    </span>
                  </div>

                  {ds.quality_score && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      {ds.quality_score}% Clean
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-bold text-[#1E1915] group-hover:text-[#0061FE] transition-colors truncate">
                    {ds.name}
                  </h3>
                  <p className="text-xs text-[#8C827A] font-mono truncate mt-0.5">
                    {ds.filename}
                  </p>
                </div>

                <p className="text-xs text-[#5C554D] line-clamp-2 leading-relaxed">
                  {ds.description || "No description provided."}
                </p>

                {/* Match Badges if search active */}
                {ds.matched_columns && ds.matched_columns.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {ds.matched_columns.slice(0, 3).map((col: string) => (
                      <span
                        key={col}
                        className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-mono font-semibold"
                      >
                        col: {col}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Stats */}
              <div className="pt-3 border-t border-[#E8E4DF] grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="text-[10px] font-mono uppercase text-[#8C827A]">Rows</div>
                  <div className="font-bold text-[#1E1915]">{ds.total_rows.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase text-[#8C827A]">Cols</div>
                  <div className="font-bold text-[#1E1915]">{ds.total_columns}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase text-[#8C827A]">Size</div>
                  <div className="font-bold text-[#1E1915]">{formatSize(ds.size_bytes)}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-[#E8E4DF]">
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/query?view=${ds.view_name || "view_" + ds.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-lg hover:bg-[#FAF8F5] text-[#736B63] hover:text-[#0061FE] text-xs font-semibold flex items-center gap-1 transition-colors"
                    title="Open in DuckDB SQL Studio"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>SQL</span>
                  </Link>
                  <Link
                    href={`/analyst?dataset=${ds.filename}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-lg hover:bg-[#FAF8F5] text-[#736B63] hover:text-[#0061FE] text-xs font-semibold flex items-center gap-1 transition-colors"
                    title="Analyze with AI Analyst"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI</span>
                  </Link>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleDelete(e, ds.id)}
                    className="p-1.5 rounded-lg hover:bg-rose-50 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                    title="Delete dataset"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E8E4DF] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E8E4DF] text-[#8C827A] font-semibold bg-[#FAF8F5]">
                  <th className="py-3 px-4">Dataset Name</th>
                  <th className="py-3 px-4">Format</th>
                  <th className="py-3 px-4">Rows</th>
                  <th className="py-3 px-4">Cols</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Quality</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((ds) => (
                  <tr
                    key={ds.id}
                    onClick={() => router.push(`/datasets/${ds.id}`)}
                    className="border-b border-[#E8E4DF]/60 hover:bg-[#FAF8F5] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#1E1915]">{ds.name}</div>
                      <div className="text-[11px] text-[#8C827A] font-mono">{ds.filename}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#E8E4DF] text-[10px] font-mono uppercase font-bold text-[#736B63]">
                        {ds.format}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">{ds.total_rows.toLocaleString()}</td>
                    <td className="py-3 px-4 font-mono">{ds.total_columns}</td>
                    <td className="py-3 px-4 font-mono">{formatSize(ds.size_bytes)}</td>
                    <td className="py-3 px-4">
                      <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {ds.quality_score || 92}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => handleDelete(e, ds.id)}
                        className="text-stone-400 hover:text-rose-600 p-1 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
