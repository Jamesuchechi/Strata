"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Building2,
  UserPlus,
  Shield,
  Clock,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Copy,
  Plus,
  Lock,
  ChevronDown,
  Activity,
  Layers,
  Sparkles,
  Search,
} from "lucide-react";
import {
  fetchWorkspaces,
  createWorkspace,
  fetchWorkspaceMembers,
  inviteWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
  fetchWorkspaceActivity,
  fetchWorkspacePermissions,
  setDatasetPermission,
  fetchDatasets,
} from "@/lib/api";
import {
  WorkspaceItem,
  WorkspaceMember,
  WorkspaceInvite,
  ActivityFeedItem,
  DatasetItem,
} from "@/lib/types";

export default function WorkspacePage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>("ws_default");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [activity, setActivity] = useState<ActivityFeedItem[]>([]);
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [permissions, setPermissions] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"members" | "permissions" | "activity">("members");

  const [isLoading, setIsLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Analyst");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  const [showCreateWsModal, setShowCreateWsModal] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [newWsDesc, setNewWsDesc] = useState("");

  const loadData = async (wsId: string) => {
    setIsLoading(true);
    try {
      const [wsList, memData, actFeed, dsList, permData] = await Promise.all([
        fetchWorkspaces(),
        fetchWorkspaceMembers(wsId),
        fetchWorkspaceActivity(wsId),
        fetchDatasets(),
        fetchWorkspacePermissions(wsId),
      ]);
      setWorkspaces(wsList);
      setMembers(memData.members || []);
      setInvites(memData.pending_invites || []);
      setActivity(actFeed || []);
      setDatasets(dsList || []);
      setPermissions(permData || {});
    } catch (err) {
      console.error("Failed to load workspace data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(activeWorkspaceId);
  }, [activeWorkspaceId]);

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      const res = await inviteWorkspaceMember(activeWorkspaceId, inviteEmail.trim(), inviteRole);
      setInvites((prev) => [res.invitation, ...prev]);
      setLastInviteUrl(res.invitation.invite_url || `https://strata.ai/join?token=${res.invitation.invite_token}`);
      setInviteEmail("");
    } catch (err: any) {
      alert(`Invite failed: ${err.message}`);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to revoke this member's access?")) return;
    try {
      await removeWorkspaceMember(activeWorkspaceId, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateRole = async (memberId: string, role: string) => {
    try {
      await updateWorkspaceMemberRole(activeWorkspaceId, memberId, role);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: role as any } : m))
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdatePermission = async (datasetId: string, minRole: string) => {
    try {
      await setDatasetPermission(activeWorkspaceId, datasetId, minRole);
      setPermissions((prev) => ({ ...prev, [datasetId]: minRole }));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    try {
      const created = await createWorkspace(newWsName.trim(), newWsDesc.trim());
      setWorkspaces((prev) => [...prev, created]);
      setActiveWorkspaceId(created.id);
      setShowCreateWsModal(false);
      setNewWsName("");
      setNewWsDesc("");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "Owner":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "Admin":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "Editor":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "Analyst":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      default:
        return "bg-stone-100 text-stone-700 border-stone-300";
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F5F2] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[#E8E4DF] bg-white px-6 py-4 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-[#0061FE]/10 text-[#0061FE]">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-[#1E1915]">
                {activeWs?.name || "Team Workspace"}
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold">
                {activeWs?.plan || "Pro Team"}
              </span>
            </div>
            <p className="text-xs text-[#8C827A]">
              Role-based access control, organization members, permission overrides & activity feed (Pillar 9).
            </p>
          </div>
        </div>

        {/* Workspace Switcher & Invite CTA */}
        <div className="flex items-center gap-2">
          <select
            value={activeWorkspaceId}
            onChange={(e) => setActiveWorkspaceId(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] outline-none cursor-pointer"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowCreateWsModal(true)}
            className="p-2 rounded-xl border border-[#E8E4DF] bg-white hover:bg-[#FAF8F5] text-[#736B63] hover:text-[#1E1915] text-xs font-semibold cursor-pointer"
            title="Create New Workspace"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowInviteModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-[#0061FE]/20 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Invite Member</span>
          </button>
        </div>
      </div>

      {/* Workspace Tabs Bar */}
      <div className="border-b border-[#E8E4DF] bg-white px-6 flex items-center gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("members")}
          className={`py-3 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "members"
              ? "border-[#0061FE] text-[#0061FE]"
              : "border-transparent text-[#736B63] hover:text-[#1E1915]"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Members & Roles ({members.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("permissions")}
          className={`py-3 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "permissions"
              ? "border-[#0061FE] text-[#0061FE]"
              : "border-transparent text-[#736B63] hover:text-[#1E1915]"
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Dataset Permission Overrides (9.3)</span>
        </button>
        <button
          onClick={() => setActiveTab("activity")}
          className={`py-3 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "activity"
              ? "border-[#0061FE] text-[#0061FE]"
              : "border-transparent text-[#736B63] hover:text-[#1E1915]"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Activity Audit Feed (9.5)</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 max-w-6xl w-full mx-auto space-y-6">
        {activeTab === "members" && (
          <div className="space-y-6">
            {/* Active Members Table */}
            <div className="p-5 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E8E4DF] pb-3">
                <h3 className="text-sm font-bold text-[#1E1915] flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#0061FE]" />
                  <span>Organization Members & Granular Roles (Pillar 9.2)</span>
                </h3>
                <span className="text-xs text-[#8C827A] font-mono">
                  Owner · Admin · Editor · Analyst · Viewer
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E8E4DF] text-[#8C827A] font-semibold">
                      <th className="py-2.5 px-3">Member</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Joined</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id} className="border-b border-[#E8E4DF]/50 hover:bg-[#FAF8F5]">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#0061FE]/10 text-[#0061FE] font-bold flex items-center justify-center text-xs">
                              {m.avatar}
                            </div>
                            <div>
                              <div className="font-semibold text-[#1E1915]">{m.name}</div>
                              <div className="text-[11px] text-[#8C827A] font-mono">{m.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {m.role === "Owner" ? (
                            <span className="px-2.5 py-1 rounded-lg border text-[11px] font-bold bg-amber-50 text-amber-800 border-amber-300">
                              Owner
                            </span>
                          ) : (
                            <select
                              value={m.role}
                              onChange={(e) => handleUpdateRole(m.id, e.target.value)}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold outline-none cursor-pointer ${getRoleBadgeColor(m.role)}`}
                            >
                              <option value="Admin">Admin</option>
                              <option value="Editor">Editor</option>
                              <option value="Analyst">Analyst</option>
                              <option value="Viewer">Viewer</option>
                            </select>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[#736B63] font-mono">
                          {new Date(m.joined_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {m.role !== "Owner" && (
                            <button
                              onClick={() => handleRemoveMember(m.id)}
                              className="text-stone-400 hover:text-rose-600 p-1.5 rounded cursor-pointer transition-colors"
                              title="Revoke access"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pending Invitations */}
            {invites.length > 0 && (
              <div className="p-5 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E1915]">
                  Pending Invitations (Pillar 9.4)
                </h3>
                <div className="space-y-2">
                  {invites.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-[#1E1915] font-semibold">{inv.email}</span>
                        <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-bold">
                          Role: {inv.role}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#8C827A]">Status: {inv.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "permissions" && (
          <div className="p-5 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-4">
            <div className="border-b border-[#E8E4DF] pb-3">
              <h3 className="text-sm font-bold text-[#1E1915] flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#0061FE]" />
                <span>Per-Dataset & Per-Branch Access Overrides (Pillar 9.3)</span>
              </h3>
              <p className="text-xs text-[#8C827A] mt-1">
                Enforce strict modification gates. Only members with at least the selected role can edit or commit versions to these datasets.
              </p>
            </div>

            <div className="space-y-3">
              {datasets.map((d) => {
                const currentMinRole = permissions[d.id] || "Editor";
                return (
                  <div
                    key={d.id}
                    className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-xs text-[#1E1915]">{d.filename}</div>
                      <div className="text-[11px] text-[#8C827A]">
                        {d.total_rows.toLocaleString()} rows · {d.format.toUpperCase()} · Quality: {d.quality_score || 90}%
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#5C554D]">Minimum Edit Role:</span>
                      <select
                        value={currentMinRole}
                        onChange={(e) => handleUpdatePermission(d.id, e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-[#E8E4DF] text-xs font-semibold text-[#1E1915] outline-none cursor-pointer"
                      >
                        <option value="Viewer">Viewer (Open to All)</option>
                        <option value="Analyst">Analyst</option>
                        <option value="Editor">Editor (Recommended)</option>
                        <option value="Admin">Admin Only</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "activity" && (
          <div className="p-5 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-4">
            <div className="border-b border-[#E8E4DF] pb-3">
              <h3 className="text-sm font-bold text-[#1E1915] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#0061FE]" />
                <span>Real-Time Organization Activity Feed (Pillar 9.5)</span>
              </h3>
              <p className="text-xs text-[#8C827A] mt-1">
                Immutable audit trail of all ingestion, transformation commits, tags, and AutoML workflows across the workspace.
              </p>
            </div>

            <div className="space-y-3">
              {activity.map((act) => (
                <div
                  key={act.id}
                  className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] flex items-start gap-3 text-xs"
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-[#0061FE] mt-1.5 shrink-0" />
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1E1915]">{act.actor_name}</span>
                      <span className="text-[10px] text-[#8C827A] font-mono">{act.timestamp}</span>
                    </div>
                    <p className="text-[#5C554D] leading-snug">{act.details}</p>
                    <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-[#8C827A]">
                      <span className="px-1.5 py-0.5 rounded bg-white border border-[#E8E4DF]">
                        {act.action}
                      </span>
                      <span>Target: {act.dataset_name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E8E4DF] shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#E8E4DF] pb-3">
              <h3 className="text-sm font-bold text-[#1E1915] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#0061FE]" />
                <span>Invite Member to {activeWs?.name}</span>
              </h3>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setLastInviteUrl(null);
                }}
                className="text-[#8C827A] hover:text-[#1E1915] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#5C554D] block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E8E4DF] text-xs text-[#1E1915] outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#5C554D] block mb-1">
                  Workspace Role (Pillar 9.2)
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs text-[#1E1915] outline-none cursor-pointer"
                >
                  <option value="Admin">Admin (Full management & permissions)</option>
                  <option value="Editor">Editor (Ingest, transform, commit)</option>
                  <option value="Analyst">Analyst (Query, AutoML, view)</option>
                  <option value="Viewer">Viewer (Read-only)</option>
                </select>
              </div>

              {lastInviteUrl && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                  <div className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Invitation Created! Share this link:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={lastInviteUrl}
                      className="w-full bg-white border border-emerald-300 rounded px-2 py-1 text-xs font-mono text-emerald-900 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(lastInviteUrl);
                        setInviteCopied(true);
                        setTimeout(() => setInviteCopied(false), 2000);
                      }}
                      className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      {inviteCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    setLastInviteUrl(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-[#E8E4DF] hover:bg-[#FAF8F5] text-xs font-semibold text-[#736B63] cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isInviting || !inviteEmail.trim()}
                  className="px-4 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold shadow-sm disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isInviting ? "Sending..." : "Send Invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Workspace Modal */}
      {showCreateWsModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E8E4DF] shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#E8E4DF] pb-3">
              <h3 className="text-sm font-bold text-[#1E1915] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#0061FE]" />
                <span>Create New Workspace</span>
              </h3>
              <button
                onClick={() => setShowCreateWsModal(false)}
                className="text-[#8C827A] hover:text-[#1E1915] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#5C554D] block mb-1">
                  Workspace Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quantitative Research Group"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E8E4DF] text-xs text-[#1E1915] outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#5C554D] block mb-1">
                  Description
                </label>
                <textarea
                  value={newWsDesc}
                  onChange={(e) => setNewWsDesc(e.target.value)}
                  placeholder="Purpose and team members for this workspace..."
                  className="w-full px-3 py-2 rounded-xl border border-[#E8E4DF] text-xs text-[#1E1915] outline-none h-20 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateWsModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#E8E4DF] hover:bg-[#FAF8F5] text-xs font-semibold text-[#736B63] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newWsName.trim()}
                  className="px-4 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold shadow-sm disabled:opacity-50 transition-all cursor-pointer"
                >
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
