"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Layers,
  ChevronDown,
  Search,
  Zap,
  Plus,
  Bell,
  PanelRight,
  LogOut,
  User as UserIcon,
  BookOpen,
  Settings,
  Upload,
  Code2,
  FileSpreadsheet,
  Database,
  Check,
  Sparkles,
} from "lucide-react";
import { clearStoredAuth, getStoredUser } from "@/lib/api";

interface DashboardTopbarProps {
  onOpenCommandPalette: () => void;
  isContextBarOpen: boolean;
  onToggleContextBar: () => void;
}

export function DashboardTopbar({
  onOpenCommandPalette,
  isContextBarOpen,
  onToggleContextBar,
}: DashboardTopbarProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [storedUser, setStoredUser] = useState<ReturnType<typeof getStoredUser>>(null);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userWorkspaceName = storedUser?.full_name
    ? `${storedUser.full_name}'s Workspace`
    : "Default Workspace";
  const [activeProject, setActiveProject] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    const user = getStoredUser();
    setStoredUser(user);
    setActiveProject(user?.full_name ? `${user.full_name}'s Workspace` : "Default Workspace");
  }, []);

  const handleLogout = () => {
    clearStoredAuth();
    router.push("/login");
  };

  return (
    <header className="h-14 border-b border-[#E8E4DF] bg-[#F7F5F2]/95 backdrop-blur-md sticky top-0 z-40 px-4 flex items-center justify-between gap-4 select-none">
      {/* Left: Brand + Project Switcher */}
      <div className="flex items-center gap-3">
        {/* Brand Mark */}
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#0061FE] to-[#3B82F6] flex items-center justify-center text-white shadow-[0_2px_8px_rgba(0,97,254,0.3)] group-hover:scale-105 transition-transform">
            <Layers className="w-4 h-4" />
          </div>
          <span className="font-serif font-bold text-lg text-[#1E1915] hidden sm:inline">
            Strata
          </span>
        </Link>

        <span className="text-[#D6D0C7] font-light hidden sm:inline">/</span>

        {/* Project Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[#E8E4DF] bg-white/80 hover:bg-white text-xs font-semibold text-[#1E1915] shadow-2xs hover:shadow-xs transition-all"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="max-w-[150px] sm:max-w-[200px] truncate" suppressHydrationWarning>
              {mounted ? activeProject || userWorkspaceName : "Workspace"}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#8C827A]" />
          </button>

          {workspaceMenuOpen && (
            <div
              className="absolute left-0 mt-1.5 w-64 rounded-xl bg-white border border-[#E8E4DF] shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
              onMouseLeave={() => setWorkspaceMenuOpen(false)}
            >
              <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#8C827A]">
                Active Workspace
              </div>
              <div className="p-2 rounded-lg bg-[#0061FE]/5 border border-[#0061FE]/20 text-xs">
                <div className="font-bold text-[#1E1915]">
                  {activeProject || userWorkspaceName}
                </div>
                <div className="text-[10px] text-[#736B63] mt-0.5">
                  Local DuckDB &amp; Persistent Storage
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center: Command Palette Search Bar */}
      <div className="flex-1 max-w-md hidden md:block">
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl border border-[#E8E4DF] bg-white/70 hover:bg-white text-xs text-[#8C827A] shadow-2xs hover:shadow-xs transition-all group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 group-hover:text-[#0061FE] transition-colors" />
            <span>Search datasets, queries, or jump to commit...</span>
          </div>
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#FAF8F5] border border-[#D6D0C7] text-[#736B63]">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Actions, Engine Pill, Jobs Drawer, User Profile */}
      <div className="flex items-center gap-2.5">
        {/* DuckDB Engine Status Pill */}
        <div
          title="DuckDB-WASM execution engine is warm and running in-memory with sub-second zero-cloud latency."
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono cursor-default shadow-2xs"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>DuckDB 1.5 · WASM Local</span>
          <span className="text-[9px] text-emerald-600 border-l border-emerald-200 pl-1.5 ml-0.5">340MB</span>
        </div>

        {/* Quick "+ New" Dropdown */}
        <div className="relative">
          <button
            onClick={() => setNewMenuOpen(!newMenuOpen)}
            className="flex items-center gap-1.5 bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
            <ChevronDown className="w-3 h-3 opacity-80" />
          </button>

          {newMenuOpen && (
            <div
              className="absolute right-0 mt-1.5 w-52 rounded-xl bg-white border border-[#E8E4DF] shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
              onMouseLeave={() => setNewMenuOpen(false)}
            >
              <Link
                href="/upload"
                onClick={() => setNewMenuOpen(false)}
                className="w-full text-left px-2.5 py-2 rounded-lg text-xs hover:bg-[#F7F5F2] text-[#1E1915] flex items-center gap-2 font-medium"
              >
                <Upload className="w-3.5 h-3.5 text-[#0061FE]" />
                <span>Upload Dataset (.xlsx, .parquet)</span>
              </Link>
              <Link
                href="/query"
                onClick={() => setNewMenuOpen(false)}
                className="w-full text-left px-2.5 py-2 rounded-lg text-xs hover:bg-[#F7F5F2] text-[#1E1915] flex items-center gap-2 font-medium"
              >
                <Code2 className="w-3.5 h-3.5 text-amber-600" />
                <span>New SQL Query</span>
              </Link>
              <Link
                href="/analyst"
                onClick={() => setNewMenuOpen(false)}
                className="w-full text-left px-2.5 py-2 rounded-lg text-xs hover:bg-[#F7F5F2] text-[#1E1915] flex items-center gap-2 font-medium"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#0061FE]" />
                <span>Ask AI Analyst</span>
              </Link>
              <Link
                href="/datasets"
                onClick={() => setNewMenuOpen(false)}
                className="w-full text-left px-2.5 py-2 rounded-lg text-xs hover:bg-[#F7F5F2] text-[#1E1915] flex items-center gap-2 font-medium"
              >
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>Browse All Datasets</span>
              </Link>
            </div>
          )}
        </div>

        {/* Background Tasks Drawer Trigger */}
        <button
          title="Background analytical tasks"
          onClick={() => alert("Background tasks: 0 active, 3 completed recently.")}
          className="p-1.5 rounded-lg border border-[#E8E4DF] bg-white/80 hover:bg-white text-[#736B63] hover:text-[#1E1915] transition-colors relative"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#0061FE]" />
        </button>

        {/* Toggle Context Bar (Inspector) */}
        <button
          onClick={onToggleContextBar}
          title="Toggle Context Inspector (⌘I)"
          className={`p-1.5 rounded-lg border transition-all ${
            isContextBarOpen
              ? "border-[#0061FE] bg-[#0061FE]/10 text-[#0061FE]"
              : "border-[#E8E4DF] bg-white/80 hover:bg-white text-[#736B63] hover:text-[#1E1915]"
          }`}
        >
          <PanelRight className="w-4 h-4" />
        </button>

        {/* User Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-0.5 rounded-full hover:ring-2 hover:ring-[#0061FE]/30 transition-all"
          >
            <div
              suppressHydrationWarning
              className="w-7 h-7 rounded-full bg-[#1E1915] text-white text-xs font-semibold flex items-center justify-center font-mono"
            >
              {mounted && storedUser?.full_name ? storedUser.full_name.charAt(0).toUpperCase() : "A"}
            </div>
          </button>

          {userMenuOpen && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-[#E8E4DF] shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100"
              onMouseLeave={() => setUserMenuOpen(false)}
            >
              <div className="px-2.5 py-2 border-b border-[#E8E4DF] mb-1">
                <div className="text-xs font-bold text-[#1E1915]">
                  {mounted && storedUser?.full_name ? storedUser.full_name : "Ada Lovelace"}
                </div>
                <div className="text-[11px] text-[#736B63] truncate">
                  {mounted && storedUser?.email ? storedUser.email : "ada@strata.ai"}
                </div>
                <div className="inline-block px-1.5 py-0.5 rounded bg-[#0061FE]/10 text-[#0061FE] text-[9px] font-mono font-bold uppercase mt-1">
                  {mounted && storedUser?.role ? storedUser.role : "Data Scientist"}
                </div>
              </div>

              <button
                onClick={() => {
                  alert("Settings dialog");
                  setUserMenuOpen(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-[#F7F5F2] text-[#1E1915] flex items-center gap-2"
              >
                <Settings className="w-3.5 h-3.5 text-[#736B63]" />
                <span>Workspace Settings</span>
              </button>

              <a
                href="https://github.com/Jamesuchechi/Strata"
                target="_blank"
                rel="noreferrer"
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-[#F7F5F2] text-[#1E1915] flex items-center gap-2"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#736B63]" />
                <span>API & Python Docs</span>
              </a>

              <div className="border-t border-[#E8E4DF] my-1 pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
