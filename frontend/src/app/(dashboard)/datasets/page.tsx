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
  Globe,
  Star,
  Compass,
  X,
  Share2,
} from "lucide-react";
import {
  fetchDatasets,
  deleteDataset,
  searchDatasets,
  searchSemanticDatasets,
  toggleDatasetFavorite,
  fetchDatasetFavorites,
  fetchDatasetRecommendations,
  recordDatasetRecent,
} from "@/lib/api";
import { DatasetItem, RecommendationItem } from "@/lib/types";

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

  // Pillar 10.4: Semantic Vector Search toggle
  const [isSemanticMode, setIsSemanticMode] = useState(false);

  // Pillar 10.6: Starred Favorites and Recents filter
  const [activeTab, setActiveTab] = useState<"all" | "favorites">("all");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Pillar 10.7: Automated Recommendations Drawer
  const [recommendDrawer, setRecommendDrawer] = useState<{
    isOpen: boolean;
    datasetId: string;
    datasetName: string;
    recommendations: RecommendationItem[];
    isLoading: boolean;
  }>({
    isOpen: false,
    datasetId: "",
    datasetName: "",
    recommendations: [],
    isLoading: false,
  });

  // Load favorites set
  const loadFavorites = async () => {
    try {
      const resp = await fetchDatasetFavorites();
      const ids = new Set((resp.favorites || []).map((f: any) => f.id));
      setFavoriteIds(ids);
    } catch (err) {
      console.error("Failed to load favorites:", err);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, []);

  const executeSearch = async () => {
    setIsLoading(true);
    try {
      if (isSemanticMode) {
        const resp = await searchSemanticDatasets({
          q: searchQuery || undefined,
          column: columnQuery || undefined,
          format: selectedFormat !== "all" ? selectedFormat : undefined,
          min_quality: minQuality,
        });
        setDatasets(resp.results || []);
      } else {
        const resp = await searchDatasets({
          q: searchQuery || undefined,
          column: columnQuery || undefined,
          format: selectedFormat !== "all" ? selectedFormat : undefined,
          min_quality: minQuality,
          sort_by: sortBy,
        });
        setDatasets(resp.results || []);
      }
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
  }, [searchQuery, columnQuery, selectedFormat, minQuality, sortBy, isSemanticMode]);

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

  const handleToggleFavorite = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const resp = await toggleDatasetFavorite(id);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (resp.is_favorite) {
          next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      });
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  const handleOpenRecommendations = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setRecommendDrawer({
      isOpen: true,
      datasetId: id,
      datasetName: name,
      recommendations: [],
      isLoading: true,
    });
    try {
      const recs = await fetchDatasetRecommendations(id);
      setRecommendDrawer((prev) => ({
        ...prev,
        recommendations: recs,
        isLoading: false,
      }));
    } catch (err) {
      console.error("Failed to load recommendations:", err);
      setRecommendDrawer((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handleDatasetClick = (id: string) => {
    recordDatasetRecent(id).catch(() => {});
    router.push(`/datasets/${id}`);
  };

  const displayedDatasets = activeTab === "favorites"
    ? datasets.filter((d) => favoriteIds.has(d.id))
    : datasets;

  const totalRows = displayedDatasets.reduce((acc, d) => acc + (d.total_rows || 0), 0);
  const totalBytes = displayedDatasets.reduce((acc, d) => acc + (d.size_bytes || 0), 0);
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
            Multi-format lakehouse with semantic vector discovery, schema search, and DuckDB vectorized execution.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href="/showcase"
            className="px-3.5 py-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border border-cyan-200 text-xs font-semibold flex items-center gap-2 shadow-2xs transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-700" />
            <span>Public Showcase Hub (11.2)</span>
          </Link>

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
            {displayedDatasets.length}
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
            <span>Favorites & Bookmarks</span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
          </div>
          <div className="text-2xl font-serif font-bold text-amber-600">
            {favoriteIds.size}
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">
            Starred by your team
          </div>
        </div>
      </div>

      {/* Library Filter Tabs */}
      <div className="flex items-center justify-between border-b border-[#E8E4DF] pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "all"
                ? "bg-[#1E1915] text-white shadow-sm"
                : "text-[#6F675F] hover:bg-[#FAF8F5]"
            }`}
          >
            All Datasets ({datasets.length})
          </button>
          <button
            onClick={() => setActiveTab("favorites")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === "favorites"
                ? "bg-amber-500 text-white shadow-sm"
                : "text-[#6F675F] hover:bg-[#FAF8F5]"
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${activeTab === "favorites" ? "fill-white" : ""}`} />
            <span>Starred Favorites ({favoriteIds.size})</span>
          </button>
        </div>

        {/* Semantic Vector Mode Toggle (Pillar 10.4) */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6F675F] font-medium hidden sm:inline">Search Engine:</span>
          <button
            onClick={() => setIsSemanticMode(!isSemanticMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              isSemanticMode
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent shadow-sm"
                : "bg-white text-[#6F675F] border-[#E8E4DF] hover:bg-[#FAF8F5]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isSemanticMode ? "AI Vector Embeddings (Active)" : "Switch to AI Vector Search"}</span>
          </button>
        </div>
      </div>

      {/* Global & Faceted Search Bar (Pillars 10.1, 10.2, 10.4, 10.5) */}
      <div className={`p-4 rounded-2xl border shadow-2xs space-y-3 transition-colors ${
        isSemanticMode ? "bg-purple-50/40 border-purple-200" : "bg-white border-[#E8E4DF]"
      }`}>
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Query input */}
          <div className="relative flex-1">
            <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
              isSemanticMode ? "text-purple-600" : "text-[#8C827A]"
            }`} />
            <input
              type="text"
              placeholder={
                isSemanticMode
                  ? "Describe what you're looking for (e.g. 'quarterly SaaS revenue with churn risk predictions')..."
                  : "Search datasets by title, description, or tags (Pillar 10.1)..."
              }
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
              placeholder="Find column (e.g. churn_probability)..."
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

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#8C827A]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#FAF8F5] border border-[#E8E4DF] rounded-lg px-2.5 py-1 text-xs text-[#1E1915] outline-none font-medium cursor-pointer"
            >
              <option value="recent">Recently Added</option>
              <option value="quality">Quality Score</option>
              <option value="rows">Row Count</option>
              <option value="size">Disk Size</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dataset Grid / Table View */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#0061FE] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#8C827A] font-medium">Querying Strata Lakehouse catalog...</p>
        </div>
      ) : displayedDatasets.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-[#E8E4DF] text-center space-y-4 shadow-2xs">
          <Database className="w-12 h-12 text-[#8C827A] mx-auto opacity-50" />
          <h3 className="text-base font-serif font-bold text-[#1E1915]">
            No datasets uploaded yet
          </h3>
          <p className="text-xs text-[#8C827A] mt-1 max-w-md mx-auto">
            Upload a CSV, Parquet, Excel, or JSON dataset to get started in your lakehouse.
          </p>
          <div className="flex items-center justify-center pt-2">
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0061FE] text-white text-xs font-semibold hover:bg-[#0052D4] shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Upload Dataset</span>
            </Link>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedDatasets.map((ds) => {
            const isFav = favoriteIds.has(ds.id);
            return (
              <div
                key={ds.id}
                onClick={() => handleDatasetClick(ds.id)}
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
                      {ds.similarity_score !== undefined && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold border border-purple-200">
                          {Math.round(ds.similarity_score * 100)}% Match
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleToggleFavorite(e, ds.id)}
                        className={`p-1.5 rounded-lg border transition-all ${
                          isFav
                            ? "bg-amber-50 text-amber-500 border-amber-200 hover:bg-amber-100"
                            : "bg-[#FAF8F5] text-[#8C827A] border-[#E8E4DF] hover:text-amber-500 hover:bg-amber-50"
                        }`}
                        title={isFav ? "Favorited" : "Add to favorites"}
                      >
                        <Star className={`w-3.5 h-3.5 ${isFav ? "fill-amber-400" : ""}`} />
                      </button>

                      {ds.quality_score && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          {ds.quality_score}% Clean
                        </span>
                      )}
                    </div>
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

                  {ds.matched_reasons && ds.matched_reasons.length > 0 && (
                    <div className="text-[10px] text-purple-700 font-medium">
                      {ds.matched_reasons.join(" • ")}
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
                    <button
                      onClick={(e) => handleOpenRecommendations(e, ds.id, ds.name)}
                      className="p-1.5 rounded-lg hover:bg-cyan-50 text-[#736B63] hover:text-cyan-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Teams that used this also explored..."
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>Explore</span>
                    </button>
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
            );
          })}
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
                {displayedDatasets.map((ds) => (
                  <tr
                    key={ds.id}
                    onClick={() => handleDatasetClick(ds.id)}
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

      {/* Automated Recommendations Drawer (Pillar 10.7) */}
      {recommendDrawer.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl border-l border-[#E8E4DF] flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#E8E4DF] bg-[#FAF8F5] flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-purple-700 font-bold uppercase tracking-wider">
                  <Compass className="w-3.5 h-3.5" />
                  <span>Automated Recommendations</span>
                </div>
                <h3 className="text-sm font-bold text-[#1E1915]">
                  Teams that used &quot;{recommendDrawer.datasetName}&quot; also explored
                </h3>
              </div>
              <button
                onClick={() => setRecommendDrawer((prev) => ({ ...prev, isOpen: false }))}
                className="p-1 rounded-lg text-[#8C827A] hover:bg-[#E8E4DF] hover:text-[#1E1915]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {recommendDrawer.isLoading ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-[#0061FE] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-[#8C827A]">Computing graph schema overlap...</p>
                </div>
              ) : recommendDrawer.recommendations.length === 0 ? (
                <div className="p-8 text-center bg-[#FAF8F5] rounded-xl border border-[#E8E4DF] space-y-2">
                  <Compass className="w-8 h-8 text-[#8C827A] mx-auto opacity-50" />
                  <p className="text-xs font-semibold text-[#1E1915]">No direct recommendations yet</p>
                  <p className="text-[11px] text-[#8C827A]">
                    Upload more datasets to calculate schema bridges and join graphs.
                  </p>
                </div>
              ) : (
                recommendDrawer.recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => {
                      setRecommendDrawer((prev) => ({ ...prev, isOpen: false }));
                      router.push(`/datasets/${rec.id}`);
                    }}
                    className="p-4 rounded-xl border border-[#E8E4DF] hover:border-[#0061FE] bg-white hover:bg-blue-50/10 cursor-pointer transition-all space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-[#1E1915] group-hover:text-[#0061FE] transition-colors">
                        {rec.name}
                      </h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        {Math.round(rec.similarity_score * 100)}% Match
                      </span>
                    </div>

                    <p className="text-[11px] text-[#6F675F] line-clamp-2">
                      {rec.description || "Complementary schema table"}
                    </p>

                    <div className="pt-2 border-t border-[#E8E4DF]/60 text-[10px] text-emerald-700 font-medium">
                      💡 {rec.rationale}
                    </div>

                    {rec.shared_columns && rec.shared_columns.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {rec.shared_columns.map((c) => (
                          <span
                            key={c}
                            className="px-1.5 py-0.5 rounded bg-[#F7F5F2] border border-[#E8E4DF] text-[9px] font-mono text-[#736B63]"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[#E8E4DF] bg-[#FAF8F5] text-[11px] text-[#8C827A] flex items-center justify-between">
              <span>Pillar 10.7 Recommendation Engine</span>
              <button
                onClick={() => setRecommendDrawer((prev) => ({ ...prev, isOpen: false }))}
                className="font-semibold text-[#1E1915] hover:underline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
