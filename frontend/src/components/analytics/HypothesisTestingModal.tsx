"use client";

import React, { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  Play,
  TrendingUp,
  BarChart2,
  Layers,
  ArrowRight,
  Info,
} from "lucide-react";
import { runHypothesisTest } from "@/lib/api";
import { ColumnSchema, HypothesisTestResult } from "@/lib/types";

interface HypothesisTestingModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetId: string;
  datasetName: string;
  schemaFields: ColumnSchema[];
}

export function HypothesisTestingModal({
  isOpen,
  onClose,
  datasetId,
  datasetName,
  schemaFields,
}: HypothesisTestingModalProps) {
  const [testType, setTestType] = useState<"ttest" | "anova" | "chi2" | "regression" | "paired_ttest" | "mannwhitney">("ttest");
  const [targetCol, setTargetCol] = useState<string>(schemaFields[0]?.name || "");
  const [groupCol, setGroupCol] = useState<string>(schemaFields[1]?.name || "");
  const [col2, setCol2] = useState<string>(schemaFields[1]?.name || "");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HypothesisTestResult | null>(null);

  if (!isOpen) return null;

  const numericCols = schemaFields.filter((c) =>
    ["int", "float", "double", "decimal", "numeric", "number"].some((t) => c.type.toLowerCase().includes(t))
  );
  const categoricalCols = schemaFields.filter((c) =>
    ["str", "utf8", "varchar", "cat", "bool", "text"].some((t) => c.type.toLowerCase().includes(t))
  );

  const handleExecuteTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsRunning(true);
    try {
      const res = await runHypothesisTest(datasetId, {
        test_type: testType,
        target_col: targetCol,
        group_col: testType === "ttest" || testType === "anova" || testType === "mannwhitney" ? groupCol : undefined,
        col2: testType === "chi2" || testType === "regression" || testType === "paired_ttest" ? col2 : undefined,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to execute statistical hypothesis test.");
    } finally {
      setIsRunning(false);
    }
  };

  const testDescriptions = {
    ttest: "Compare means between exactly two independent groups (Welch's t-test).",
    paired_ttest: "Compare two numeric measurements taken on the same subjects (before vs after).",
    anova: "Compare means across three or more categories simultaneously (One-Way ANOVA).",
    chi2: "Test for statistical association or independence between two categorical variables.",
    regression: "Model the linear relationship and effect size of a predictor on a continuous target.",
    mannwhitney: "Non-parametric rank test comparing two independent groups without assuming normality.",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl border border-[#E8E4DF] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#E8E4DF]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#0061FE]" />
              <h2 className="text-lg font-serif font-bold text-[#1E1915]">
                Statistical Hypothesis Testing Studio
              </h2>
            </div>
            <p className="text-xs text-[#5C554D]">
              Dataset: <span className="font-semibold text-[#1E1915]">{datasetName}</span> (Pillar 14.1 SciPy Engine)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#8C827A] hover:text-[#1E1915] hover:bg-[#FAF8F5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Test Configuration Form */}
        <form onSubmit={handleExecuteTest} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E1915]">Select Hypothesis Test</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: "ttest", label: "2-Sample t-test" },
                { id: "anova", label: "One-Way ANOVA" },
                { id: "chi2", label: "Chi-Square Independence" },
                { id: "regression", label: "OLS Linear Regression" },
                { id: "paired_ttest", label: "Paired Samples t-test" },
                { id: "mannwhitney", label: "Mann-Whitney U" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTestType(t.id as any);
                    setResult(null);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${
                    testType === t.id
                      ? "bg-[#0061FE] text-white border-[#0061FE] shadow-xs"
                      : "bg-[#FAF8F5] border-[#E8E4DF] text-[#5C554D] hover:text-[#1E1915]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#8C827A] pt-1">{testDescriptions[testType]}</p>
          </div>

          {/* Variables Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1E1915]">
                {testType === "regression" ? "Dependent Variable (Y)" : "Target Column"}
              </label>
              <select
                value={targetCol}
                onChange={(e) => setTargetCol(e.target.value)}
                className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] font-semibold"
              >
                {schemaFields.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>

            {(testType === "ttest" || testType === "anova" || testType === "mannwhitney") && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1E1915]">Grouping Categorical Column</label>
                <select
                  value={groupCol}
                  onChange={(e) => setGroupCol(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] font-semibold"
                >
                  {schemaFields.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(testType === "chi2" || testType === "regression" || testType === "paired_ttest") && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1E1915]">
                  {testType === "regression"
                    ? "Predictor Variable (X)"
                    : testType === "paired_ttest"
                    ? "Paired Second Column"
                    : "Second Categorical Variable"}
                </label>
                <select
                  value={col2}
                  onChange={(e) => setCol2(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] font-semibold"
                >
                  {schemaFields.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={isRunning}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#0061FE] hover:bg-[#0052D4] text-white transition-all shadow-sm disabled:opacity-50"
            >
              {isRunning ? (
                <span>Computing SciPy Statistics...</span>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute Statistical Test</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Results Card */}
        {result && (
          <div className="bg-[#FAF8F5] rounded-2xl border border-[#E8E4DF] p-5 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E4DF]">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#8C827A] block font-bold">
                  {result.test_name}
                </span>
                <h3 className="text-sm font-bold text-[#1E1915]">Analysis Findings</h3>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold font-mono border ${
                  result.is_significant
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : "bg-amber-50 text-amber-800 border-amber-300"
                }`}
              >
                {result.is_significant ? "Statistically Significant (p < 0.05)" : "Not Significant (p ≥ 0.05)"}
              </span>
            </div>

            {/* Plain English Conclusion */}
            <div className="p-3.5 bg-white rounded-xl border border-[#E8E4DF] text-xs text-[#1E1915] leading-relaxed">
              <p className="font-semibold text-[#0061FE] mb-1">Plain-English Takeaway:</p>
              <p>{result.takeaway}</p>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white rounded-xl border border-[#E8E4DF]">
                <span className="text-[10px] font-mono text-[#8C827A] uppercase">Test Statistic</span>
                <p className="text-sm font-bold text-[#1E1915] font-mono">{result.statistic}</p>
              </div>
              <div className="p-3 bg-white rounded-xl border border-[#E8E4DF]">
                <span className="text-[10px] font-mono text-[#8C827A] uppercase">p-Value</span>
                <p className="text-sm font-bold text-[#0061FE] font-mono">{result.p_value < 0.0001 ? "< 0.0001" : result.p_value.toFixed(4)}</p>
              </div>
              {result.r_squared !== undefined && (
                <div className="p-3 bg-white rounded-xl border border-[#E8E4DF]">
                  <span className="text-[10px] font-mono text-[#8C827A] uppercase">R² Variance</span>
                  <p className="text-sm font-bold text-purple-700 font-mono">{(result.r_squared * 100).toFixed(1)}%</p>
                </div>
              )}
              {result.degrees_of_freedom !== undefined && (
                <div className="p-3 bg-white rounded-xl border border-[#E8E4DF]">
                  <span className="text-[10px] font-mono text-[#8C827A] uppercase">Deg of Freedom</span>
                  <p className="text-sm font-bold text-[#1E1915] font-mono">{result.degrees_of_freedom}</p>
                </div>
              )}
              {result.mean_difference !== undefined && (
                <div className="p-3 bg-white rounded-xl border border-[#E8E4DF]">
                  <span className="text-[10px] font-mono text-[#8C827A] uppercase">Mean Diff</span>
                  <p className="text-sm font-bold text-emerald-700 font-mono">{result.mean_difference}</p>
                </div>
              )}
            </div>

            {/* Group Summaries */}
            {result.group_summaries && result.group_summaries.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#1E1915]">Group Comparisons:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {result.group_summaries.map((g) => (
                    <div key={g.group} className="p-3 bg-white rounded-xl border border-[#E8E4DF] text-xs">
                      <p className="font-bold text-[#1E1915]">{g.group}</p>
                      <p className="text-[#5C554D] font-mono text-[11px] mt-0.5">
                        Sample Size: {g.count} | Mean: <span className="font-bold text-[#0061FE]">{g.mean}</span> | Std: {g.std}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
