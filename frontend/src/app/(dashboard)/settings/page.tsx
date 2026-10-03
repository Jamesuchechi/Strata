"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Sliders,
  Shield,
  Cpu,
  Users,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Copy,
  Trash2,
  Lock,
  HardDrive,
  RefreshCw,
  Plus,
  ChevronRight,
  ExternalLink,
  Zap,
  Globe,
  Database,
} from "lucide-react";
import {
  fetchWorkspaces,
  fetchWorkspaceDetails,
  updateWorkspaceSettings,
  deleteWorkspace,
  fetchWorkspaceMembers,
  createWorkspace,
  fetchDatasets,
} from "@/lib/api";
import { WorkspaceItem, WorkspaceMember, DatasetItem } from "@/lib/types";

export default function WorkspaceSettingsPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>("");
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceItem | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"general" | "compute" | "governance" | "team" | "danger">("general");

  // Form States
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultRole, setDefaultRole] = useState("Analyst");
  const [plan, setPlan] = useState("Community Free");

  // Compute Settings
  const [sandboxTimeout, setSandboxTimeout] = useState(60);
  const [sandboxMemory, setSandboxMemory] = useState(512);
  const [retentionDays, setRetentionDays] = useState(30);

  // Security Settings
  const [enforceMfa, setEnforceMfa] = useState(false);
  const [restrictPublicSharing, setRestrictPublicSharing] = useState(false);

  // Messages
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Create Workspace Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [newWsDesc, setNewWsDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Delete Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Copied State
  const [idCopied, setIdCopied] = useState(false);

  const loadAll = async (targetId?: string) => {
    setIsLoading(true);
    try {
      const wsList = await fetchWorkspaces();
      setWorkspaces(wsList);

      const targetWsId =
        targetId && wsList.some((w) => w.id === targetId)
          ? targetId
          : wsList.length > 0
          ? wsList[0].id
          : "ws_primary";

      setActiveWorkspaceId(targetWsId);

      const [wsDetail, memData, dsList] = await Promise.all([
        fetchWorkspaceDetails(targetWsId).catch(() => null),
        fetchWorkspaceMembers(targetWsId).catch(() => ({ members: [], pending_invites: [] })),
        fetchDatasets().catch(() => []),
      ]);

      if (wsDetail) {
        setCurrentWorkspace(wsDetail);
        setName(wsDetail.name || "");
        setDescription(wsDetail.description || "");
        setDefaultRole(wsDetail.default_role || "Analyst");
        setPlan(wsDetail.plan || "Community Free");
        setSandboxTimeout(wsDetail.sandbox_timeout_sec || 60);
        setSandboxMemory(wsDetail.sandbox_max_memory_mb || 512);
        setRetentionDays(wsDetail.retention_days || 30);
        setEnforceMfa(!!wsDetail.enforce_mfa);
        setRestrictPublicSharing(!!wsDetail.restrict_public_sharing);
      }
      setMembers(memData.members || []);
      setDatasets(dsList || []);
    } catch (err: any) {
      console.error("Failed to load workspace settings:", err);
      setErrorMsg(err.message || "Failed to load workspace");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleWorkspaceChange = async (wsId: string) => {
    setActiveWorkspaceId(wsId);
    setIsLoading(true);
    try {
      const [wsDetail, memData] = await Promise.all([
        fetchWorkspaceDetails(wsId),
        fetchWorkspaceMembers(wsId).catch(() => ({ members: [], pending_invites: [] })),
      ]);
      setCurrentWorkspace(wsDetail);
      setName(wsDetail.name || "");
      setDescription(wsDetail.description || "");
      setDefaultRole(wsDetail.default_role || "Analyst");
      setPlan(wsDetail.plan || "Community Free");
      setSandboxTimeout(wsDetail.sandbox_timeout_sec || 60);
      setSandboxMemory(wsDetail.sandbox_max_memory_mb || 512);
      setRetentionDays(wsDetail.retention_days || 30);
      setEnforceMfa(!!wsDetail.enforce_mfa);
      setRestrictPublicSharing(!!wsDetail.restrict_public_sharing);
      setMembers(memData.members || []);
    } catch (err) {
      console.error("Failed to change workspace:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId) return;

    setIsSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const res = await updateWorkspaceSettings(activeWorkspaceId, {
        name: name.trim(),
        description: description.trim(),
        plan,
        default_role: defaultRole,
        sandbox_timeout_sec: Number(sandboxTimeout),
        sandbox_max_memory_mb: Number(sandboxMemory),
        retention_days: Number(retentionDays),
        enforce_mfa: enforceMfa,
        restrict_public_sharing: restrictPublicSharing,
      });
      setCurrentWorkspace(res.workspace);
      setSuccessMsg("Workspace settings updated and applied across all members!");
      setTimeout(() => setSuccessMsg(""), 4000);
      // Refresh list to update workspace name in switcher
      const refreshedList = await fetchWorkspaces();
      setWorkspaces(refreshedList);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update workspace settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    setIsCreating(true);
    try {
      const created = await createWorkspace(newWsName.trim(), newWsDesc.trim());
      setShowCreateModal(false);
      setNewWsName("");
      setNewWsDesc("");
      loadAll(created.id);
    } catch (err: any) {
      alert(err.message || "Failed to create workspace");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (deleteConfirmText !== currentWorkspace?.name) {
      alert("Please type the exact workspace name to confirm deletion.");
      return;
    }

    setIsDeleting(true);
    try {
      await deleteWorkspace(activeWorkspaceId);
      setShowDeleteModal(false);
      setDeleteConfirmText("");
      router.push("/workspace");
    } catch (err: any) {
      alert(err.message || "Failed to delete workspace");
    } finally {
      setIsDeleting(false);
    }
  };

  const copyWsId = () => {
    if (!activeWorkspaceId) return;
    navigator.clipboard.writeText(activeWorkspaceId);
    setIdCopied(true);
    setTimeout(() => setIdCopied(false), 2000);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 lg:p-8 space-y-6">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#736B63] mb-1">
            <Link href="/workspace" className="hover:text-[#1E1915] transition-colors">
              Workspace & Team
            </Link>
            <ChevronRight className="w-3 h-3 text-[#B0A8A0]" />
            <span className="text-[#1E1915] font-semibold">Settings & Governance</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E1915]">
            Workspace Settings
          </h1>
          <p className="text-sm text-[#736B63] mt-0.5">
            Configure organization branding, memory allocations, compute limits, and RBAC governance.
          </p>
        </div>

        {/* Workspace Switcher Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-[#E8E4DF] rounded-xl px-3 py-1.5 shadow-sm">
            <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <select
              value={activeWorkspaceId}
              onChange={(e) => handleWorkspaceChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-[#1E1915] focus:outline-none cursor-pointer pr-4"
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-[#0061FE] hover:bg-[#0052D6] text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Workspace</span>
          </button>
        </div>
      </div>

      {/* Workspace Quick Hero Card */}
      <div className="rounded-2xl border border-[#E8E4DF] bg-gradient-to-r from-white via-white to-[#F8F6F2] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-indigo-900 text-white text-2xl font-bold flex items-center justify-center font-mono shadow-md">
            {currentWorkspace?.name ? currentWorkspace.name.charAt(0).toUpperCase() : "W"}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#1E1915]">
                {currentWorkspace?.name || "Workspace"}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-mono font-bold uppercase tracking-wider">
                {currentWorkspace?.plan || "Pro Team"}
              </span>
            </div>
            <p className="text-xs text-[#736B63] mt-1 max-w-xl">
              {currentWorkspace?.description || "High-performance collaborative analytics workspace."}
            </p>
            <div className="flex items-center gap-4 text-[11px] text-[#8C827A] mt-2">
              <span className="flex items-center gap-1 font-mono">
                ID: <code className="bg-[#EFECE6] px-1 py-0.5 rounded">{activeWorkspaceId}</code>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#736B63]" /> {members.length} Members
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-emerald-600" /> {datasets.length} Datasets
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t md:border-t-0 pt-4 md:pt-0 border-[#E8E4DF]">
          <button
            onClick={copyWsId}
            className="px-3 py-1.5 rounded-lg border border-[#E8E4DF] bg-white hover:bg-[#F7F5F2] text-xs font-medium text-[#5C554D] flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{idCopied ? "Copied ID!" : "Copy ID"}</span>
          </button>
          <Link
            href="/workspace"
            className="px-3 py-1.5 rounded-lg bg-[#1E1915] hover:bg-black text-white text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Manage Team</span>
          </Link>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-[#E8E4DF] pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${
            activeTab === "general"
              ? "border-[#0061FE] text-[#0061FE]"
              : "border-transparent text-[#736B63] hover:text-[#1E1915] hover:border-[#D1C9BE]"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>General & Profile</span>
        </button>

        <button
          onClick={() => setActiveTab("compute")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${
            activeTab === "compute"
              ? "border-[#0061FE] text-[#0061FE]"
              : "border-transparent text-[#736B63] hover:text-[#1E1915] hover:border-[#D1C9BE]"
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Compute & Engine</span>
        </button>

        <button
          onClick={() => setActiveTab("governance")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${
            activeTab === "governance"
              ? "border-[#0061FE] text-[#0061FE]"
              : "border-transparent text-[#736B63] hover:text-[#1E1915] hover:border-[#D1C9BE]"
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Security & Governance</span>
        </button>

        <button
          onClick={() => setActiveTab("team")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${
            activeTab === "team"
              ? "border-[#0061FE] text-[#0061FE]"
              : "border-transparent text-[#736B63] hover:text-[#1E1915] hover:border-[#D1C9BE]"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Team Roles & RBAC</span>
        </button>

        <button
          onClick={() => setActiveTab("danger")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${
            activeTab === "danger"
              ? "border-rose-600 text-rose-600"
              : "border-transparent text-[#736B63] hover:text-rose-600 hover:border-rose-200"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Danger Zone</span>
        </button>
      </div>

      {/* Global Feedback Banner */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tab 1: General & Profile */}
      {activeTab === "general" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-[#E8E4DF] bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[#1E1915] mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#0061FE]" />
                Workspace Identification
              </h3>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#1E1915] mb-1.5">
                      Workspace Display Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Core Data Platform"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] text-xs text-[#1E1915] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 focus:border-[#0061FE] transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1E1915] mb-1.5">
                      URL Slug
                    </label>
                    <input
                      type="text"
                      disabled
                      value={name.toLowerCase().replace(/\s+/g, "-")}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#E8E4DF] bg-[#F2EFE9] text-xs text-[#736B63] font-mono cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1E1915] mb-1.5">
                    Description & Purpose
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the datasets, analytical missions, or team domain of this workspace..."
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] text-xs text-[#1E1915] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 focus:border-[#0061FE] transition-all resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#1E1915] mb-1.5">
                      Default Member Role
                    </label>
                    <select
                      value={defaultRole}
                      onChange={(e) => setDefaultRole(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] text-xs text-[#1E1915] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 focus:border-[#0061FE]"
                    >
                      <option value="Viewer">Viewer (Read-only SQL and Table inspection)</option>
                      <option value="Analyst">Analyst (SQL Queries, Visual Charts, AI Analyst)</option>
                      <option value="Editor">Editor (Dataset Uploads, Commits, Pipeline Edits)</option>
                      <option value="Admin">Admin (Full RBAC and Governance Permissions)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1E1915] mb-1.5">
                      Workspace Tier / Plan
                    </label>
                    <select
                      value={plan}
                      onChange={(e) => setPlan(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] text-xs text-[#1E1915] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 focus:border-[#0061FE]"
                    >
                      <option value="Community Free">Community Free</option>
                      <option value="Pro Team">Pro Team (Unlimited DuckDB sandbox & AI)</option>
                      <option value="Enterprise Scale">Enterprise Scale (VPC Peering & Dedicated Nodes)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D6] text-white text-xs font-semibold shadow-md shadow-[#0061FE]/20 flex items-center gap-2 transition-all disabled:opacity-60"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Workspace Changes</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-[#E8E4DF] bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[#1E1915] mb-3 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-600" />
                Storage & Volume
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-[#E8E4DF]">
                  <span className="text-[#736B63]">Active Datasets</span>
                  <span className="font-semibold text-[#1E1915]">{datasets.length}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[#E8E4DF]">
                  <span className="text-[#736B63]">DuckDB Vector Storage</span>
                  <span className="font-mono text-emerald-700 font-semibold">Parquet columnar</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-[#736B63]">Git Branches</span>
                  <span className="font-mono text-[#1E1915]">Multiple (main default)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Compute & Engine */}
      {activeTab === "compute" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-[#E8E4DF] bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[#1E1915] mb-4 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#0061FE]" />
                DuckDB & Python Pipeline Execution Quotas
              </h3>

              <form onSubmit={handleSaveSettings} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-[#1E1915] mb-1.5">
                    Pipeline Execution Sandbox Timeout (Seconds)
                  </label>
                  <select
                    value={sandboxTimeout}
                    onChange={(e) => setSandboxTimeout(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] text-xs text-[#1E1915] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 focus:border-[#0061FE]"
                  >
                    <option value={30}>30 Seconds (Quick transformations)</option>
                    <option value={60}>60 Seconds (Standard default)</option>
                    <option value={180}>180 Seconds (Heavy ML / Feature engineering)</option>
                    <option value={300}>300 Seconds (Batch jobs & Large multi-joins)</option>
                  </select>
                  <p className="text-[11px] text-[#736B63] mt-1">
                    Python code executed inside the AST-guarded compute sandbox will be interrupted if it exceeds this threshold.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1E1915] mb-1.5">
                    Maximum Memory Limit per Pipeline Run (MB)
                  </label>
                  <select
                    value={sandboxMemory}
                    onChange={(e) => setSandboxMemory(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] text-xs text-[#1E1915] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 focus:border-[#0061FE]"
                  >
                    <option value={256}>256 MB (Lightweight queries)</option>
                    <option value={512}>512 MB (Default Balanced)</option>
                    <option value={1024}>1024 MB / 1 GB (Medium analytics)</option>
                    <option value={2048}>2048 MB / 2 GB (High memory ML training)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1E1915] mb-1.5">
                    Data Trash & Dead-Letter Job Retention (Days)
                  </label>
                  <select
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] text-xs text-[#1E1915] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 focus:border-[#0061FE]"
                  >
                    <option value={7}>7 Days</option>
                    <option value={30}>30 Days (Recommended)</option>
                    <option value={90}>90 Days</option>
                    <option value={365}>365 Days (Compliance Long-term)</option>
                  </select>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D6] text-white text-xs font-semibold shadow-md shadow-[#0061FE]/20 flex items-center gap-2 transition-all disabled:opacity-60"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving Compute Settings...</span>
                      </>
                    ) : (
                      <span>Save Compute Limits</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-[#E8E4DF] bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[#1E1915] mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600" />
                DuckDB Vector Architecture
              </h3>
              <p className="text-xs text-[#736B63] leading-relaxed">
                Strata executes analytical queries directly using DuckDB&apos;s vectorized execution engine, processing millions of rows per second with zero serialization overhead.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Security & Governance */}
      {activeTab === "governance" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-[#E8E4DF] bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[#1E1915] mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#0061FE]" />
                Security & Access Governance
              </h3>

              <form onSubmit={handleSaveSettings} className="space-y-5">
                <div className="space-y-4">
                  <label className="flex items-start gap-3.5 p-3.5 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] cursor-pointer hover:bg-white transition-colors">
                    <input
                      type="checkbox"
                      checked={enforceMfa}
                      onChange={(e) => setEnforceMfa(e.target.checked)}
                      className="rounded text-[#0061FE] focus:ring-[#0061FE] w-4 h-4 mt-0.5"
                    />
                    <div>
                      <div className="text-xs font-bold text-[#1E1915]">
                        Enforce Multi-Factor Authentication (MFA / 2FA)
                      </div>
                      <div className="text-[11px] text-[#736B63] mt-0.5">
                        Require all workspace members to authenticate with 2FA before accessing datasets and running SQL queries.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3.5 p-3.5 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] cursor-pointer hover:bg-white transition-colors">
                    <input
                      type="checkbox"
                      checked={restrictPublicSharing}
                      onChange={(e) => setRestrictPublicSharing(e.target.checked)}
                      className="rounded text-[#0061FE] focus:ring-[#0061FE] w-4 h-4 mt-0.5"
                    />
                    <div>
                      <div className="text-xs font-bold text-[#1E1915]">
                        Restrict Public Share Links
                      </div>
                      <div className="text-[11px] text-[#736B63] mt-0.5">
                        Prevent team members from publishing anonymous dataset share links or embedding charts outside the workspace domain.
                      </div>
                    </div>
                  </label>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D6] text-white text-xs font-semibold shadow-md shadow-[#0061FE]/20 flex items-center gap-2 transition-all disabled:opacity-60"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving Security Settings...</span>
                      </>
                    ) : (
                      <span>Save Governance Policy</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-[#E8E4DF] bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[#1E1915] mb-3 flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600" />
                Immutable Audit Trail
              </h3>
              <p className="text-xs text-[#736B63] mb-4">
                All dataset access, schema migrations, and permission changes are cryptographically logged with hash chaining.
              </p>
              <Link
                href="/workspace"
                className="text-xs font-semibold text-[#0061FE] hover:underline flex items-center gap-1"
              >
                <span>View Workspace Audit Logs</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Team Roles & RBAC */}
      {activeTab === "team" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#E8E4DF] bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-sm font-bold text-[#1E1915] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#0061FE]" />
                  Workspace Team Roster & Roles
                </h3>
                <p className="text-xs text-[#736B63] mt-0.5">
                  {members.length} active team members with configured access controls.
                </p>
              </div>

              <Link
                href="/workspace"
                className="px-4 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D6] text-white text-xs font-semibold shadow-md shadow-[#0061FE]/20 flex items-center gap-1.5 transition-all self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Invite New Teammate</span>
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E8E4DF] text-[#736B63] font-mono text-[11px] uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Teammate</th>
                    <th className="pb-3 font-semibold">Email</th>
                    <th className="pb-3 font-semibold">Role</th>
                    <th className="pb-3 font-semibold">Joined Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E4DF]">
                  {members.map((m) => (
                    <tr key={m.id} className="hover:bg-[#FAF8F5] transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#1E1915] text-white text-xs font-semibold flex items-center justify-center font-mono">
                            {m.name ? m.name.charAt(0).toUpperCase() : "U"}
                          </div>
                          <span className="font-semibold text-[#1E1915]">{m.name}</span>
                        </div>
                      </td>
                      <td className="py-3 font-mono text-[#5C554D]">{m.email}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            m.role === "Owner"
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : m.role === "Admin"
                              ? "bg-indigo-100 text-indigo-900 border border-indigo-200"
                              : "bg-[#0061FE]/10 text-[#0061FE]"
                          }`}
                        >
                          {m.role}
                        </span>
                      </td>
                      <td className="py-3 text-[#736B63]">
                        {new Date(m.joined_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Danger Zone */}
      {activeTab === "danger" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-rose-200 bg-rose-50/20 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-rose-900 flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Destructive Workspace Actions
            </h3>
            <p className="text-xs text-rose-800/80 mb-6">
              Actions taken in this zone are permanent. Please proceed with caution.
            </p>

            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-rose-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-[#1E1915]">
                    Delete Workspace
                  </h4>
                  <p className="text-xs text-[#736B63] mt-0.5 max-w-lg">
                    Permanently delete <strong className="text-[#1E1915]">{currentWorkspace?.name}</strong>, all associated metadata, branches, and member allocations. Primary workspace is protected.
                  </p>
                </div>

                <button
                  disabled={activeWorkspaceId === "ws_primary"}
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  Delete This Workspace
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Workspace */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E8E4DF] max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E4DF] mb-4">
              <h3 className="text-sm font-bold text-[#1E1915] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#0061FE]" />
                Create New Workspace
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#8C827A] hover:text-[#1E1915] text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1E1915] mb-1">
                  Workspace Name
                </label>
                <input
                  type="text"
                  required
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  placeholder="e.g. Risk Analytics, Product Growth"
                  className="w-full px-3 py-2 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] text-xs text-[#1E1915] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 focus:border-[#0061FE]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E1915] mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={newWsDesc}
                  onChange={(e) => setNewWsDesc(e.target.value)}
                  placeholder="Brief summary of workspace focus..."
                  className="w-full px-3 py-2 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] text-xs text-[#1E1915] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 focus:border-[#0061FE] resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#E8E4DF] bg-white text-xs font-semibold text-[#5C554D] hover:bg-[#FAF8F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D6] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isCreating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Workspace</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Workspace Confirmation */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-rose-200 max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-950">
                  Delete Workspace Confirmation
                </h3>
                <p className="text-xs text-[#736B63]">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-[#5C554D] mb-4">
              To confirm deletion, please type the exact workspace name: <strong className="text-[#1E1915] font-bold">{currentWorkspace?.name}</strong>
            </p>

            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type workspace name here"
              className="w-full px-3.5 py-2 rounded-xl border border-rose-300 bg-rose-50/20 text-xs text-[#1E1915] focus:outline-none focus:ring-2 focus:ring-rose-500/30 mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText("");
                }}
                className="px-4 py-2 rounded-xl border border-[#E8E4DF] bg-white text-xs font-semibold text-[#5C554D] hover:bg-[#FAF8F5]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting || deleteConfirmText !== currentWorkspace?.name}
                onClick={handleDeleteWorkspace}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
