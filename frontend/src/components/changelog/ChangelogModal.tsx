"use client";

import React from "react";
import { History, Sparkles, CheckCircle2, X, ExternalLink } from "lucide-react";

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangelogModal({ isOpen, onClose }: ChangelogModalProps) {
  if (!isOpen) return null;

  const releases = [
    {
      version: "v0.2.0 — Phase 2: Usable Studio & Deep EDA",
      date: "September 2026",
      badge: "Current Release",
      badgeColor: "bg-emerald-100 text-emerald-800",
      highlights: [
        "Specialized scientific formats: PubChem 3D .sdf/.mol compounds and GeoJSON spatial maps.",
        "Deep EDA dossier: Correlation heatmaps, pairplots, and missingness matrix.",
        "AutoML Sandbox: LightGBM & Random Forest baseline models with SHAP explanations and ROC curves.",
        "Advanced Versioning: SemVer tags, version pinning against GC, version permissions, and custom key-value metadata.",
        "Enhanced Diffing: Statistical distribution drift (mean/median/IQR), smart column-rename heuristics, and categorical domain shifts.",
        "Team Workspaces & RBAC: Multi-tenant workspaces, granular member roles (Owner, Admin, Editor, Analyst, Viewer), and live audit activity feed.",
        "Global & Faceted Search: Full-text search and schema-based column discovery.",
        "Billing & Onboarding: Transparent storage quotas, plan upgrade tiers, and pre-loaded domain benchmarks.",
      ],
    },
    {
      version: "v0.1.0 — Phase 1: MVP Core Studio & Versioning Backbone",
      date: "August 2026",
      badge: "Base Milestone",
      badgeColor: "bg-blue-100 text-blue-800",
      highlights: [
        "Universal preview engine for CSV, multi-sheet Excel (.xlsx/.xls), and Apache Parquet.",
        "Instant column micro-stats and composite data quality scoring (PII detection).",
        "Sub-second DuckDB WASM SQL analytical query runner.",
        "Point-and-click data wrangling recipes with auto-version commits.",
        "Visual DAG commit timeline and one-click time-travel rollback.",
        "Python SDK & CLI (`strata upload`, `strata diff`, `strata query`).",
        "Secure read-only sharing via expiring tokenized links.",
      ],
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-[#E8E4DF] shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-[#E8E4DF] pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#0061FE]" />
            <h2 className="text-base font-bold text-[#1E1915]">
              Strata Release Notes & Changelog (Pillar 18.6)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#8C827A] hover:text-[#1E1915] p-1 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {releases.map((rel, i) => (
            <div key={i} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#1E1915]">{rel.version}</h3>
                  <span className="text-xs text-[#8C827A] font-mono">{rel.date}</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${rel.badgeColor}`}>
                  {rel.badge}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8E4DF] space-y-2">
                {rel.highlights.map((h, j) => (
                  <div key={j} className="flex items-start gap-2 text-xs text-[#5C554D]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#0061FE] shrink-0 mt-0.5" />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[#E8E4DF] pt-3 flex items-center justify-between text-xs text-[#8C827A] shrink-0">
          <span>Strata Open Source & Enterprise Roadmap</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#0061FE] text-white text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
