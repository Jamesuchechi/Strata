"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileSpreadsheet,
  Database,
  Code2,
  GitBranch,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  HardDrive,
  Cpu,
  Share2,
  FolderOpen,
  Plus,
  Atom,
  MapPin,
  Upload,
  Layers,
  LayoutDashboard,
  BarChart3,
  Building2,
  CreditCard,
  Globe,
} from "lucide-react";
import { fetchDatasets } from "@/lib/api";
import { DatasetItem } from "@/lib/types";

interface DashboardSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeNav?: string;
  onSelectNav?: (navId: string) => void;
  onSelectDataset?: (datasetId: string) => void;
  activeDatasetId?: string;
}

export function DashboardSidebar({
  isCollapsed,
  onToggleCollapse,
  activeNav,
  onSelectNav,
  onSelectDataset,
  activeDatasetId = "orders_q3",
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const [datasetsExpanded, setDatasetsExpanded] = useState(true);
  const [liveDatasets, setLiveDatasets] = useState<DatasetItem[]>([]);

  useEffect(() => {
    fetchDatasets()
      .then((data) => setLiveDatasets(data))
      .catch((err) => {
        console.error("Failed to fetch datasets in sidebar:", err);
        setLiveDatasets([]);
      });
  }, [pathname]);

  const totalStorageBytes = liveDatasets.reduce((acc, d) => acc + (d.size_bytes || 0), 0);
  const formatStorage = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  const storagePct = Math.min(100, Math.max(1, Math.round((totalStorageBytes / (10 * 1024 * 1024 * 1024)) * 100)));

  const navItems = [
    {
      id: "dashboard",
      href: "/dashboard",
      label: "Overview",
      icon: <LayoutDashboard className="w-4 h-4" />,
      matches: (path: string) => path === "/dashboard",
    },
    {
      id: "upload",
      href: "/upload",
      label: "Upload & Ingest",
      icon: <Upload className="w-4 h-4 text-[#0061FE]" />,
      matches: (path: string) => path.startsWith("/upload"),
    },
    {
      id: "datasets",
      href: "/datasets",
      label: "Datasets & Tables",
      icon: <Database className="w-4 h-4 text-emerald-600" />,
      matches: (path: string) => path.startsWith("/datasets"),
    },
    {
      id: "showcase",
      href: "/showcase",
      label: "Public Showcase & Hub",
      icon: <Globe className="w-4 h-4 text-cyan-600" />,
      matches: (path: string) => path.startsWith("/showcase"),
    },
    {
      id: "visualizer",
      href: "/visualizer",
      label: "Visual Chart Studio",
      icon: <BarChart3 className="w-4 h-4 text-[#0061FE]" />,
      matches: (path: string) => path.startsWith("/visualizer"),
    },
    {
      id: "dashboards",
      href: "/dashboards",
      label: "Dashboards & Stories",
      icon: <LayoutDashboard className="w-4 h-4 text-purple-600" />,
      matches: (path: string) => path.startsWith("/dashboards"),
    },
    {
      id: "query",
      href: "/query",
      label: "DuckDB SQL Editor",
      icon: <Code2 className="w-4 h-4 text-amber-600" />,
      matches: (path: string) => path.startsWith("/query"),
    },
    {
      id: "analyst",
      href: "/analyst",
      label: "AI Analyst",
      icon: <Sparkles className="w-4 h-4 text-[#0061FE]" />,
      matches: (path: string) => path.startsWith("/analyst"),
    },
    {
      id: "versions",
      href: "/versions",
      label: "Git Versions & Diffs",
      icon: <GitBranch className="w-4 h-4 text-purple-600" />,
      matches: (path: string) => path.startsWith("/versions"),
    },
    {
      id: "workspace",
      href: "/workspace",
      label: "Workspace & Team",
      icon: <Building2 className="w-4 h-4 text-indigo-600" />,
      matches: (path: string) => path.startsWith("/workspace"),
    },
    {
      id: "pipelines",
      href: "/pipelines",
      label: "Pipelines & Compute",
      icon: <Cpu className="w-4 h-4 text-rose-600" />,
      matches: (path: string) => path.startsWith("/pipelines"),
    },
    {
      id: "billing",
      href: "/billing",
      label: "Billing & Quotas",
      icon: <CreditCard className="w-4 h-4 text-emerald-600" />,
      matches: (path: string) => path.startsWith("/billing"),
    },
  ];

  const getFormatIcon = (format: string) => {
    switch (format.toLowerCase()) {
      case "excel":
        return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />;
      case "parquet":
        return <Database className="w-3.5 h-3.5 text-[#0061FE]" />;
      case "sdf":
        return <Atom className="w-3.5 h-3.5 text-purple-600" />;
      case "geojson":
        return <MapPin className="w-3.5 h-3.5 text-rose-600" />;
      default:
        return <FileSpreadsheet className="w-3.5 h-3.5 text-[#5C554D]" />;
    }
  };

  return (
    <aside
      className={`h-full shrink-0 bg-[#FAF8F5] border-r border-[#E8E4DF] transition-all duration-300 flex flex-col justify-between select-none z-30 ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Top Section: Navigation Links & Data Tree */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
        {/* Core Navigation Items */}
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = item.matches(pathname);
            return (
              <Link
                key={item.id}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-[#0061FE] text-white shadow-sm shadow-[#0061FE]/20"
                    : "text-[#5C554D] hover:text-[#1E1915] hover:bg-white/80"
                } ${isCollapsed ? "justify-center px-0" : ""}`}
              >
                <div className="shrink-0">{item.icon}</div>
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Dataset Explorer Tree (Only in Expanded Mode) */}
        {!isCollapsed && (
          <div className="pt-2 border-t border-[#E8E4DF]">
            <div className="flex items-center justify-between px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#8C827A]">
              <div
                onClick={() => setDatasetsExpanded(!datasetsExpanded)}
                className="flex items-center gap-1.5 cursor-pointer hover:text-[#1E1915]"
              >
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${datasetsExpanded ? "" : "-rotate-90"}`}
                />
                <span>Active Datasets</span>
              </div>
              <Link
                href="/upload"
                title="Upload New Dataset"
                className="p-1 rounded-md hover:bg-[#EFECE6] text-[#736B63] hover:text-[#1E1915] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </Link>
            </div>

            {datasetsExpanded && (
              <div className="space-y-0.5 mt-1">
                {liveDatasets.length === 0 ? (
                  <div className="px-2.5 py-2 text-[11px] text-[#8C827A] italic">
                    No datasets stored
                  </div>
                ) : (
                  liveDatasets.map((ds) => {
                    const isCurrent = pathname === `/datasets/${ds.id}`;
                    return (
                      <Link
                        key={ds.id}
                        href={`/datasets/${ds.id}`}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          isCurrent
                            ? "bg-white text-[#0061FE] font-bold shadow-2xs border border-[#E8E4DF]"
                            : "text-[#5C554D] hover:bg-white/60 hover:text-[#1E1915]"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {getFormatIcon(ds.format)}
                          <span className="truncate">{ds.filename}</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#8C827A] shrink-0 ml-1">
                          {ds.total_rows ? `${ds.total_rows.toLocaleString()}r` : ""}
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* Git Branch & Snapshot Info (Only in Expanded Mode) */}
        {!isCollapsed && (
          <div className="pt-2 border-t border-[#E8E4DF]">
            <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-[#8C827A] flex items-center justify-between">
              <span>Active Branch</span>
              <span className="px-1.5 py-0.2 rounded bg-[#057A55]/10 text-[#057A55] font-bold text-[9px]">
                Clean
              </span>
            </div>
            <Link
              href="/versions"
              className="mt-1 block px-2.5 py-2 rounded-xl bg-white border border-[#E8E4DF] shadow-2xs hover:border-[#0061FE] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E1915]">
                  <GitBranch className="w-3.5 h-3.5 text-[#0061FE]" />
                  <span>main</span>
                </div>
                <span className="text-[10px] font-mono text-[#736B63]">Snapshots</span>
              </div>
              <p className="text-[10px] text-[#8C827A] mt-1 leading-snug">
                Immutable version history &amp; diffs
              </p>
            </Link>
          </div>
        )}
      </div>

      {/* Bottom Section: Storage & Collapse Toggle */}
      <div className="p-2.5 border-t border-[#E8E4DF] bg-[#FAF8F5]/80 space-y-2">
        {/* Storage Quota Meter */}
        {!isCollapsed ? (
          <div className="p-2.5 rounded-xl bg-white border border-[#E8E4DF] shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 font-semibold text-[#1E1915]">
                <HardDrive className="w-3.5 h-3.5 text-[#0061FE]" />
                <span>Storage</span>
              </div>
              <span className="font-mono text-[#736B63] text-[10px]">{formatStorage(totalStorageBytes)} / 10 GB</span>
            </div>
            <div className="w-full bg-[#EFECE6] h-1.5 rounded-full overflow-hidden">
              <div className="bg-[#0061FE] h-full rounded-full" style={{ width: `${storagePct}%` }} />
            </div>
          </div>
        ) : (
          <div
            title={`Storage: ${formatStorage(totalStorageBytes)} / 10 GB`}
            className="flex justify-center p-1 text-[#736B63] cursor-default"
          >
            <HardDrive className="w-4 h-4" />
          </div>
        )}

        {/* Collapse / Expand Toggle Button */}
        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand Sidebar (⌘B)" : "Collapse Sidebar (⌘B)"}
          className="w-full flex items-center justify-center p-1.5 rounded-lg border border-[#E8E4DF] bg-white hover:bg-[#EFECE6] text-[#736B63] hover:text-[#1E1915] transition-colors cursor-pointer"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!isCollapsed && <span className="text-xs font-semibold ml-1.5">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
