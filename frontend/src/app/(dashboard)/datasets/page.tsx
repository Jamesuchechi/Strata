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
} from "lucide-react";
import { fetchDatasets, deleteDataset } from "@/lib/api";
import { DatasetItem } from "@/lib/types";

export default function DatasetsPage() {
  const router = useRouter();
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const list = await fetchDatasets();
      setDatasets(list);
    } catch (err) {
      console.error("Failed to load datasets:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const filteredDatasets = datasets.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesFormat =
      selectedFormat === "all" ||
      d.format.toLowerCase() === selectedFormat.toLowerCase();

    return matchesSearch && matchesFormat;
  });

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
            <span className="text-[#0061FE] font-bold">Data Library</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1E1915]">
            Datasets & Tables
          </h1>
          <p className="text-xs sm:text-sm text-[#5C554D] mt-1">
            Universal multi-format data lakehouse powered by DuckDB vectorized execution.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={loadData}
            title="Refresh datasets"
            className="p-2 rounded-xl border border-[#E8E4DF] bg-white hover:bg-[#FAF8F5] text-[#736B63] hover:text-[#1E1915] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <Link
            href="/upload"
            className="px-4 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold flex items-center gap-2 shadow-sm shadow-[#0061FE]/20 transition-all"
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
            <span>Total Datasets</span>
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
            <span>Engine Health</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-serif font-bold text-emerald-600">
            100% Ready
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">
            DuckDB 1.5 WASM + API
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-[#E8E4DF] shadow-2xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C827A]" />
          <input
            type="text"
            placeholder="Search datasets by name, tag, or format..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-[#FAF8F5] border border-transparent focus:border-[#0061FE] focus:bg-white text-xs text-[#1E1915] placeholder-[#8C827A] outline-none transition-all"
          />
        </div>

        {/* Format Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          {["all", "csv", "parquet", "excel"].map((fmt) => (
            <button
              key={fmt}
              onClick={() => setSelectedFormat(fmt)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all ${
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
        <div className="flex items-center gap-1 border-l border-[#E8E4DF] pl-2">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === "grid" ? "bg-[#FAF8F5] text-[#0061FE]" : "text-[#8C827A] hover:text-[#1E1915]"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === "table" ? "bg-[#FAF8F5] text-[#0061FE]" : "text-[#8C827A] hover:text-[#1E1915]"
            }`}
          >
            <ListIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Datasets View */}
      {filteredDatasets.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-[#E8E4DF] space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FAF8F5] border border-[#E8E4DF] flex items-center justify-center text-[#8C827A]">
            <Database className="w-7 h-7" />
          </div>
            <h3 className="text-base font-bold text-[#1E1915]">
              {datasets.length === 0 ? "No datasets uploaded yet" : "No matching datasets"}
            </h3>
            <p className="text-xs text-[#8C827A] mt-1">
              {datasets.length === 0
                ? "Your analytical lakehouse is currently empty. Upload your first CSV, Excel, Parquet, or GeoJSON file to begin exploring."
                : "Try refining your search keywords or format filters."}
            </p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0061FE] text-white text-xs font-semibold hover:bg-[#0052D4] shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload Dataset</span>
          </Link>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDatasets.map((ds) => (
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
                    className="p-1.5 rounded-lg hover:bg-rose-50 text-[#8C827A] hover:text-rose-600 transition-colors"
                    title="Delete dataset"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-bold text-[#0061FE] flex items-center gap-1 pl-1">
                    Preview
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="rounded-2xl bg-white border border-[#E8E4DF] overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] border-b border-[#E8E4DF] text-[10px] font-mono uppercase text-[#8C827A]">
              <tr>
                <th className="py-3 px-4">Dataset</th>
                <th className="py-3 px-3">Format</th>
                <th className="py-3 px-3">Rows</th>
                <th className="py-3 px-3">Cols</th>
                <th className="py-3 px-3">Size</th>
                <th className="py-3 px-3">Quality</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E4DF]">
              {filteredDatasets.map((ds) => (
                <tr
                  key={ds.id}
                  onClick={() => router.push(`/datasets/${ds.id}`)}
                  className="hover:bg-[#FAF8F5]/80 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-[#FAF8F5] border border-[#E8E4DF]">
                        {getFormatIcon(ds.format)}
                      </div>
                      <div>
                        <div className="font-bold text-[#1E1915]">{ds.name}</div>
                        <div className="text-[11px] text-[#8C827A] font-mono">{ds.filename}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono uppercase text-[11px] text-[#736B63]">
                    {ds.format}
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold text-[#1E1915]">
                    {ds.total_rows.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 font-mono text-[#736B63]">{ds.total_columns}</td>
                  <td className="py-3 px-3 font-mono text-[#736B63]">{formatSize(ds.size_bytes)}</td>
                  <td className="py-3 px-3">
                    {ds.quality_score ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-200">
                        {ds.quality_score}% Clean
                      </span>
                    ) : (
                      <span className="text-[#8C827A]">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/datasets/${ds.id}`}
                        className="px-2.5 py-1 rounded-lg bg-[#0061FE]/10 text-[#0061FE] font-semibold text-xs hover:bg-[#0061FE] hover:text-white transition-all"
                      >
                        Preview
                      </Link>
                      <button
                        onClick={(e) => handleDelete(e, ds.id)}
                        className="p-1 rounded-lg hover:bg-rose-50 text-[#8C827A] hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
