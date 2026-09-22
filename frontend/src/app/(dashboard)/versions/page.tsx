"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  GitBranch,
  GitCommit,
  Clock,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  Plus,
  Layers,
  FileSpreadsheet,
  AlertTriangle,
  History,
  FileCode,
  Tag,
  RefreshCw,
  Check,
  Pin,
  Shield,
  Download,
  Sliders,
  TrendingUp,
  AlertCircle,
  Copy,
  ExternalLink,
  ChevronDown,
  X,
} from "lucide-react";
import {
  fetchCommits,
  createSnapshotCommit,
  fetchDatasets,
  rollbackToCommit,
  addCommitTag,
  removeCommitTag,
  toggleCommitPin,
  updateCommitPermissions,
  updateCommitMetadata,
  bumpCommitSemver,
  fetchDetailedCompare,
  fetchDiffReport,
} from "@/lib/api";
import { useStudio } from "@/context/StudioContext";
import { DatasetItem, CommitRecord, DetailedCompareResult } from "@/lib/types";
import { LineageDAG } from "@/components/studio/LineageDAG";

export default function VersionsPage() {
  const { setActiveCommit, setActiveContextTab } = useStudio();

  const [commits, setCommits] = useState<CommitRecord[]>([]);
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCommitId, setSelectedCommitId] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCommitMessage, setNewCommitMessage] = useState("");
  const [newCommitDataset, setNewCommitDataset] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);

  // Tag & Metadata & Permission Inline State
  const [tagInput, setTagInput] = useState("");
  const [showAddTag, setShowAddTag] = useState(false);
  const [metaKey, setMetaKey] = useState("");
  const [metaValue, setMetaValue] = useState("");
  const [showAddMeta, setShowAddMeta] = useState(false);

  // Multi-Version Diff Studio State
  const [viewMode, setViewMode] = useState<"detail" | "compare" | "lineage">("detail");
  const [compareBaseId, setCompareBaseId] = useState<string>("");
  const [compareTargetId, setCompareTargetId] = useState<string>("");
  const [detailedCompare, setDetailedCompare] = useState<DetailedCompareResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const loadCommits = async () => {
    setIsLoading(true);
    try {
      const [commitList, datasetList] = await Promise.all([
        fetchCommits(),
        fetchDatasets(),
      ]);
      setDatasets(datasetList);
      if (datasetList.length > 0) {
        setNewCommitDataset(datasetList[0].filename);
      }
      setCommits(commitList);
      if (commitList.length > 0) {
        setSelectedCommitId(commitList[0].id);
        setActiveCommit(commitList[0]);
      }
      if (commitList.length >= 2) {
        setCompareBaseId(commitList[commitList.length - 1].id);
        setCompareTargetId(commitList[0].id);
      }
    } catch (err) {
      console.error("Failed to load commits:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCommits();
    setActiveContextTab("git");
  }, []);

  const activeCommit =
    commits.find((c) => c.id === selectedCommitId) ||
    commits[0] ||
    null;

  const handleSelectCommit = (c: CommitRecord) => {
    setSelectedCommitId(c.id);
    setActiveCommit(c);
  };

  const handleRollback = async (commitId: string) => {
    const target = commits.find((c) => c.id === commitId);
    if (!target) return;
    if (
      !confirm(
        `Are you sure you want to rollback to snapshot ${target.version}? A new rollback commit will be recorded in the immutable DAG.`
      )
    )
      return;

    setIsRollingBack(true);
    try {
      const res = await rollbackToCommit(commitId);
      if (res.commit) {
        setCommits((prev) => [res.commit, ...prev]);
        setSelectedCommitId(res.commit.id);
        setActiveCommit(res.commit);
      }
    } catch (err: any) {
      alert(`Rollback failed: ${err.message}`);
    } finally {
      setIsRollingBack(false);
    }
  };

  const handleTogglePin = async (commitId: string) => {
    try {
      const res = await toggleCommitPin(commitId);
      setCommits((prev) =>
        prev.map((c) => (c.id === commitId ? { ...c, is_pinned: res.commit.is_pinned } : c))
      );
    } catch (err: any) {
      alert(`Failed to pin commit: ${err.message}`);
    }
  };

  const handleAddTag = async (commitId: string) => {
    if (!tagInput.trim()) return;
    try {
      const res = await addCommitTag(commitId, tagInput.trim());
      setCommits((prev) =>
        prev.map((c) => (c.id === commitId ? { ...c, tags: res.commit.tags } : c))
      );
      setTagInput("");
      setShowAddTag(false);
    } catch (err: any) {
      alert(`Failed to add tag: ${err.message}`);
    }
  };

  const handleRemoveTag = async (commitId: string, tag: string) => {
    try {
      const res = await removeCommitTag(commitId, tag);
      setCommits((prev) =>
        prev.map((c) => (c.id === commitId ? { ...c, tags: res.commit.tags } : c))
      );
    } catch (err: any) {
      alert(`Failed to remove tag: ${err.message}`);
    }
  };

  const handleBumpSemver = async (commitId: string, type: "patch" | "minor" | "major") => {
    try {
      const res = await bumpCommitSemver(commitId, type);
      setCommits((prev) =>
        prev.map((c) =>
          c.id === commitId
            ? { ...c, version: res.commit.version, semver: res.commit.semver, tags: res.commit.tags }
            : c
        )
      );
    } catch (err: any) {
      alert(`Failed to bump version: ${err.message}`);
    }
  };

  const handleUpdatePermissions = async (commitId: string, level: string) => {
    try {
      const res = await updateCommitPermissions(commitId, level);
      setCommits((prev) =>
        prev.map((c) => (c.id === commitId ? { ...c, access_level: res.commit.access_level } : c))
      );
    } catch (err: any) {
      alert(`Failed to update access level: ${err.message}`);
    }
  };

  const handleAddMetadata = async (commitId: string) => {
    if (!metaKey.trim()) return;
    try {
      let parsedVal: any = metaValue;
      if (!isNaN(Number(metaValue)) && metaValue.trim() !== "") {
        parsedVal = Number(metaValue);
      }
      const res = await updateCommitMetadata(commitId, { [metaKey.trim()]: parsedVal });
      setCommits((prev) =>
        prev.map((c) =>
          c.id === commitId ? { ...c, custom_metadata: res.commit.custom_metadata } : c
        )
      );
      setMetaKey("");
      setMetaValue("");
      setShowAddMeta(false);
    } catch (err: any) {
      alert(`Failed to update metadata: ${err.message}`);
    }
  };

  const handleRunCompare = async (baseId?: string, targetId?: string) => {
    const bId = baseId || compareBaseId;
    const tId = targetId || compareTargetId;
    if (!bId || !tId) return;

    setIsComparing(true);
    try {
      const res = await fetchDetailedCompare(bId, tId);
      setDetailedCompare(res);
    } catch (err: any) {
      alert(`Comparison failed: ${err.message}`);
    } finally {
      setIsComparing(false);
    }
  };

  const handleExportReport = async (format: "markdown" | "json") => {
    if (!compareBaseId || !compareTargetId) return;
    setIsExporting(true);
    try {
      const data = await fetchDiffReport(compareBaseId, compareTargetId, format);
      const blob = new Blob([typeof data === "string" ? data : JSON.stringify(data, null, 2)], {
        type: format === "json" ? "application/json" : "text/markdown",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `strata_diff_${compareBaseId}_vs_${compareTargetId}.${format === "json" ? "json" : "md"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommitMessage.trim() || !newCommitDataset) return;
    setIsSubmitting(true);
    try {
      const newVersionTag = `v1.${commits.length}.0`;
      const created = await createSnapshotCommit({
        dataset_name: newCommitDataset,
        message: newCommitMessage,
        version_tag: newVersionTag,
        author: "James Uchechi",
      });
      setCommits((prev) => [created, ...prev]);
      setSelectedCommitId(created.id);
      setActiveCommit(created);
      setShowCreateModal(false);
      setNewCommitMessage("");
    } catch (err) {
      alert("Failed to create snapshot commit");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F5F2] overflow-hidden">
      {/* Top Header */}
      <div className="border-b border-[#E8E4DF] bg-white px-6 py-3 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#0061FE]/10 text-[#0061FE]">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-[#1E1915]">
              Git Versions & Time-Travel Diff
            </h1>
            <p className="text-xs text-[#8C827A]">
              Immutable DAG snapshots, statistical drift comparison, SemVer tags & pinning.
            </p>
          </div>
        </div>

        {/* Mode Switcher, Branch Switcher & Commit Button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-[#FAF8F5] border border-[#E8E4DF] p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setViewMode("detail")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === "detail"
                  ? "bg-white text-[#0061FE] font-bold shadow-2xs"
                  : "text-[#736B63] hover:text-[#1E1915]"
              }`}
            >
              Snapshot Detail
            </button>
            <button
              onClick={() => {
                setViewMode("compare");
                if (commits.length >= 2) {
                  handleRunCompare(commits[commits.length - 1].id, commits[0].id);
                }
              }}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === "compare"
                  ? "bg-white text-[#0061FE] font-bold shadow-2xs"
                  : "text-[#736B63] hover:text-[#1E1915]"
              }`}
            >
              Multi-Version Compare
            </button>
            <button
              onClick={() => setViewMode("lineage")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === "lineage"
                  ? "bg-white text-[#0061FE] font-bold shadow-2xs"
                  : "text-[#736B63] hover:text-[#1E1915]"
              }`}
            >
              Lineage DAG
            </button>
          </div>

          <button
            onClick={loadCommits}
            className="p-2 rounded-xl border border-[#E8E4DF] bg-white hover:bg-[#FAF8F5] text-[#736B63] hover:text-[#1E1915] transition-colors cursor-pointer"
            title="Refresh commit history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-[#0061FE]/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Snapshot</span>
          </button>
        </div>
      </div>

      {viewMode === "lineage" ? (
        <LineageDAG />
      ) : (
        /* Main Diff Studio */
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Commit Timeline */}
          <aside className="w-80 border-r border-[#E8E4DF] bg-[#FAF8F5] overflow-y-auto p-4 space-y-3 shrink-0">
            <div className="text-[10px] font-mono uppercase text-[#8C827A] font-bold px-1 flex items-center justify-between">
              <span>Commit History</span>
              <span className="text-[#0061FE]">{commits.length} snapshots</span>
            </div>

            {isLoading ? (
              <div className="p-6 text-center text-xs text-[#8C827A] font-mono">
                Loading commits...
              </div>
            ) : commits.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#8C827A] bg-white rounded-2xl border border-[#E8E4DF]">
                No snapshots committed yet. Ingest a dataset or click Create Snapshot.
              </div>
            ) : (
              <div className="space-y-2">
                {commits.map((c) => {
                  const isSelected = selectedCommitId === c.id;

                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelectCommit(c)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? "bg-white border-[#0061FE] shadow-sm ring-1 ring-[#0061FE]/20"
                          : "bg-white/70 hover:bg-white border-[#E8E4DF] hover:border-[#D6D0C7]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-[#1E1915]">
                          <GitCommit className="w-3.5 h-3.5 text-[#0061FE]" />
                          <span>{c.version}</span>
                          {c.is_pinned && (
                            <span title="Pinned from GC">
                              <Pin className="w-3 h-3 text-amber-500 fill-amber-500" />
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-[#8C827A] px-1.5 py-0.5 rounded bg-[#FAF8F5] border border-[#E8E4DF]">
                          {c.hash}
                        </span>
                      </div>

                      <p className="text-xs text-[#1E1915] font-medium leading-snug line-clamp-2">
                        {c.message}
                      </p>

                      {/* Tags Bar */}
                      {c.tags && c.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {c.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-purple-50 text-purple-700 border border-purple-200"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-[#8C827A] pt-1 border-t border-[#E8E4DF]/60 font-mono">
                        <span className="truncate max-w-[120px]">{c.dataset_name || c.author}</span>
                        <span>{c.date}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          {/* Center & Right Column: Diff Inspector */}
          <main className="flex-1 overflow-y-auto p-6 space-y-6">
            {viewMode === "compare" ? (
              /* Multi-Version Diff Comparator */
              <div className="space-y-6 max-w-5xl">
                {/* Comparator Selector Card */}
                <div className="p-5 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-[#1E1915]">
                        Multi-Dimensional Diff Comparator (Pillar 3)
                      </h3>
                      <p className="text-xs text-[#8C827A]">
                        Compare schema, cell-level values, distribution drift, and missingness shifts across any DAG snapshots.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleExportReport("markdown")}
                        disabled={isExporting}
                        className="px-3 py-1.5 rounded-xl border border-[#E8E4DF] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5 text-[#0061FE]" />
                        <span>Export Markdown</span>
                      </button>
                      <button
                        onClick={() => handleExportReport("json")}
                        disabled={isExporting}
                        className="px-3 py-1.5 rounded-xl border border-[#E8E4DF] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5 text-purple-600" />
                        <span>Export JSON</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#5C554D]">
                        Base Snapshot ($V_A$)
                      </label>
                      <select
                        value={compareBaseId}
                        onChange={(e) => {
                          setCompareBaseId(e.target.value);
                          handleRunCompare(e.target.value, compareTargetId);
                        }}
                        className="w-full p-2.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs font-mono font-semibold text-[#1E1915] outline-none"
                      >
                        {commits.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.version} ({c.hash}) — {c.message.slice(0, 35)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#5C554D]">
                        Target Snapshot ($V_B$)
                      </label>
                      <select
                        value={compareTargetId}
                        onChange={(e) => {
                          setCompareTargetId(e.target.value);
                          handleRunCompare(compareBaseId, e.target.value);
                        }}
                        className="w-full p-2.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs font-mono font-semibold text-[#1E1915] outline-none"
                      >
                        {commits.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.version} ({c.hash}) — {c.message.slice(0, 35)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRunCompare()}
                    disabled={isComparing || !compareBaseId || !compareTargetId}
                    className="px-4 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isComparing ? "animate-spin" : ""}`} />
                    <span>{isComparing ? "Computing Diff..." : "Recompute Multi-Dimensional Diff"}</span>
                  </button>
                </div>

                {/* Detailed Comparison Results */}
                {detailedCompare && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    {/* Detected Column Renames Alert */}
                    {detailedCompare.smart_renames && detailedCompare.smart_renames.length > 0 && (
                      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800">
                            Smart Column Rename Heuristics Detected (Pillar 3.12)
                          </h4>
                          <div className="mt-1 space-y-1 text-xs">
                            {detailedCompare.smart_renames.map((rn, i) => (
                              <div key={i} className="font-mono">
                                Renamed <span className="font-bold underline">{rn.old_column}</span> → <span className="font-bold underline">{rn.new_column}</span> ({Math.round(rn.confidence * 100)}% match confidence)
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Delta KPI Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs">
                        <div className="text-xs text-[#8C827A] mb-1">Added Columns</div>
                        <div className="text-2xl font-bold text-emerald-600 font-mono">
                          +{detailedCompare.schema_diff?.added_columns?.length || 0}
                        </div>
                      </div>
                      <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs">
                        <div className="text-xs text-[#8C827A] mb-1">Removed Columns</div>
                        <div className="text-2xl font-bold text-rose-600 font-mono">
                          -{detailedCompare.schema_diff?.removed_columns?.length || 0}
                        </div>
                      </div>
                      <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs">
                        <div className="text-xs text-[#8C827A] mb-1">Duplicate Rows Delta</div>
                        <div className="text-xl font-bold text-[#1E1915] font-mono mt-1">
                          {detailedCompare.missing_and_duplicates?.duplicate_rows?.delta >= 0 ? "+" : ""}
                          {detailedCompare.missing_and_duplicates?.duplicate_rows?.delta || 0}
                        </div>
                      </div>
                      <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs">
                        <div className="text-xs text-[#8C827A] mb-1">Structural Schema</div>
                        <div className={`text-sm font-bold font-mono mt-1 ${detailedCompare.schema_diff?.identical_schema ? "text-emerald-700" : "text-amber-700"}`}>
                          {detailedCompare.schema_diff?.identical_schema ? "Identical Schemas" : "Mutated Schema"}
                        </div>
                      </div>
                    </div>

                    {/* Statistical Distribution Shifts */}
                    <div className="p-5 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-4">
                      <div className="flex items-center justify-between border-b border-[#E8E4DF] pb-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#1E1915] flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-[#0061FE]" />
                          <span>Statistical Distribution Drift (Pillar 3.5: Mean, Median, Variance, IQR)</span>
                        </h4>
                      </div>

                      {detailedCompare.distribution_shifts && Object.keys(detailedCompare.distribution_shifts).length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-mono">
                            <thead>
                              <tr className="border-b border-[#E8E4DF] text-[#8C827A]">
                                <th className="py-2 px-3">Column</th>
                                <th className="py-2 px-3">Mean Delta</th>
                                <th className="py-2 px-3">Median Delta</th>
                                <th className="py-2 px-3">Variance Delta</th>
                                <th className="py-2 px-3">IQR Shift</th>
                                <th className="py-2 px-3">Severity</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.values(detailedCompare.distribution_shifts).map((d) => (
                                <tr key={d.column} className="border-b border-[#E8E4DF]/50 hover:bg-[#FAF8F5]">
                                  <td className="py-2.5 px-3 font-bold text-[#1E1915]">{d.column}</td>
                                  <td className={`py-2.5 px-3 font-semibold ${d.mean.delta > 0 ? "text-emerald-600" : d.mean.delta < 0 ? "text-rose-600" : "text-[#736B63]"}`}>
                                    {d.mean.delta > 0 ? "+" : ""}{d.mean.delta}
                                  </td>
                                  <td className="py-2.5 px-3">{d.median.delta > 0 ? "+" : ""}{d.median.delta}</td>
                                  <td className="py-2.5 px-3">{d.variance.delta > 0 ? "+" : ""}{d.variance.delta}</td>
                                  <td className="py-2.5 px-3">{d.iqr.delta > 0 ? "+" : ""}{d.iqr.delta}</td>
                                  <td className="py-2.5 px-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${d.shift_severity === "high" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                                      {d.shift_severity}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-[#8C827A] py-2">No numerical columns drifted between these versions.</p>
                      )}
                    </div>

                    {/* Categorical Domain Shifts (Pillar 3.13) */}
                    {detailedCompare.categorical_domain_shifts && Object.keys(detailedCompare.categorical_domain_shifts).length > 0 && (
                      <div className="p-5 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#1E1915] flex items-center gap-2">
                          <Sliders className="w-4 h-4 text-purple-600" />
                          <span>Categorical Domain Shifts (Pillar 3.13: New / Lost Classes)</span>
                        </h4>
                        <div className="space-y-3">
                          {Object.values(detailedCompare.categorical_domain_shifts).map((cs) => (
                            <div key={cs.column} className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] space-y-2">
                              <div className="text-xs font-bold text-[#1E1915]">{cs.column}</div>
                              {cs.added_categories.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[10px] font-semibold text-emerald-700">New classes:</span>
                                  {cs.added_categories.map((c) => (
                                    <span key={c} className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono">
                                      +{c}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {cs.dropped_categories.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[10px] font-semibold text-rose-700">Lost classes:</span>
                                  {cs.dropped_categories.map((c) => (
                                    <span key={c} className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-mono">
                                      -{c}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : activeCommit ? (
              <>
                {/* Active Commit Overview */}
                <div className="p-5 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8E4DF] pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-[#1E1915]">{activeCommit.version}</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#057A55]/10 text-[#057A55] text-[10px] font-bold uppercase">
                          {activeCommit.status}
                        </span>
                        {activeCommit.is_pinned && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1">
                            <Pin className="w-3 h-3 fill-amber-700 text-amber-700" />
                            <span>Pinned</span>
                          </span>
                        )}
                        <span className="text-xs font-mono text-[#8C827A]">commit {activeCommit.hash}</span>
                      </div>
                      <h2 className="text-sm font-semibold text-[#5C554D] mt-1">
                        {activeCommit.message}
                      </h2>
                      {activeCommit.dataset_name && (
                        <p className="text-xs font-mono text-[#0061FE] mt-0.5">
                          Target: {activeCommit.dataset_name}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTogglePin(activeCommit.id)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                          activeCommit.is_pinned
                            ? "bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100"
                            : "border-[#E8E4DF] hover:bg-[#FAF8F5] text-[#736B63]"
                        }`}
                        title="Pin this version to protect against automated garbage collection"
                      >
                        <Pin className={`w-3.5 h-3.5 ${activeCommit.is_pinned ? "fill-amber-700 text-amber-700" : ""}`} />
                        <span>{activeCommit.is_pinned ? "Pinned (Protected)" : "Pin Version"}</span>
                      </button>

                      <button
                        onClick={() => handleRollback(activeCommit.id)}
                        disabled={isRollingBack}
                        className="px-3 py-1.5 rounded-xl border border-[#E8E4DF] hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 text-[#0061FE] ${isRollingBack ? "animate-spin" : ""}`} />
                        <span>{isRollingBack ? "Rolling back..." : "Rollback"}</span>
                      </button>
                    </div>
                  </div>

                  {/* SemVer, Tags, and Access Control Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                    {/* SemVer Management */}
                    <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] space-y-1.5">
                      <div className="text-[10px] uppercase font-mono text-[#8C827A] font-bold">
                        Semantic Versioning (Pillar 2.10)
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-[#1E1915]">
                          {activeCommit.version}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleBumpSemver(activeCommit.id, "patch")}
                            className="px-1.5 py-0.5 rounded bg-white border border-[#E8E4DF] hover:bg-[#0061FE] hover:text-white text-[10px] font-mono cursor-pointer transition-colors"
                            title="Bump patch: v1.0.0 -> v1.0.1"
                          >
                            +patch
                          </button>
                          <button
                            onClick={() => handleBumpSemver(activeCommit.id, "minor")}
                            className="px-1.5 py-0.5 rounded bg-white border border-[#E8E4DF] hover:bg-[#0061FE] hover:text-white text-[10px] font-mono cursor-pointer transition-colors"
                            title="Bump minor: v1.0.0 -> v1.1.0"
                          >
                            +minor
                          </button>
                          <button
                            onClick={() => handleBumpSemver(activeCommit.id, "major")}
                            className="px-1.5 py-0.5 rounded bg-white border border-[#E8E4DF] hover:bg-[#0061FE] hover:text-white text-[10px] font-mono cursor-pointer transition-colors"
                            title="Bump major: v1.0.0 -> v2.0.0"
                          >
                            +major
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Access Level Control */}
                    <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] space-y-1.5">
                      <div className="text-[10px] uppercase font-mono text-[#8C827A] font-bold flex items-center gap-1">
                        <Shield className="w-3 h-3 text-[#0061FE]" />
                        <span>Access Control (Pillar 2.14)</span>
                      </div>
                      <select
                        value={activeCommit.access_level || "workspace"}
                        onChange={(e) => handleUpdatePermissions(activeCommit.id, e.target.value)}
                        className="w-full bg-white border border-[#E8E4DF] rounded-lg p-1 text-xs font-medium text-[#1E1915] outline-none cursor-pointer"
                      >
                        <option value="workspace">Workspace Internal</option>
                        <option value="public">Public Release</option>
                        <option value="private_draft">Private Draft Only</option>
                      </select>
                    </div>

                    {/* Tags & Release Aliases */}
                    <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] space-y-1.5">
                      <div className="text-[10px] uppercase font-mono text-[#8C827A] font-bold flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3 text-purple-600" />
                          <span>Release Aliases (2.4)</span>
                        </span>
                        <button
                          onClick={() => setShowAddTag(!showAddTag)}
                          className="text-[#0061FE] hover:underline text-[10px] cursor-pointer"
                        >
                          + Add Tag
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {activeCommit.tags && activeCommit.tags.length > 0 ? (
                          activeCommit.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1"
                            >
                              <span>{tag}</span>
                              <button
                                onClick={() => handleRemoveTag(activeCommit.id, tag)}
                                className="text-purple-400 hover:text-rose-600 cursor-pointer"
                              >
                                ×
                              </button>
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-[#8C827A]">No tags added</span>
                        )}
                      </div>

                      {showAddTag && (
                        <div className="flex items-center gap-1 mt-2 pt-1 border-t border-[#E8E4DF]">
                          <input
                            type="text"
                            placeholder="e.g. prod, staging"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddTag(activeCommit.id)}
                            className="w-full bg-white border border-[#E8E4DF] rounded px-2 py-0.5 text-[10px] outline-none"
                          />
                          <button
                            onClick={() => handleAddTag(activeCommit.id)}
                            className="px-2 py-0.5 bg-[#0061FE] text-white rounded text-[10px] font-semibold cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Custom Metadata Table (Pillar 2.17) */}
                  <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] space-y-2">
                    <div className="flex items-center justify-between text-[10px] uppercase font-mono text-[#8C827A] font-bold">
                      <span>Custom Key-Value Version Metadata (Pillar 2.17)</span>
                      <button
                        onClick={() => setShowAddMeta(!showAddMeta)}
                        className="text-[#0061FE] hover:underline cursor-pointer"
                      >
                        + Add Attribute
                      </button>
                    </div>

                    {activeCommit.custom_metadata && Object.keys(activeCommit.custom_metadata).length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {Object.entries(activeCommit.custom_metadata).map(([k, v]) => (
                          <div key={k} className="p-2 rounded-lg bg-white border border-[#E8E4DF] text-xs">
                            <div className="text-[10px] text-[#8C827A] font-mono">{k}</div>
                            <div className="font-semibold text-[#1E1915] font-mono truncate">{String(v)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#8C827A]">No custom pipeline or model metadata recorded for this version.</p>
                    )}

                    {showAddMeta && (
                      <div className="flex items-center gap-2 pt-2 border-t border-[#E8E4DF]">
                        <input
                          type="text"
                          placeholder="Key (e.g. train_acc)"
                          value={metaKey}
                          onChange={(e) => setMetaKey(e.target.value)}
                          className="bg-white border border-[#E8E4DF] rounded px-2 py-1 text-xs outline-none w-1/3"
                        />
                        <input
                          type="text"
                          placeholder="Value (e.g. 0.94)"
                          value={metaValue}
                          onChange={(e) => setMetaValue(e.target.value)}
                          className="bg-white border border-[#E8E4DF] rounded px-2 py-1 text-xs outline-none flex-1"
                        />
                        <button
                          onClick={() => handleAddMetadata(activeCommit.id)}
                          className="px-3 py-1 bg-[#0061FE] text-white rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Delta Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF]">
                      <div className="text-[10px] uppercase font-mono text-[#8C827A]">Rows Delta</div>
                      <div className="text-sm font-bold text-[#1E1915] mt-0.5">{activeCommit.deltaRows}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF]">
                      <div className="text-[10px] uppercase font-mono text-[#8C827A]">Columns Delta</div>
                      <div className="text-sm font-bold text-emerald-600 mt-0.5">{activeCommit.deltaColumns}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF]">
                      <div className="text-[10px] uppercase font-mono text-[#8C827A]">Committed By</div>
                      <div className="text-sm font-bold text-[#1E1915] mt-0.5">{activeCommit.author}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF]">
                      <div className="text-[10px] uppercase font-mono text-[#8C827A]">Timestamp</div>
                      <div className="text-sm font-bold text-[#736B63] mt-0.5">{activeCommit.date}</div>
                    </div>
                  </div>
                </div>

                {/* Schema & Column Diff Breakdown */}
                <div className="p-5 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-[#1E1915] flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-[#0061FE]" />
                    <span>Schema & Transformation Lineage</span>
                  </h3>

                  {/* Added Columns */}
                  {activeCommit.diffSummary?.addedCols && activeCommit.diffSummary.addedCols.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Indexed Columns ({activeCommit.diffSummary.addedCols.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {activeCommit.diffSummary.addedCols.map((col) => (
                          <span
                            key={col}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-medium flex items-center gap-1"
                          >
                            <span>+</span>
                            <span>{col}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-[#FAF8F5] text-xs text-[#8C827A] text-center">
                      Clean snapshot state. All columns verified in DuckDB catalog.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-12 text-center rounded-2xl bg-white border border-[#E8E4DF]">
                <p className="text-xs text-[#8C827A]">Select a commit to view its diff details.</p>
              </div>
            )}
          </main>
        </div>
      )}

      {/* Create Snapshot Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E8E4DF] shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#E8E4DF] pb-3">
              <h3 className="text-sm font-bold text-[#1E1915] flex items-center gap-2">
                <GitCommit className="w-4 h-4 text-[#0061FE]" />
                <span>Create Version Snapshot</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#8C827A] hover:text-[#1E1915] p-1 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSnapshot} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#5C554D] block mb-1">
                  Target Dataset
                </label>
                <select
                  value={newCommitDataset}
                  onChange={(e) => setNewCommitDataset(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs text-[#1E1915] outline-none cursor-pointer"
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.filename}>
                      {d.filename}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#5C554D] block mb-1">
                  Commit Message
                </label>
                <textarea
                  required
                  value={newCommitMessage}
                  onChange={(e) => setNewCommitMessage(e.target.value)}
                  placeholder="Describe your dataset transformations or cleaning steps..."
                  className="w-full px-3 py-2 rounded-xl border border-[#E8E4DF] text-xs text-[#1E1915] outline-none h-24 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#E8E4DF] hover:bg-[#FAF8F5] text-xs font-semibold text-[#736B63] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newCommitMessage.trim()}
                  className="px-4 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold shadow-sm disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmitting ? "Creating..." : "Commit Snapshot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
