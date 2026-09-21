"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  FileSpreadsheet,
  Database,
  Code2,
  GitBranch,
  Sparkles,
  Command,
  ArrowRight,
  X,
  Layers,
  Zap,
} from "lucide-react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction?: (actionId: string) => void;
}

interface PaletteItem {
  id: string;
  title: string;
  category: "Datasets" | "Actions" | "Queries" | "Git Versions";
  subtitle?: string;
  icon: React.ReactNode;
  shortcut?: string;
}

export function CommandPalette({ isOpen, onClose, onSelectAction }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const items: PaletteItem[] = [
    {
      id: "dataset-orders",
      title: "orders_q3_2026.xlsx",
      category: "Datasets",
      subtitle: "Multi-Sheet Excel · 4 Sheets · 84,200 rows",
      icon: <FileSpreadsheet className="w-4 h-4 text-emerald-600" />,
    },
    {
      id: "dataset-telecom",
      title: "telecom_churn_features.parquet",
      category: "Datasets",
      subtitle: "Apache Parquet · 1.42M rows · 28 cols",
      icon: <Database className="w-4 h-4 text-[#0061FE]" />,
    },
    {
      id: "dataset-chem",
      title: "kinase_inhibitors_screen.sdf",
      category: "Datasets",
      subtitle: "PubChem SDF · 2,450 3D Compounds",
      icon: <Zap className="w-4 h-4 text-purple-600" />,
    },
    {
      id: "action-upload",
      title: "Upload New Dataset",
      category: "Actions",
      subtitle: "Supports Excel, CSV, Parquet, Arrow, GeoJSON, SDF",
      icon: <Layers className="w-4 h-4 text-[#0061FE]" />,
      shortcut: "⌘U",
    },
    {
      id: "action-query",
      title: "New DuckDB SQL Query",
      category: "Actions",
      subtitle: "Run sub-second analytical SQL on local WASM engine",
      icon: <Code2 className="w-4 h-4 text-amber-600" />,
      shortcut: "⌘N",
    },
    {
      id: "query-top-retention",
      title: "Cohort Retention Rate (Last 90 Days)",
      category: "Queries",
      subtitle: "Saved SQL Query · Last run 2h ago",
      icon: <Code2 className="w-4 h-4 text-[#5C554D]" />,
    },
    {
      id: "version-commit",
      title: "Create Dataset Snapshot / Git Commit",
      category: "Git Versions",
      subtitle: "Create reproducible version hash with schema diff",
      icon: <GitBranch className="w-4 h-4 text-emerald-600" />,
      shortcut: "⌘S",
    },
    {
      id: "action-analyst",
      title: "Ask AI Analyst",
      category: "Actions",
      subtitle: "Natural language query & automated anomaly explanation",
      icon: <Sparkles className="w-4 h-4 text-[#0061FE]" />,
      shortcut: "⌘J",
    },
  ];

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(query.toLowerCase())) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
      } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
        e.preventDefault();
        if (onSelectAction) onSelectAction(filteredItems[selectedIndex].id);
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose, onSelectAction]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl rounded-2xl bg-white border border-[#E8E4DF] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-[#E8E4DF] bg-[#FAF8F5]/80">
          <Search className="w-5 h-5 text-[#8C827A] mr-3 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search datasets, SQL queries, notebooks, or commands..."
            className="w-full bg-transparent text-sm text-[#1E1915] placeholder:text-[#8C827A] focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#8C827A] hover:text-[#1E1915] hover:bg-[#EFECE6] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-transparent">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#8C827A]">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (onSelectAction) onSelectAction(item.id);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected ? "bg-[#0061FE]/10 text-[#0061FE]" : "hover:bg-[#F7F5F2] text-[#1E1915]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${isSelected ? "bg-white shadow-2xs" : "bg-[#F7F5F2]"}`}>
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold truncate">{item.title}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[#EFECE6] text-[#736B63] shrink-0">
                          {item.category}
                        </span>
                      </div>
                      {item.subtitle && (
                        <p className="text-[11px] text-[#736B63] truncate mt-0.5">{item.subtitle}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-3 shrink-0">
                    {item.shortcut && (
                      <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border border-[#D6D0C7] text-[#736B63] shadow-2xs">
                        {item.shortcut}
                      </kbd>
                    )}
                    {isSelected && <ArrowRight className="w-4 h-4 text-[#0061FE]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-[#FAF8F5] border-t border-[#E8E4DF] flex items-center justify-between text-[11px] text-[#8C827A] font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span>Strata Studio Quick Action</span>
        </div>
      </div>
    </div>
  );
}
