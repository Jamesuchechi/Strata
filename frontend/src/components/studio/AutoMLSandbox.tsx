"use client";

import React, { useState } from "react";
import {
  BrainCircuit,
  Play,
  Activity,
  AlertTriangle,
  TrendingUp,
  Award,
  BarChart3,
  Sliders,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { trainAutoMLModel } from "@/lib/api";
import { PreviewData } from "@/lib/types";

interface AutoMLSandboxProps {
  datasetId: string;
  previewData: PreviewData;
}

export function AutoMLSandbox({ datasetId, previewData }: AutoMLSandboxProps) {
  const [targetCol, setTargetCol] = useState(
    previewData.schema_fields[previewData.schema_fields.length - 1]?.name || ""
  );
  const [taskType, setTaskType] = useState<"auto" | "classification" | "regression">("auto");
  const [isTraining, setIsTraining] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrain = async () => {
    if (!targetCol) return;
    setIsTraining(true);
    setError(null);
    try {
      const data = await trainAutoMLModel({
        dataset_id: datasetId,
        target_column: targetCol,
        task_type: taskType,
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Model training failed");
    } finally {
      setIsTraining(false);
    }
  };

  const diag = result?.diagnostics;

  return (
    <div className="flex-1 flex flex-col h-full overflow-auto bg-[#F7F5F2] p-6 space-y-6">
      {/* Top Banner & Model Configuration Card */}
      <div className="bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-[#0061FE]" />
            <h2 className="text-base font-bold text-[#1E1915]">AutoML Sandbox & Predictive Diagnostics</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[#0061FE] font-bold">
              Baseline Engine
            </span>
          </div>
          <p className="text-xs text-[#736B63] mt-0.5">
            Train baseline predictive models in &lt;5 seconds with automated feature encoding, ROC-AUC, confusion matrix, and feature importances.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div>
            <label className="text-[10px] font-mono text-[#8C827A] uppercase font-bold block mb-1">
              Target Variable (Y)
            </label>
            <select
              value={targetCol}
              onChange={(e) => setTargetCol(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] outline-none"
            >
              {previewData.schema_fields.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name} ({f.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono text-[#8C827A] uppercase font-bold block mb-1">
              Task Type
            </label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] outline-none"
            >
              <option value="auto">Auto-Detect</option>
              <option value="classification">Classification</option>
              <option value="regression">Regression</option>
            </select>
          </div>

          <div className="self-end">
            <button
              onClick={handleTrain}
              disabled={isTraining}
              className="px-4 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
            >
              {isTraining ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Training Baseline...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Train Model</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Target Leakage Banner */}
      {result?.leakage_warnings?.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
          <div className="flex items-center gap-2 font-bold text-xs">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Potential Data Leakage Warning</span>
          </div>
          {result.leakage_warnings.map((w: string, idx: number) => (
            <p key={idx} className="text-xs text-amber-800">{w}</p>
          ))}
        </div>
      )}

      {/* Main Results Viewport */}
      {result && diag && (
        <div className="space-y-6 animate-in fade-in">
          {/* Diagnostic Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {diag.task === "classification" ? (
              <>
                <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs">
                  <span className="text-xs font-semibold text-[#736B63]">Accuracy</span>
                  <div className="text-2xl font-bold text-emerald-600 mt-1">
                    {(diag.accuracy * 100).toFixed(1)}%
                  </div>
                  <p className="text-[11px] text-[#8C827A] mt-1">Ratio of correctly predicted test observations.</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs">
                  <span className="text-xs font-semibold text-[#736B63]">Weighted F1-Score</span>
                  <div className="text-2xl font-bold text-[#0061FE] mt-1">
                    {diag.f1_score.toFixed(3)}
                  </div>
                  <p className="text-[11px] text-[#8C827A] mt-1">Harmonic mean of precision and recall.</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs">
                  <span className="text-xs font-semibold text-[#736B63]">Weighted Precision</span>
                  <div className="text-2xl font-bold text-blue-600 mt-1">
                    {(diag.precision * 100).toFixed(1)}%
                  </div>
                  <p className="text-[11px] text-[#8C827A] mt-1">Accuracy of positive predictions.</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs">
                  <span className="text-xs font-semibold text-[#736B63]">Weighted Recall</span>
                  <div className="text-2xl font-bold text-purple-600 mt-1">
                    {(diag.recall * 100).toFixed(1)}%
                  </div>
                  <p className="text-[11px] text-[#8C827A] mt-1">Coverage of actual true positive samples.</p>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs">
                  <span className="text-xs font-semibold text-[#736B63]">R² Score (Variance Explained)</span>
                  <div className="text-2xl font-bold text-emerald-600 mt-1">
                    {diag.r2_score.toFixed(3)}
                  </div>
                  <p className="text-[11px] text-[#8C827A] mt-1">Proportion of variance explained by model.</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs">
                  <span className="text-xs font-semibold text-[#736B63]">Mean Absolute Error (MAE)</span>
                  <div className="text-2xl font-bold text-[#0061FE] mt-1">
                    {diag.mae}
                  </div>
                  <p className="text-[11px] text-[#8C827A] mt-1">Average absolute prediction deviation.</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs">
                  <span className="text-xs font-semibold text-[#736B63]">RMSE</span>
                  <div className="text-2xl font-bold text-purple-600 mt-1">
                    {diag.rmse}
                  </div>
                  <p className="text-[11px] text-[#8C827A] mt-1">Root mean squared error penalizing outliers.</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs">
                  <span className="text-xs font-semibold text-[#736B63]">Features Used</span>
                  <div className="text-2xl font-bold text-[#1E1915] mt-1">
                    {result.features_count}
                  </div>
                  <p className="text-[11px] text-[#8C827A] mt-1">Encoded predictive feature columns.</p>
                </div>
              </>
            )}
          </div>

          {/* Section: Diagnostics & Feature Importance */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Confusion Matrix or Residuals */}
            <div className="lg:col-span-6 bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-2xs">
              {diag.task === "classification" && diag.confusion_matrix ? (
                <div>
                  <h3 className="text-sm font-bold text-[#1E1915] mb-1">
                    Confusion Matrix (Holdout Test Set)
                  </h3>
                  <p className="text-xs text-[#736B63] mb-4">
                    Rows represent actual ground truth. Columns represent model predictions.
                  </p>

                  <div className="overflow-x-auto">
                    <table className="border-collapse text-xs font-mono mx-auto">
                      <thead>
                        <tr>
                          <th className="p-2 text-[#8C827A]"></th>
                          {diag.classes.map((cls: string) => (
                            <th key={cls} className="p-2 text-center text-[#1E1915] font-bold">
                              Pred: {cls}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {diag.confusion_matrix.map((row: number[], rIdx: number) => (
                          <tr key={rIdx}>
                            <td className="p-2 font-bold text-[#1E1915] text-right">
                              True: {diag.classes[rIdx]}
                            </td>
                            {row.map((val: number, cIdx: number) => {
                              const isDiagonal = rIdx === cIdx;
                              return (
                                <td
                                  key={cIdx}
                                  className={`w-16 h-12 text-center border border-white font-bold text-sm ${
                                    isDiagonal
                                      ? val > 0 ? "bg-emerald-500 text-white" : "bg-[#FAF8F5] text-[#736B63]"
                                      : val > 0 ? "bg-rose-400 text-white" : "bg-[#FAF8F5] text-[#8C827A]"
                                  }`}
                                >
                                  {val}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {diag.roc && (
                    <div className="mt-6 pt-4 border-t border-[#E8E4DF]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#1E1915]">ROC Curve</span>
                        <span className="text-xs font-mono font-bold text-[#0061FE]">
                          AUC = {diag.roc.auc}
                        </span>
                      </div>
                      <div className="h-32 w-full bg-[#FAF8F5] rounded-xl border border-[#E8E4DF] relative p-2">
                        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                          <line x1="0" y1="100" x2="100" y2="0" stroke="#8C827A" strokeDasharray="3,3" strokeWidth="1" />
                          <polyline
                            fill="none"
                            stroke="#0061FE"
                            strokeWidth="2.5"
                            points={diag.roc.points
                              .map((p: any) => `${p.fpr * 100},${(1 - p.tpr) * 100}`)
                              .join(" ")}
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <h3 className="text-sm font-bold text-[#1E1915] mb-1">
                    Residual Diagnostics (Actual vs Predicted)
                  </h3>
                  <p className="text-xs text-[#736B63] mb-4">
                    Points should cluster randomly around zero without systematic bias.
                  </p>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {diag.residuals?.map((res: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs font-mono p-2 rounded-lg bg-[#FAF8F5] border border-[#E8E4DF]">
                        <span>Actual: {res.actual}</span>
                        <span>Pred: {res.predicted}</span>
                        <span className={`font-bold ${Math.abs(res.residual) > 10 ? "text-rose-600" : "text-[#736B63]"}`}>
                          Δ: {res.residual}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Feature Importance Rankings */}
            <div className="lg:col-span-6 bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-2xs">
              <h3 className="text-sm font-bold text-[#1E1915] mb-1">
                Top Feature Importance Rankings
              </h3>
              <p className="text-xs text-[#736B63] mb-4">
                Relative Gini / Impurity contribution of each feature in the Random Forest ensemble.
              </p>

              <div className="space-y-3">
                {result.feature_importances?.map((feat: any) => {
                  const pct = Math.round(feat.importance * 100);
                  return (
                    <div key={feat.feature} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-semibold text-[#1E1915] truncate max-w-[240px]">
                          {feat.feature}
                        </span>
                        <span className="font-mono text-[11px] text-[#736B63]">
                          {(feat.importance * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-[#FAF8F5] border border-[#E8E4DF] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#0061FE]"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
