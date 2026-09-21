"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Database,
  Code2,
  GitBranch,
  Sparkles,
  GitCommit,
  Layers,
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
  HelpCircle,
} from "lucide-react";

interface DashboardSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeNav: string;
  onSelectNav: (navId: string) => void;
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
  const [datasetsExpanded, setDatasetsExpanded] = useState(true);
  const [excelSheetsOpen, setExcelSheetsOpen] = useState(true);

  const navItems = [
    { id: "datasets", label: "Datasets & Tables", icon: <Database className="w-4 h-4" /> },
    { id: "query", label: "DuckDB SQL Editor", icon: <Code2 className="w-4 h-4" /> },
    { id: "notebooks", label: "Data Notebooks", icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: "versions", label: "Git Versions & Diffs", icon: <GitBranch className="w-4 h-4" /> },
    { id: "analyst", label: "AI Analyst", icon: <Sparkles className="w-4 h-4 text-[#0061FE]" /> },
    { id: "automl", label: "AutoML & Baseline", icon: <Cpu className="w-4 h-4" /> },
    { id: "pipelines", label: "Lineage & DAG", icon: <Share2 className="w-4 h-4" /> },
  ];

  const datasets = [
    {
      id: "orders_q3",
      name: "orders_q3_2026.xlsx",
      type: "excel",
      size: "84.2K rows",
      sheets: ["Summary", "Transactions", "COGS", "Assumptions"],
      icon: <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />,
    },
    {
      id: "telecom_churn",
      name: "telecom_churn.parquet",
      type: "parquet",
      size: "1.42M rows",
      icon: <Database className="w-3.5 h-3.5 text-[#0061FE]" />,
    },
    {
      id: "compounds_screen",
      name: "kinase_inhibitors.sdf",
      type: "sdf",
      size: "2,450 mols",
      icon: <Atom className="w-3.5 h-3.5 text-purple-600" />,
    },
    {
      id: "austin_zones",
      name: "urban_tracts.geojson",
      type: "geojson",
      size: "3,890 polygons",
      icon: <MapPin className="w-3.5 h-3.5 text-amber-600" />,
    },
  ];

  return (
    <aside
      className={`h-[calc(100vh-3.5rem)] sticky top-14 bg-[#FAF8F5] border-r border-[#E8E4DF] transition-all duration-300 flex flex-col justify-between select-none z-30 ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Top Section: Navigation Links & Data Tree */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
        {/* Core Navigation Items */}
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectNav(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-[#0061FE] text-white shadow-sm shadow-[#0061FE]/20"
                    : "text-[#5C554D] hover:text-[#1E1915] hover:bg-white/80"
                } ${isCollapsed ? "justify-center px-0" : ""}`}
              >
                <div className="shrink-0">{item.icon}</div>
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </button>
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
              <button
                onClick={() => alert("Upload Dataset dialog")}
                title="Add Dataset"
                className="p-0.5 rounded hover:bg-[#EFECE6] text-[#736B63] hover:text-[#1E1915]"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {datasetsExpanded && (
              <div className="space-y-0.5 mt-1">
                {datasets.map((ds) => {
                  const isSelected = activeDatasetId === ds.id;
                  return (
                    <div key={ds.id}>
                      <button
                        onClick={() => {
                          if (onSelectDataset) onSelectDataset(ds.id);
                          if (ds.type === "excel") setExcelSheetsOpen(!excelSheetsOpen);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          isSelected
                            ? "bg-white text-[#1E1915] font-semibold shadow-2xs border border-[#E8E4DF]"
                            : "text-[#5C554D] hover:bg-white/60 hover:text-[#1E1915]"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {ds.icon}
                          <span className="truncate">{ds.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#8C827A] shrink-0 ml-1">
                          {ds.size}
                        </span>
                      </button>

                      {/* Expandable sheets for Excel */}
                      {ds.sheets && excelSheetsOpen && (
                        <div className="ml-5 pl-2 border-l border-[#E8E4DF] space-y-0.5 my-1">
                          {ds.sheets.map((sheet, idx) => (
                            <button
                              key={sheet}
                              onClick={() => {
                                if (onSelectDataset) onSelectDataset(ds.id);
                              }}
                              className={`w-full text-left px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1.5 transition-colors ${
                                idx === 0
                                  ? "text-[#0061FE] font-bold bg-[#0061FE]/5"
                                  : "text-[#736B63] hover:text-[#1E1915] hover:bg-white/60"
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-[#8C827A]/40" />
                              <span className="truncate">{sheet}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
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
            <div className="mt-1 px-2.5 py-2 rounded-xl bg-white border border-[#E8E4DF] shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E1915]">
                  <GitBranch className="w-3.5 h-3.5 text-[#0061FE]" />
                  <span>main</span>
                </div>
                <span className="text-[10px] font-mono text-[#736B63]">v1.2-imputed</span>
              </div>
              <p className="text-[10px] text-[#8C827A] mt-1 leading-snug">
                Last snapshot 42m ago by Ada Lovelace
              </p>
            </div>
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
              <span className="font-mono text-[#736B63] text-[10px]">3.2 / 10 GB</span>
            </div>
            <div className="w-full bg-[#EFECE6] h-1.5 rounded-full overflow-hidden">
              <div className="bg-[#0061FE] h-full rounded-full" style={{ width: "32%" }} />
            </div>
          </div>
        ) : (
          <div
            title="Storage: 3.2 GB / 10 GB"
            className="flex justify-center p-1 text-[#736B63] cursor-default"
          >
            <HardDrive className="w-4 h-4" />
          </div>
        )}

        {/* Collapse / Expand Toggle Button */}
        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand Sidebar (⌘B)" : "Collapse Sidebar (⌘B)"}
          className="w-full flex items-center justify-center p-1.5 rounded-lg border border-[#E8E4DF] bg-white hover:bg-[#EFECE6] text-[#736B63] hover:text-[#1E1915] transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!isCollapsed && <span className="text-xs font-semibold ml-1.5">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
