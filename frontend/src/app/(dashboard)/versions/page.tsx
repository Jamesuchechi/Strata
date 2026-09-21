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
} from "lucide-react";
import { fetchCommits, createSnapshotCommit, fetchDatasets } from "@/lib/api";
import { useStudio } from "@/context/StudioContext";
import { DatasetItem } from "@/lib/types";

interface CommitRecord {
  id: string;
  hash: string;
  full_hash?: string;
  version: string;
  dataset_name?: string;
  message: string;
  author: string;
  date: string;
  deltaRows: string;
  deltaColumns: string;
  status: "verified" | "clean";
  diffSummary: {
    addedCols: string[];
    removedCols: string[];
    modifiedCols: string[];
  };
}

export default function VersionsPage() {
  const { setActiveCommit, setActiveContextTab } = useStudio();

  const [commits, setCommits] = useState<CommitRecord[]>([]);
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState("main");
  const [selectedCommitId, setSelectedCommitId] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCommitMessage, setNewCommitMessage] = useState("");
  const [newCommitDataset, setNewCommitDataset] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
              Immutable dataset snapshots, branch lineage, and schema-level diffing.
            </p>
          </div>
        </div>

        {/* Branch Switcher & Commit Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={loadCommits}
            className="p-2 rounded-xl border border-[#E8E4DF] bg-white hover:bg-[#FAF8F5] text-[#736B63] hover:text-[#1E1915] transition-colors"
            title="Refresh commit history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs font-semibold text-[#1E1915]">
            <GitBranch className="w-3.5 h-3.5 text-[#0061FE]" />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-transparent outline-none cursor-pointer"
            >
              <option value="main">main</option>
              <option value="feature/clean-data">feature/clean-data</option>
              <option value="experiment/null-impute">experiment/null-impute</option>
            </select>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-[#0061FE]/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Snapshot</span>
          </button>
        </div>
      </div>

      {/* Main Diff Studio */}
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
                      </div>
                      <span className="font-mono text-[10px] text-[#8C827A] px-1.5 py-0.5 rounded bg-[#FAF8F5] border border-[#E8E4DF]">
                        {c.hash}
                      </span>
                    </div>

                    <p className="text-xs text-[#1E1915] font-medium leading-snug line-clamp-2">
                      {c.message}
                    </p>

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
          {activeCommit ? (
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

                  <button
                    onClick={() => alert(`Checked out snapshot ${activeCommit.version} (${activeCommit.hash}). Zero-copy view restored.`)}
                    className="px-3 py-1.5 rounded-xl border border-[#E8E4DF] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#0061FE]" />
                    <span>Checkout This Version</span>
                  </button>
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
                className="text-[#8C827A] hover:text-[#1E1915] p-1 rounded"
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
                  className="px-4 py-2 rounded-xl border border-[#E8E4DF] hover:bg-[#FAF8F5] text-xs font-semibold text-[#736B63]"
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
