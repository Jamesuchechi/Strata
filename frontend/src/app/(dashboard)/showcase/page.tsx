"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Globe,
  Sparkles,
  Star,
  Download,
  GitFork,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Code2,
  BookOpen,
  Share2,
  Database,
  Search,
  Filter,
  Layers,
  FileSpreadsheet,
  Atom,
  MapPin,
  FileText,
  SlidersHorizontal,
  X,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import {
  fetchShowcaseDatasets,
  fetchShowcaseDataset,
  toggleShowcaseStar,
  trackShowcaseDownload,
  forkShowcaseDataset,
} from "@/lib/api";
import { ShowcaseDataset, CitationResponse, EmbedConfigResponse } from "@/lib/types";

export default function ShowcasePage() {
  const router = useRouter();
  const [datasets, setDatasets] = useState<ShowcaseDataset[]>([]);
  const [domains, setDomains] = useState<string[]>(["All"]);
  const [selectedDomain, setSelectedDomain] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("trending");
  const [isLoading, setIsLoading] = useState(true);

  // Modal inspection state
  const [activeModalId, setActiveModalId] = useState<string | null>(null);
  const [activeDossier, setActiveDossier] = useState<{
    dataset: ShowcaseDataset;
    citations: CitationResponse;
    embeds: EmbedConfigResponse;
  } | null>(null);
  const [isDossierLoading, setIsDossierLoading] = useState(false);
  const [modalTab, setModalTab] = useState<"preview" | "schema" | "sql" | "citation" | "embed">("preview");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [embedTheme, setEmbedTheme] = useState<"light" | "dark">("light");
  const [embedSchema, setEmbedSchema] = useState(true);
  const [forkingId, setForkingId] = useState<string | null>(null);
  const [forkSuccess, setForkSuccess] = useState<string | null>(null);

  const loadShowcase = async () => {
    setIsLoading(true);
    try {
      const resp = await fetchShowcaseDatasets({
        domain: selectedDomain,
        q: searchQuery || undefined,
        sort_by: sortBy,
      });
      setDatasets(resp.datasets || []);
      if (resp.domains && resp.domains.length > 0) {
        setDomains(resp.domains);
      }
    } catch (err) {
      console.error("Failed to load showcase datasets:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadShowcase();
    }, 250);
    return () => clearTimeout(timer);
  }, [selectedDomain, searchQuery, sortBy]);

  const handleOpenDossier = async (datasetId: string) => {
    setActiveModalId(datasetId);
    setIsDossierLoading(true);
    setModalTab("preview");
    try {
      const data = await fetchShowcaseDataset(datasetId);
      setActiveDossier(data);
    } catch (err) {
      console.error("Failed to fetch dossier:", err);
    } finally {
      setIsDossierLoading(false);
    }
  };

  const handleToggleStar = async (e: React.MouseEvent, datasetId: string) => {
    e.stopPropagation();
    try {
      const res = await toggleShowcaseStar(datasetId);
      setDatasets((prev) =>
        prev.map((d) =>
          d.id === datasetId ? { ...d, is_starred: res.is_starred, stars: res.total_stars } : d
        )
      );
      if (activeDossier && activeDossier.dataset.id === datasetId) {
        setActiveDossier({
          ...activeDossier,
          dataset: { ...activeDossier.dataset, is_starred: res.is_starred, stars: res.total_stars },
        });
      }
    } catch (err) {
      console.error("Failed to toggle star:", err);
    }
  };

  const handleDownload = async (datasetId: string) => {
    try {
      await trackShowcaseDownload(datasetId);
      setDatasets((prev) =>
        prev.map((d) => (d.id === datasetId ? { ...d, downloads: d.downloads + 1 } : d))
      );
      alert("Download tracked! The dataset snapshot is ready.");
    } catch (err) {
      console.error("Download tracking failed:", err);
    }
  };

  const handleFork = async (e: React.MouseEvent, datasetId: string) => {
    e.stopPropagation();
    setForkingId(datasetId);
    try {
      const res = await forkShowcaseDataset(datasetId);
      setForkSuccess(res.message);
      setDatasets((prev) =>
        prev.map((d) => (d.id === datasetId ? { ...d, forks: res.fork_count } : d))
      );
      setTimeout(() => {
        router.push("/datasets");
      }, 1500);
    } catch (err: any) {
      alert(`Fork failed: ${err.message}`);
    } finally {
      setForkingId(null);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getFormatBadge = (format: string) => {
    switch (format.toLowerCase()) {
      case "parquet":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Database className="w-3 h-3" /> Parquet
          </span>
        );
      case "sdf":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Atom className="w-3 h-3" /> SDF Mol
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <FileText className="w-3 h-3" /> CSV
          </span>
        );
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#1E1915] via-[#2A2420] to-[#1E1915] rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-[#0061FE]/15 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold tracking-wide uppercase text-white/90 border border-white/15 backdrop-blur-sm">
            <Globe className="w-3.5 h-3.5 text-[#0061FE]" />
            Strata Open Data Hub & Public Showcase
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Discover, Fork, and Embed Curated Open Datasets
          </h1>
          <p className="text-[#E8E4DF] text-sm sm:text-base leading-relaxed">
            High-integrity benchmark datasets for geospatial science, fintech fraud detection, drug
            bioactivity, and customer cohorts. Live previews, 1-click forking into your workspace, and
            academic citations.
          </p>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/10 text-xs">
            <div>
              <p className="text-white/60">Curated Benchmarks</p>
              <p className="text-lg font-bold text-white">4 Domains</p>
            </div>
            <div>
              <p className="text-white/60">Community Stars</p>
              <p className="text-lg font-bold text-amber-400">1,674 ★</p>
            </div>
            <div>
              <p className="text-white/60">Verified Records</p>
              <p className="text-lg font-bold text-emerald-400">516,250+</p>
            </div>
            <div>
              <p className="text-white/60">Community Downloads</p>
              <p className="text-lg font-bold text-[#60A5FA]">13,720</p>
            </div>
          </div>
        </div>
      </div>

      {forkSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center justify-between shadow-sm animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{forkSuccess} Redirecting to your workspace datasets...</span>
          </div>
          <Link
            href="/datasets"
            className="text-xs font-bold text-emerald-700 underline hover:text-emerald-900"
          >
            View Datasets →
          </Link>
        </div>
      )}

      {/* Control Bar: Filters & Search */}
      <div className="bg-[#FAF8F5] border border-[#E8E4DF] rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Domain Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {domains.map((dom) => (
              <button
                key={dom}
                onClick={() => setSelectedDomain(dom)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedDomain === dom
                    ? "bg-[#1E1915] text-white shadow-sm"
                    : "bg-white text-[#6F675F] hover:bg-[#E8E4DF]/50 border border-[#E8E4DF]"
                }`}
              >
                {dom}
              </button>
            ))}
          </div>

          {/* Search & Sort Controls */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-[#8C827A] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search datasets & tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#E8E4DF] rounded-lg focus:outline-none focus:border-[#0061FE] focus:ring-1 focus:ring-[#0061FE]"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-[#E8E4DF] rounded-lg text-[#1E1915] font-medium focus:outline-none focus:border-[#0061FE]"
            >
              <option value="trending">Trending Popularity</option>
              <option value="stars">Most Stars ★</option>
              <option value="downloads">Most Downloads</option>
              <option value="quality">Highest Quality Score</option>
              <option value="recent">Recently Updated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dataset Grid */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#0061FE] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#8C827A] font-medium">Loading curated showcase datasets...</p>
        </div>
      ) : datasets.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#E8E4DF] rounded-2xl space-y-3">
          <Globe className="w-10 h-10 text-[#8C827A] mx-auto opacity-50" />
          <h3 className="text-sm font-bold text-[#1E1915]">No datasets matched your query</h3>
          <p className="text-xs text-[#8C827A]">
            Try adjusting your search keywords or switching domain filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {datasets.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-[#E8E4DF] hover:border-[#0061FE]/50 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                {/* Badges Bar */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-[#F7F5F2] text-[#4A423B] border border-[#E8E4DF]">
                      {item.domain}
                    </span>
                    {getFormatBadge(item.format)}
                  </div>
                  <button
                    onClick={(e) => handleToggleStar(e, item.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      item.is_starred
                        ? "bg-amber-50 text-amber-700 border-amber-300"
                        : "bg-white text-[#6F675F] hover:bg-amber-50/50 border-[#E8E4DF]"
                    }`}
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        item.is_starred ? "fill-amber-400 text-amber-500" : "text-[#8C827A]"
                      }`}
                    />
                    <span>{item.stars}</span>
                  </button>
                </div>

                {/* Title & Description */}
                <div>
                  <h3
                    onClick={() => handleOpenDossier(item.id)}
                    className="text-base font-bold text-[#1E1915] group-hover:text-[#0061FE] transition-colors cursor-pointer"
                  >
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#6F675F] line-clamp-2 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Author Info */}
                <div className="flex items-center gap-2 pt-1 text-xs text-[#6F675F]">
                  <div className="w-5 h-5 rounded-full bg-[#E8E4DF] flex items-center justify-center font-bold text-[10px] text-[#4A423B]">
                    {item.author[0]}
                  </div>
                  <span className="font-medium text-[#1E1915]">{item.author}</span>
                  {item.author_verified && (
                    <span title="Verified Contributor" className="text-blue-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <span className="text-[#8C827A]">•</span>
                  <span className="text-[11px] font-mono text-[#8C827A]">{item.license}</span>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {item.tags.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#F7F5F2] text-[#6F675F] border border-[#E8E4DF]/60"
                    >
                      #{t}
                    </span>
                  ))}
                  {item.tags.length > 4 && (
                    <span className="text-[10px] text-[#8C827A] font-medium pt-0.5">
                      +{item.tags.length - 4} more
                    </span>
                  )}
                </div>
              </div>

              {/* Footer Metrics & Actions */}
              <div className="pt-5 mt-4 border-t border-[#E8E4DF] flex items-center justify-between text-xs">
                <div className="flex items-center gap-3 text-[#6F675F] font-mono text-[11px]">
                  <span>{item.total_rows.toLocaleString()} rows</span>
                  <span>•</span>
                  <span>{item.total_columns} cols</span>
                  <span>•</span>
                  <span className="text-emerald-700 font-bold">{item.quality_score}% Quality</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenDossier(item.id)}
                    className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#E8E4DF] text-[#1E1915] text-xs font-semibold rounded-lg border border-[#E8E4DF] transition-colors"
                  >
                    Dossier & Preview
                  </button>

                  <button
                    onClick={(e) => handleFork(e, item.id)}
                    disabled={forkingId === item.id}
                    className="px-3 py-1.5 bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
                  >
                    <GitFork className="w-3.5 h-3.5" />
                    <span>{forkingId === item.id ? "Forking..." : `Fork (${item.forks})`}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dossier & Preview Modal */}
      {activeModalId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E8E4DF] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#E8E4DF] bg-[#FAF8F5] flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#E8E4DF] text-[#4A423B]">
                    {activeDossier?.dataset.domain || "Dataset"}
                  </span>
                  <span className="text-xs text-[#8C827A]">•</span>
                  <span className="text-xs font-mono text-[#8C827A]">
                    DOI: {activeDossier?.dataset.doi || "10.5281/strata"}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-[#1E1915]">
                  {activeDossier?.dataset.title || "Dataset Preview & Dossier"}
                </h2>
              </div>
              <button
                onClick={() => setActiveModalId(null)}
                className="p-1.5 rounded-lg text-[#8C827A] hover:bg-[#E8E4DF] hover:text-[#1E1915] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="px-6 border-b border-[#E8E4DF] bg-white flex items-center gap-4 text-xs font-semibold">
              <button
                onClick={() => setModalTab("preview")}
                className={`py-3 border-b-2 transition-colors ${
                  modalTab === "preview"
                    ? "border-[#0061FE] text-[#0061FE]"
                    : "border-transparent text-[#6F675F] hover:text-[#1E1915]"
                }`}
              >
                Sample Preview
              </button>
              <button
                onClick={() => setModalTab("schema")}
                className={`py-3 border-b-2 transition-colors ${
                  modalTab === "schema"
                    ? "border-[#0061FE] text-[#0061FE]"
                    : "border-transparent text-[#6F675F] hover:text-[#1E1915]"
                }`}
              >
                Schema Dictionary ({activeDossier?.dataset.schema_fields?.length || 0})
              </button>
              <button
                onClick={() => setModalTab("sql")}
                className={`py-3 border-b-2 transition-colors ${
                  modalTab === "sql"
                    ? "border-[#0061FE] text-[#0061FE]"
                    : "border-transparent text-[#6F675F] hover:text-[#1E1915]"
                }`}
              >
                DuckDB Query
              </button>
              <button
                onClick={() => setModalTab("citation")}
                className={`py-3 border-b-2 transition-colors ${
                  modalTab === "citation"
                    ? "border-[#0061FE] text-[#0061FE]"
                    : "border-transparent text-[#6F675F] hover:text-[#1E1915]"
                }`}
              >
                Academic Citation (BibTeX / APA)
              </button>
              <button
                onClick={() => setModalTab("embed")}
                className={`py-3 border-b-2 transition-colors ${
                  modalTab === "embed"
                    ? "border-[#0061FE] text-[#0061FE]"
                    : "border-transparent text-[#6F675F] hover:text-[#1E1915]"
                }`}
              >
                Embeddable Widget
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {isDossierLoading ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-8 h-8 border-2 border-[#0061FE] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-[#8C827A]">Loading dataset details...</p>
                </div>
              ) : activeDossier ? (
                <>
                  {/* Tab 1: Preview */}
                  {modalTab === "preview" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs text-[#6F675F]">
                        <span>
                          Showing sample rows from {activeDossier.dataset.total_rows.toLocaleString()} verified
                          records:
                        </span>
                        <button
                          onClick={() => handleDownload(activeDossier.dataset.id)}
                          className="inline-flex items-center gap-1.5 font-bold text-[#0061FE] hover:underline"
                        >
                          <Download className="w-3.5 h-3.5" /> Download Full Snapshot (
                          {(activeDossier.dataset.size_bytes / (1024 * 1024)).toFixed(1)} MB)
                        </button>
                      </div>

                      {activeDossier.dataset.sample_rows &&
                      activeDossier.dataset.sample_rows.length > 0 ? (
                        <div className="overflow-x-auto border border-[#E8E4DF] rounded-xl shadow-inner">
                          <table className="w-full text-left border-collapse font-sans text-xs">
                            <thead>
                              <tr className="bg-[#FAF8F5] border-b border-[#E8E4DF]">
                                {Object.keys(activeDossier.dataset.sample_rows[0]).map((col) => (
                                  <th
                                    key={col}
                                    className="p-3 font-mono font-semibold text-[#1E1915] whitespace-nowrap"
                                  >
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E8E4DF]">
                              {activeDossier.dataset.sample_rows.map((row, i) => (
                                <tr key={i} className="hover:bg-blue-50/20">
                                  {Object.values(row).map((val: any, j) => (
                                    <td
                                      key={j}
                                      className="p-3 font-mono text-[11px] text-[#4A423B] whitespace-nowrap"
                                    >
                                      {typeof val === "boolean"
                                        ? val
                                          ? "true"
                                          : "false"
                                        : String(val)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-[#8C827A]">No sample rows available.</p>
                      )}
                    </div>
                  )}

                  {/* Tab 2: Schema */}
                  {modalTab === "schema" && (
                    <div className="space-y-4">
                      <p className="text-xs text-[#6F675F]">
                        Complete column specifications and documentation dictionary:
                      </p>
                      <div className="border border-[#E8E4DF] rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-[#FAF8F5] border-b border-[#E8E4DF] font-semibold text-[#1E1915]">
                            <tr>
                              <th className="p-3">Column Name</th>
                              <th className="p-3">Data Type</th>
                              <th className="p-3">Description & Semantics</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E8E4DF]">
                            {activeDossier.dataset.schema_fields?.map((f) => (
                              <tr key={f.name} className="hover:bg-slate-50">
                                <td className="p-3 font-mono font-bold text-[#1E1915]">{f.name}</td>
                                <td className="p-3">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
                                    {f.type}
                                  </span>
                                </td>
                                <td className="p-3 text-[#6F675F]">{f.description || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Tab 3: SQL */}
                  {modalTab === "sql" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-[#6F675F]">
                          Ready-to-run DuckDB SQL query benchmark for this dataset:
                        </p>
                        <button
                          onClick={() =>
                            copyToClipboard(activeDossier.dataset.sample_query || "", "sql_copy")
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-[#E8E4DF] hover:bg-[#FAF8F5] text-xs font-semibold rounded-lg text-[#1E1915] transition-colors"
                        >
                          {copiedKey === "sql_copy" ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-600">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy SQL</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="bg-[#1E1915] rounded-xl p-4 text-emerald-400 font-mono text-xs overflow-x-auto shadow-inner">
                        <pre>{activeDossier.dataset.sample_query}</pre>
                      </div>
                    </div>
                  )}

                  {/* Tab 4: Citation */}
                  {modalTab === "citation" && (
                    <div className="space-y-6">
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                        <div className="flex items-center gap-2 font-bold text-xs text-blue-900">
                          <BookOpen className="w-4 h-4 text-blue-700" />
                          <span>Persistent Academic Identifier (DOI)</span>
                        </div>
                        <p className="text-xs text-blue-700 font-mono">
                          doi:{activeDossier.citations.doi}
                        </p>
                      </div>

                      {/* BibTeX */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-[#1E1915]">BibTeX Format</label>
                          <button
                            onClick={() =>
                              copyToClipboard(activeDossier.citations.bibtex, "bibtex_copy")
                            }
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0061FE] hover:underline"
                          >
                            {copiedKey === "bibtex_copy" ? "Copied!" : "Copy BibTeX"}
                          </button>
                        </div>
                        <div className="bg-[#FAF8F5] border border-[#E8E4DF] rounded-xl p-3 font-mono text-[11px] text-[#4A423B] overflow-x-auto">
                          <pre>{activeDossier.citations.bibtex}</pre>
                        </div>
                      </div>

                      {/* APA 7th */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-[#1E1915]">APA (7th edition)</label>
                          <button
                            onClick={() => copyToClipboard(activeDossier.citations.apa, "apa_copy")}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0061FE] hover:underline"
                          >
                            {copiedKey === "apa_copy" ? "Copied!" : "Copy APA"}
                          </button>
                        </div>
                        <p className="p-3 bg-[#FAF8F5] border border-[#E8E4DF] rounded-xl text-xs text-[#4A423B]">
                          {activeDossier.citations.apa}
                        </p>
                      </div>

                      {/* IEEE */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-[#1E1915]">IEEE Style</label>
                          <button
                            onClick={() => copyToClipboard(activeDossier.citations.ieee, "ieee_copy")}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0061FE] hover:underline"
                          >
                            {copiedKey === "ieee_copy" ? "Copied!" : "Copy IEEE"}
                          </button>
                        </div>
                        <p className="p-3 bg-[#FAF8F5] border border-[#E8E4DF] rounded-xl text-xs text-[#4A423B]">
                          {activeDossier.citations.ieee}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Tab 5: Embed */}
                  {modalTab === "embed" && (
                    <div className="space-y-6">
                      <div className="p-4 bg-[#FAF8F5] border border-[#E8E4DF] rounded-xl flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <p className="font-bold text-[#1E1915]">Embed Widget Customizer</p>
                          <p className="text-[#6F675F]">
                            Embed this interactive dataset preview into external research papers, blogs, and documentation.
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={embedSchema}
                              onChange={(e) => setEmbedSchema(e.target.checked)}
                              className="rounded text-[#0061FE]"
                            />
                            <span>Include Schema Tab</span>
                          </label>
                        </div>
                      </div>

                      {/* Embed Code Snippet */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-[#1E1915]">Responsive HTML iFrame Code</label>
                          <button
                            onClick={() =>
                              copyToClipboard(activeDossier.embeds.iframe, "iframe_copy")
                            }
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0061FE] hover:underline"
                          >
                            {copiedKey === "iframe_copy" ? "Copied!" : "Copy iFrame"}
                          </button>
                        </div>
                        <div className="bg-[#1E1915] text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-x-auto">
                          <pre>{activeDossier.embeds.iframe}</pre>
                        </div>
                      </div>

                      {/* Direct Widget Link */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[#1E1915]">Standalone Embed URL</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={activeDossier.embeds.embed_url}
                            className="flex-1 p-2 bg-[#FAF8F5] border border-[#E8E4DF] rounded-lg text-xs font-mono text-[#4A423B]"
                          />
                          <a
                            href={`/embed/${activeDossier.dataset.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-2 bg-white border border-[#E8E4DF] hover:bg-[#FAF8F5] text-xs font-semibold rounded-lg flex items-center gap-1.5 text-[#1E1915]"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open Live</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E8E4DF] bg-[#FAF8F5] flex items-center justify-between">
              <div className="text-xs text-[#6F675F] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Standard License: {activeDossier?.dataset.license || "CC-BY 4.0"} (Open Data)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveModalId(null)}
                  className="px-4 py-2 bg-white border border-[#E8E4DF] text-xs font-semibold text-[#6F675F] hover:text-[#1E1915] rounded-lg"
                >
                  Close
                </button>
                {activeDossier && (
                  <button
                    onClick={(e) => handleFork(e, activeDossier.dataset.id)}
                    disabled={forkingId === activeDossier.dataset.id}
                    className="px-4 py-2 bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <GitFork className="w-4 h-4" />
                    <span>Fork Dataset into Studio</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
