"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  User,
  Shield,
  Key,
  Edit3,
  Clock,
  CheckCircle2,
  Copy,
  Globe,
  Database,
  GitBranch,
  Building2,
  Calendar,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Code2,
  Terminal,
  Activity,
  Award,
  Layers,
  BarChart3,
  Lock,
} from "lucide-react";
import {
  getStoredUser,
  getCurrentUser,
  User as UserType,
} from "@/lib/api/auth";
import { fetchDatasets, fetchWorkspaces } from "@/lib/api";
import { DatasetItem, WorkspaceItem } from "@/lib/types";

export default function ProfilePage() {
  const [user, setUser] = useState<UserType | null>(null);
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [idCopied, setIdCopied] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const stored = getStoredUser();
        if (stored) setUser(stored);

        const [freshUser, dsList, wsList] = await Promise.all([
          getCurrentUser().catch(() => stored),
          fetchDatasets().catch(() => []),
          fetchWorkspaces().catch(() => []),
        ]);

        if (freshUser) setUser(freshUser);
        setDatasets(dsList || []);
        setWorkspaces(wsList || []);
      } catch (err) {
        console.error("Failed to load profile data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const copyId = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id);
    setIdCopied(true);
    setTimeout(() => setIdCopied(false), 2000);
  };

  const userInitial = user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U";
  const userRoleLabel =
    user?.role === "data_scientist"
      ? "Lead Data Scientist"
      : user?.role === "data_analyst"
      ? "Senior Data Analyst"
      : user?.role === "ml_engineer"
      ? "ML & AI Engineer"
      : user?.role === "data_engineer"
      ? "Data Platform Engineer"
      : user?.role === "researcher"
      ? "Scientific Researcher"
      : user?.role || "Data Scientist";

  // Filter user's owned datasets
  const myDatasets = datasets.filter(
    (d) => d.owner === user?.email || d.owner === user?.id || !d.owner
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 lg:p-8 space-y-6">
      {/* Top Breadcrumb & Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#736B63] mb-1">
            <Link href="/dashboard" className="hover:text-[#1E1915] transition-colors">
              Strata
            </Link>
            <ChevronRight className="w-3 h-3 text-[#B0A8A0]" />
            <span className="text-[#1E1915] font-semibold">User Profile</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E1915]">
            Analyst Profile
          </h1>
          <p className="text-sm text-[#736B63] mt-0.5">
            Public workspace identity, analytical domains, and dataset contributions.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/profile/edit"
            className="px-4 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D6] text-white text-xs font-semibold shadow-md shadow-[#0061FE]/20 flex items-center gap-1.5 transition-all"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Profile & Credentials</span>
          </Link>

          <Link
            href="/settings"
            className="px-3.5 py-2 rounded-xl border border-[#E8E4DF] bg-white hover:bg-[#F7F5F2] text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Workspace Settings</span>
          </Link>
        </div>
      </div>

      {/* Main Profile Identity Card */}
      <div className="rounded-2xl border border-[#E8E4DF] bg-white overflow-hidden shadow-sm">
        {/* Banner */}
        <div className="h-32 bg-gradient-to-r from-[#1E1915] via-[#2A2420] to-[#0061FE] relative p-6 flex items-end justify-end">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-[11px] font-medium">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Verified Strata Analyst</span>
          </div>
        </div>

        {/* Profile Details Container */}
        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 -mt-12 mb-6">
            <div className="flex items-end gap-4">
              <div className="relative">
                <div className="w-24 h-24 rounded-2xl bg-[#1E1915] text-white text-3xl font-bold flex items-center justify-center font-mono border-4 border-white shadow-lg">
                  {userInitial}
                </div>
                <div
                  className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white"
                  title="Account Active"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-[#1E1915]">
                    {user?.full_name || "User Account"}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#0061FE]/10 text-[#0061FE] text-xs font-semibold">
                    {userRoleLabel}
                  </span>
                </div>
                <p className="text-xs text-[#736B63] font-mono mt-0.5">
                  {user?.email || "user@strata.ai"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copyId}
                className="px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] hover:bg-white text-xs font-medium text-[#5C554D] flex items-center gap-1.5 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{idCopied ? "Copied ID!" : "Copy User ID"}</span>
              </button>
              <Link
                href="/profile/edit?tab=apikeys"
                className="px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] hover:bg-white text-xs font-medium text-[#5C554D] flex items-center gap-1.5 transition-colors"
              >
                <Key className="w-3.5 h-3.5 text-amber-600" />
                <span>API Keys</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF]">
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-[#736B63] uppercase tracking-wider">
                Contributed Datasets
              </div>
              <div className="text-lg font-bold text-[#1E1915] flex items-center gap-1.5">
                <Database className="w-4 h-4 text-emerald-600" />
                <span>{myDatasets.length}</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-medium text-[#736B63] uppercase tracking-wider">
                Workspaces
              </div>
              <div className="text-lg font-bold text-[#1E1915] flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>{workspaces.length}</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-medium text-[#736B63] uppercase tracking-wider">
                DuckDB Sandbox
              </div>
              <div className="text-lg font-bold text-emerald-700 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Active (8GB)</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-medium text-[#736B63] uppercase tracking-wider">
                Member Since
              </div>
              <div className="text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 mt-1">
                <Calendar className="w-3.5 h-3.5 text-[#736B63]" />
                <span>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : "2026"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Datasets & Research Domains */}
        <div className="lg:col-span-2 space-y-6">
          {/* Analytical Domains & Bio */}
          <div className="rounded-2xl border border-[#E8E4DF] bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#1E1915] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0061FE]" />
              Bio & Analytical Specialization
            </h3>
            <p className="text-xs text-[#5C554D] leading-relaxed">
              Leading tabular data engineering, automated exploratory data analysis, and DuckDB analytical pipelines. Specializes in statistical profiling, SQL query optimization, and collaborative branch version control across enterprise datasets.
            </p>

            <div className="pt-2">
              <div className="text-[11px] font-semibold text-[#736B63] uppercase tracking-wider mb-2">
                Core Competencies & Tooling
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-[#E8E4DF] text-xs font-mono text-[#1E1915]">
                  DuckDB Vector SQL
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-[#E8E4DF] text-xs font-mono text-[#1E1915]">
                  Apache Arrow & Parquet
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-[#E8E4DF] text-xs font-mono text-[#1E1915]">
                  AutoML & SHAP Explainability
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-[#E8E4DF] text-xs font-mono text-[#1E1915]">
                  Python Strata SDK
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-[#E8E4DF] text-xs font-mono text-[#1E1915]">
                  Git Dataset Versioning
                </span>
              </div>
            </div>
          </div>

          {/* Owned / Contributed Datasets */}
          <div className="rounded-2xl border border-[#E8E4DF] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#1E1915] flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                Datasets & Tables ({myDatasets.length})
              </h3>
              <Link
                href="/datasets"
                className="text-xs font-semibold text-[#0061FE] hover:underline flex items-center gap-1"
              >
                <span>View All Datasets</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {myDatasets.length === 0 ? (
              <div className="py-8 text-center rounded-xl border border-dashed border-[#E8E4DF] bg-[#FAF8F5]">
                <p className="text-xs text-[#736B63]">No datasets created yet.</p>
                <Link
                  href="/upload"
                  className="mt-2 inline-block px-3 py-1.5 rounded-lg bg-[#0061FE] text-white text-xs font-semibold"
                >
                  Upload New Dataset
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[#E8E4DF]">
                {myDatasets.slice(0, 5).map((d) => (
                  <div
                    key={d.id}
                    className="py-3 flex items-center justify-between hover:bg-[#FAF8F5] px-2 rounded-xl transition-colors"
                  >
                    <div className="space-y-0.5">
                      <Link
                        href={`/datasets/${d.id}`}
                        className="text-xs font-bold text-[#1E1915] hover:text-[#0061FE] transition-colors flex items-center gap-1.5"
                      >
                        <span>{d.name}</span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono">
                          {d.format}
                        </span>
                      </Link>
                      <div className="text-[11px] text-[#736B63] flex items-center gap-3">
                        <span>{d.total_rows.toLocaleString()} rows</span>
                        <span>•</span>
                        <span>{d.total_columns} columns</span>
                        <span>•</span>
                        <span>Quality: {d.quality_score || 98}%</span>
                      </div>
                    </div>

                    <Link
                      href={`/query?dataset=${d.id}`}
                      className="px-2.5 py-1 rounded-lg border border-[#E8E4DF] bg-white hover:bg-[#FAF8F5] text-xs font-medium text-[#1E1915] flex items-center gap-1"
                    >
                      <Code2 className="w-3 h-3 text-amber-600" />
                      <span>Query</span>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Affiliations & SDK Guide */}
        <div className="space-y-6">
          {/* Workspaces List */}
          <div className="rounded-2xl border border-[#E8E4DF] bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold text-[#1E1915] mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Workspace Affiliations
            </h3>
            <div className="space-y-2.5">
              {workspaces.map((w) => (
                <div
                  key={w.id}
                  className="p-3 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-[#1E1915]">{w.name}</div>
                    <div className="text-[10px] text-[#736B63] font-mono">{w.plan || "Pro Team"}</div>
                  </div>
                  <Link
                    href={`/settings?workspace=${w.id}`}
                    className="text-[11px] font-semibold text-[#0061FE] hover:underline"
                  >
                    Settings
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Edit CTA Card */}
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/70 to-indigo-50/70 p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#0061FE] uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5" />
              <span>Account & Security</span>
            </div>
            <p className="text-xs text-[#5C554D] leading-relaxed">
              Need to change your account password, generate API keys for automation, or tune your analytics preferences?
            </p>
            <Link
              href="/profile/edit"
              className="w-full py-2 px-3 rounded-xl bg-[#0061FE] hover:bg-[#0052D6] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Go to Profile Editor</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
