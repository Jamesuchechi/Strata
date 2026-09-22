"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Database,
  GitBranch,
  ArrowRight,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  Cpu,
  Layers,
  X,
} from "lucide-react";
import { seedDomainSamples } from "@/lib/api";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFinished?: () => void;
}

export function OnboardingModal({ isOpen, onClose, onFinished }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);

  if (!isOpen) return null;

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await seedDomainSamples();
      setSeeded(true);
    } catch (err: any) {
      alert(`Failed to seed samples: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const steps = [
    {
      title: "Welcome to Strata Studio",
      badge: "Step 1 of 4",
      description: "Strata is the AI-native data science studio combining sub-second DuckDB WASM analytics, Git-style immutable versioning, automated hypothesis testing, and baseline AutoML in one unified interface.",
      icon: <Sparkles className="w-8 h-8 text-[#0061FE]" />,
      content: (
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] space-y-1">
            <div className="font-bold text-xs text-[#1E1915]">⚡ Universal Previewer</div>
            <div className="text-[11px] text-[#736B63]">Instant preview for Excel multi-sheets, Parquet, CSV, PubChem SDF, and GeoJSON.</div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] space-y-1">
            <div className="font-bold text-xs text-[#1E1915]">🌿 Immutable Versioning</div>
            <div className="text-[11px] text-[#736B63]">Cryptographic hash snapshots, SemVer release aliases, and cell-level rollback.</div>
          </div>
        </div>
      ),
    },
    {
      title: "Explore Pre-loaded Domain Benchmarks",
      badge: "Step 2 of 4",
      description: "Jumpstart your exploration with realistic domain datasets across SaaS Churn, Financial ARR Projections, Genomic Variant Sequencing, and Clinical Biomarkers.",
      icon: <Database className="w-8 h-8 text-emerald-600" />,
      content: (
        <div className="space-y-3 pt-2">
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] flex items-center justify-between">
            <div>
              <div className="font-bold text-xs text-[#1E1915]">Pre-loaded Domain Templates</div>
              <div className="text-[11px] text-[#736B63]">Customer Churn, Financial Excel, Genomic Variants, Clinical Trials</div>
            </div>
            <button
              onClick={handleSeed}
              disabled={isSeeding || seeded}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                seeded
                  ? "bg-emerald-600 text-white"
                  : "bg-[#0061FE] hover:bg-[#0052D4] text-white shadow-sm"
              }`}
            >
              {seeded ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Datasets Loaded!</span>
                </>
              ) : isSeeding ? (
                <span>Loading...</span>
              ) : (
                <span>Load Domain Samples</span>
              )}
            </button>
          </div>
        </div>
      ),
    },
    {
      title: "Interactive EDA & AutoML Sandbox",
      badge: "Step 3 of 4",
      description: "Point-and-click data wrangling recipes, correlation matrices, missingness heatmaps, and one-click baseline LightGBM / Random Forest training with SHAP explanations.",
      icon: <Cpu className="w-8 h-8 text-purple-600" />,
      content: (
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] space-y-1">
            <div className="font-bold text-xs text-[#1E1915]">🧠 Predictive Diagnostics</div>
            <div className="text-[11px] text-[#736B63]">Automated target leakage detection, ROC curve analysis, and confusion matrices.</div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] space-y-1">
            <div className="font-bold text-xs text-[#1E1915]">📊 Drag-and-Drop Charts</div>
            <div className="text-[11px] text-[#736B63]">16 publication-ready chart types with Python seaborn/plotly code export.</div>
          </div>
        </div>
      ),
    },
    {
      title: "Time-Travel Diffing & Lineage DAG",
      badge: "Step 4 of 4",
      description: "Compare arbitrary versions across your dataset's history. Track distribution drift, missing-value deltas, smart column renames, and export formal Markdown audit reports.",
      icon: <GitBranch className="w-8 h-8 text-amber-600" />,
      content: (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>You're Ready to Build!</span>
          </div>
          <p className="text-[11px] text-emerald-800">
            Head to the Datasets tab to explore seeded tables, or upload your own CSV, Excel, or Parquet file.
          </p>
        </div>
      ),
    },
  ];

  const current = steps[step - 1];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-[#E8E4DF] shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-[#E8E4DF] pb-3">
          <span className="px-2.5 py-1 rounded-full bg-[#0061FE]/10 text-[#0061FE] text-[10px] font-bold uppercase">
            {current.badge}
          </span>
          <button
            onClick={onClose}
            className="text-[#8C827A] hover:text-[#1E1915] p-1 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E8E4DF] shrink-0">
            {current.icon}
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#1E1915]">{current.title}</h2>
            <p className="text-xs text-[#5C554D] leading-relaxed">{current.description}</p>
          </div>
        </div>

        <div>{current.content}</div>

        <div className="flex items-center justify-between pt-3 border-t border-[#E8E4DF]">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`w-2 h-2 rounded-full transition-all ${
                  s === step ? "w-6 bg-[#0061FE]" : "bg-[#E8E4DF]"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 rounded-xl border border-[#E8E4DF] hover:bg-[#FAF8F5] text-xs font-semibold text-[#736B63] cursor-pointer"
              >
                Back
              </button>
            )}

            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-4 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => {
                  onClose();
                  if (onFinished) onFinished();
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
