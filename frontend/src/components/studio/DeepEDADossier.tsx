"use client";

import React, { useState, useEffect } from "react";
import {
  Flame,
  AlertTriangle,
  HelpCircle,
  Activity,
  Layers,
  Sparkles,
  Download,
  BarChart2,
  CheckCircle2,
  Play,
  RotateCcw,
} from "lucide-react";
import { fetchDeepEDA, runHypothesisTest } from "@/lib/api";

interface DeepEDADossierProps {
  datasetId: string;
}

export function DeepEDADossier({ datasetId }: DeepEDADossierProps) {
  const [edaData, setEdaData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hypothesis testing sub-state
  const [testType, setTestType] = useState<"ttest" | "anova" | "chi2" | "mannwhitney">("ttest");
  const [targetCol, setTargetCol] = useState<string>("");
  const [groupCol, setGroupCol] = useState<string>("");
  const [col2, setCol2] = useState<string>("");
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchDeepEDA(datasetId);
        setEdaData(data);
        if (data.numeric_columns?.length > 0) {
          setTargetCol(data.numeric_columns[0]);
        }
        if (data.categorical_columns?.length > 0) {
          setGroupCol(data.categorical_columns[0]);
          setCol2(data.categorical_columns[1] || data.categorical_columns[0]);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load Deep EDA dossier");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [datasetId]);

  const handleRunHypothesisTest = async () => {
    setIsTesting(true);
    setTestError(null);
    try {
      const res = await runHypothesisTest(datasetId, testType, targetCol, groupCol, col2);
      setTestResult(res);
    } catch (err: any) {
      setTestError(err.message || "Test execution failed");
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-3 text-[#736B63]">
        <div className="w-8 h-8 border-2 border-[#0061FE] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono">Computing correlation matrix & distribution skewness...</p>
      </div>
    );
  }

  if (error || !edaData) {
    return (
      <div className="flex-1 p-8 text-center text-rose-600 space-y-2">
        <p className="font-bold text-sm">Failed to generate Deep EDA Dossier</p>
        <p className="text-xs text-[#8C827A]">{error}</p>
      </div>
    );
  }

  const numCols = edaData.numeric_columns || [];
  const corr = edaData.correlation_matrix || {};

  // Color helper for correlation (-1.0 to +1.0)
  const getCorrColor = (val: number) => {
    if (val === 1.0) return "bg-[#0061FE] text-white";
    if (val > 0.6) return "bg-blue-600 text-white";
    if (val > 0.3) return "bg-blue-400 text-white";
    if (val > 0.05) return "bg-blue-100 text-blue-900";
    if (val < -0.6) return "bg-rose-600 text-white";
    if (val < -0.3) return "bg-rose-400 text-white";
    if (val < -0.05) return "bg-rose-100 text-rose-900";
    return "bg-[#FAF8F5] text-[#736B63]";
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-auto bg-[#F7F5F2] p-6 space-y-6">
      {/* Top Header Summary */}
      <div className="bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-[#1E1915]">Deep EDA Dossier & Diagnostics</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[#0061FE] font-bold">
              Automated Analysis
            </span>
          </div>
          <p className="text-xs text-[#736B63] mt-0.5">
            Bivariate Pearson collinearity, distribution skewness metrics, and on-demand statistical hypothesis testing.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-[#736B63]">
          <span>{numCols.length} Numerical Features</span>
          <span>·</span>
          <span>{edaData.categorical_columns?.length || 0} Categorical</span>
        </div>
      </div>

      {/* Multicollinearity Warnings if any */}
      {edaData.multicollinearity_flags?.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2 shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>High Multicollinearity Warning ({edaData.multicollinearity_flags.length} pairs with |r| &gt;= 0.80)</span>
          </div>
          <p className="text-xs text-amber-800">
            Strong linear collinearity may inflate standard errors in linear regression models. Consider feature selection or PCA.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {edaData.multicollinearity_flags.map((flag: any, idx: number) => (
              <span
                key={idx}
                className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-amber-200/60 border border-amber-300 font-semibold"
              >
                {flag.col1} ↔ {flag.col2} (r = {flag.r})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Section 1: Interactive Correlation Heatmap Matrix */}
      <div className="bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-2xs">
        <h3 className="text-sm font-bold text-[#1E1915] mb-1 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#0061FE]" />
          <span>Pearson Correlation Heatmap Matrix</span>
        </h3>
        <p className="text-xs text-[#736B63] mb-4">
          Blue indicates positive linear relationship (+1.0). Red indicates negative inverse relationship (-1.0).
        </p>

        {numCols.length < 2 ? (
          <div className="py-8 text-center text-xs text-[#8C827A]">
            At least 2 numerical columns are required to compute correlation.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs font-mono select-none">
              <thead>
                <tr>
                  <th className="p-2 text-[11px] text-left text-[#8C827A] border-b border-[#E8E4DF]">Feature</th>
                  {numCols.map((c: string) => (
                    <th key={c} className="p-2 text-[10px] text-center text-[#1E1915] truncate max-w-[90px] border-b border-[#E8E4DF]" title={c}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {numCols.map((rCol: string) => (
                  <tr key={rCol}>
                    <td className="p-2 text-[11px] font-semibold text-[#1E1915] truncate max-w-[130px] border-r border-[#E8E4DF]" title={rCol}>
                      {rCol}
                    </td>
                    {numCols.map((cCol: string) => {
                      const val = corr[rCol]?.[cCol] ?? 0.0;
                      return (
                        <td
                          key={cCol}
                          className={`p-2 text-center text-[11px] font-semibold border border-white/40 transition-transform hover:scale-105 ${getCorrColor(val)}`}
                          title={`${rCol} vs ${cCol}: r = ${val}`}
                        >
                          {val.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Distribution Skewness & Outliers */}
      <div className="bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-2xs">
        <h3 className="text-sm font-bold text-[#1E1915] mb-1 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-[#0061FE]" />
          <span>Distribution Shape & Tukey 1.5×IQR Outlier Diagnostics</span>
        </h3>
        <p className="text-xs text-[#736B63] mb-4">
          Features with |skewness| &gt; 1.0 may benefit from log or box-cox transformation.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(edaData.skewness_metrics || {}).map(([col, metric]: [string, any]) => (
            <div key={col} className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#1E1915] truncate" title={col}>
                  {col}
                </span>
                {metric.is_skewed && (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                    Skewed
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#736B63] space-y-0.5 font-mono">
                <div>μ = {metric.mean} | Median = {metric.median}</div>
                <div>σ = {metric.std} | Skew = {metric.skewness}</div>
                <div className={metric.outlier_count > 0 ? "text-rose-600 font-bold" : "text-emerald-700 font-medium"}>
                  {metric.outlier_count} Outliers ({metric.outlier_pct}%)
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Automated Hypothesis Testing Engine */}
      <div className="bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-2xs">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-[#0061FE]" />
          <h3 className="text-sm font-bold text-[#1E1915]">Statistical Hypothesis Testing Engine</h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
            SciPy Powered
          </span>
        </div>
        <p className="text-xs text-[#736B63] mb-4">
          Run rigorous hypothesis testing to confirm whether differences between segments are statistically significant.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-[11px] font-semibold text-[#736B63] block mb-1">Test Method</label>
            <select
              value={testType}
              onChange={(e) => setTestType(e.target.value as any)}
              className="w-full px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] outline-none"
            >
              <option value="ttest">Two-Sample t-test (2 Groups)</option>
              <option value="anova">One-Way ANOVA (3+ Groups)</option>
              <option value="chi2">Chi-Square Test (Categorical)</option>
              <option value="mannwhitney">Mann-Whitney U (Non-parametric)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#736B63] block mb-1">
              {testType === "chi2" ? "Categorical Feature 1" : "Numerical Variable (Y)"}
            </label>
            <select
              value={targetCol}
              onChange={(e) => setTargetCol(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] outline-none"
            >
              {(testType === "chi2" ? edaData.categorical_columns : numCols).map((c: string) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#736B63] block mb-1">
              {testType === "chi2" ? "Categorical Feature 2" : "Grouping Variable (X)"}
            </label>
            <select
              value={testType === "chi2" ? col2 : groupCol}
              onChange={(e) => testType === "chi2" ? setCol2(e.target.value) : setGroupCol(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] outline-none"
            >
              {edaData.categorical_columns?.map((c: string) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleRunHypothesisTest}
              disabled={isTesting}
              className="w-full py-1.5 px-4 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all"
            >
              {isTesting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Computing...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Hypothesis Test</span>
                </>
              )}
            </button>
          </div>
        </div>

        {testError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium mb-3">
            {testError}
          </div>
        )}

        {testResult && (
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1E1915]">{testResult.test_name}</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                  testResult.is_significant
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-[#E8E4DF] text-[#736B63]"
                }`}
              >
                {testResult.is_significant ? "Statistically Significant (p < 0.05)" : "Not Significant (p >= 0.05)"}
              </span>
            </div>

            <p className="text-xs text-[#1E1915] font-medium leading-relaxed">
              {testResult.takeaway}
            </p>

            <div className="flex items-center gap-4 text-[11px] font-mono text-[#736B63] pt-1">
              <span>Statistic: <strong>{testResult.statistic}</strong></span>
              <span>p-value: <strong>{testResult.p_value < 0.0001 ? "< 0.0001" : testResult.p_value.toFixed(4)}</strong></span>
            </div>

            {testResult.group_summaries && (
              <div className="flex gap-4 pt-2">
                {testResult.group_summaries.map((g: any) => (
                  <div key={g.group} className="text-[11px] font-mono bg-white p-2 rounded-lg border border-[#E8E4DF]">
                    <span className="font-bold text-[#1E1915]">{g.group}</span>: Mean = {g.mean}, σ = {g.std} (N={g.count})
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
