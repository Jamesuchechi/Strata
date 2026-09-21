"use client";

import React, { useState } from "react";
import {
  Wand2,
  Trash2,
  Plus,
  Play,
  Copy,
  Check,
  Code2,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  FileCode,
} from "lucide-react";
import { PreviewData, ColumnStat, TransformOperation } from "@/lib/types";
import { transformDataset } from "@/lib/api";

interface WranglingRecipesProps {
  datasetId: string;
  previewData: PreviewData;
  onDatasetUpdated: (updatedData: PreviewData) => void;
}

export function WranglingRecipes({
  datasetId,
  previewData,
  onDatasetUpdated,
}: WranglingRecipesProps) {
  const [operations, setOperations] = useState<TransformOperation[]>([
    { op: "drop_duplicates" },
    { op: "trim_whitespace" },
  ]);
  const [commitMessage, setCommitMessage] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New operation form state
  const [newOpType, setNewOpType] = useState<TransformOperation["op"]>("fill_null");
  const [newCol, setNewCol] = useState(previewData.schema_fields[0]?.name || "");
  const [newStrategy, setNewStrategy] = useState<"mean" | "median" | "mode" | "zero" | "forward" | "custom">("mean");
  const [newTargetType, setNewTargetType] = useState<"Int64" | "Float64" | "String" | "Boolean">("Int64");

  const addOperation = () => {
    let opToAdd: TransformOperation;
    if (newOpType === "fill_null") {
      opToAdd = { op: "fill_null", column: newCol, strategy: newStrategy };
    } else if (newOpType === "cast_type") {
      opToAdd = { op: "cast_type", column: newCol, target_type: newTargetType };
    } else if (newOpType === "drop_nulls") {
      opToAdd = { op: "drop_nulls", column: newCol };
    } else if (newOpType === "trim_whitespace") {
      opToAdd = { op: "trim_whitespace", column: newCol };
    } else {
      opToAdd = { op: "drop_duplicates" };
    }
    setOperations((prev) => [...prev, opToAdd]);
  };

  const removeOperation = (index: number) => {
    setOperations((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleApplyRecipe = async () => {
    if (operations.length === 0) return;
    setIsApplying(true);
    setError(null);
    try {
      const res = await transformDataset(
        datasetId,
        operations,
        commitMessage || `Wrangling: applied ${operations.length} cleaning operations`
      );
      setLastResult(res);
      if (res.preview) {
        onDatasetUpdated(res.preview);
      }
    } catch (err: any) {
      setError(err.message || "Transformation failed");
    } finally {
      setIsApplying(false);
    }
  };

  const copyPythonCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F7F5F2]">
      {/* Top Header & Overview */}
      <div className="bg-white border-b border-[#E8E4DF] px-6 py-4 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-[#0061FE]" />
            <h2 className="text-base font-bold text-[#1E1915]">Point-and-Click Wrangling Recipes</h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
              Polars Engine
            </span>
          </div>
          <p className="text-xs text-[#736B63] mt-0.5">
            Chain reproducible data cleaning operations. Each executed recipe automatically mints a new immutable DAG commit.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {lastResult?.generated_python_code && (
            <button
              onClick={() => setShowCodeModal(true)}
              className="px-3.5 py-1.5 rounded-xl border border-[#E8E4DF] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 transition-all shadow-2xs"
            >
              <FileCode className="w-3.5 h-3.5 text-[#0061FE]" />
              <span>Export Polars Script</span>
            </button>
          )}

          <button
            onClick={handleApplyRecipe}
            disabled={isApplying || operations.length === 0}
            className="px-4 py-1.5 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
          >
            {isApplying ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Transforming & Committing...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run & Commit Version ({operations.length})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Split: Recipe Builder & Commit Summary */}
      <div className="flex-1 overflow-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Operations Chain */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          {/* Success Banner if transformed */}
          {lastResult && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start justify-between gap-3 shadow-2xs animate-in fade-in">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold">
                    Successfully Minted Version {lastResult.new_version_tag}
                  </h4>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Applied recipe cleanly. Row delta:{" "}
                    <strong>{lastResult.row_delta >= 0 ? `+${lastResult.row_delta}` : lastResult.row_delta} rows</strong>,
                    Column delta: <strong>{lastResult.column_delta} cols</strong>. DAG snapshot recorded.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCodeModal(true)}
                className="text-xs font-semibold underline text-emerald-800 hover:text-emerald-950 shrink-0"
              >
                View Polars Code
              </button>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <p className="text-xs font-semibold">{error}</p>
            </div>
          )}

          {/* Builder Step Form */}
          <div className="bg-white rounded-2xl border border-[#E8E4DF] p-5 shadow-2xs">
            <h3 className="text-xs font-bold text-[#1E1915] uppercase tracking-wider mb-3">
              Add Transformation Step
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#736B63] block mb-1">
                  Operation
                </label>
                <select
                  value={newOpType}
                  onChange={(e) => setNewOpType(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs font-medium text-[#1E1915] outline-none focus:border-[#0061FE]"
                >
                  <option value="fill_null">Impute Missing (Fill Nulls)</option>
                  <option value="drop_nulls">Drop Rows with Nulls</option>
                  <option value="drop_duplicates">Deduplicate Identical Rows</option>
                  <option value="trim_whitespace">Strip / Trim Whitespace</option>
                  <option value="cast_type">Cast Column Type</option>
                </select>
              </div>

              {newOpType !== "drop_duplicates" && (
                <div>
                  <label className="text-[11px] font-semibold text-[#736B63] block mb-1">
                    Target Column
                  </label>
                  <select
                    value={newCol}
                    onChange={(e) => setNewCol(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs font-medium text-[#1E1915] outline-none focus:border-[#0061FE]"
                  >
                    {previewData.schema_fields.map((f) => (
                      <option key={f.name} value={f.name}>
                        {f.name} ({f.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {newOpType === "fill_null" && (
                <div>
                  <label className="text-[11px] font-semibold text-[#736B63] block mb-1">
                    Imputation Strategy
                  </label>
                  <select
                    value={newStrategy}
                    onChange={(e) => setNewStrategy(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs font-medium text-[#1E1915] outline-none focus:border-[#0061FE]"
                  >
                    <option value="mean">Mean (Numerical Average)</option>
                    <option value="median">Median (50th Percentile)</option>
                    <option value="mode">Mode (Most Frequent)</option>
                    <option value="zero">Zero / Empty Constant</option>
                    <option value="forward">Forward-Fill (Last Observation)</option>
                  </select>
                </div>
              )}

              {newOpType === "cast_type" && (
                <div>
                  <label className="text-[11px] font-semibold text-[#736B63] block mb-1">
                    Target Type
                  </label>
                  <select
                    value={newTargetType}
                    onChange={(e) => setNewTargetType(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs font-medium text-[#1E1915] outline-none focus:border-[#0061FE]"
                  >
                    <option value="Int64">Integer (Int64)</option>
                    <option value="Float64">Decimal (Float64)</option>
                    <option value="String">Text (String)</option>
                    <option value="Boolean">Boolean (True/False)</option>
                  </select>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={addOperation}
                className="px-3.5 py-1.5 rounded-xl bg-white border border-[#E8E4DF] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 transition-all shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 text-[#0061FE]" />
                <span>Add Step to Recipe</span>
              </button>
            </div>
          </div>

          {/* Active Recipe Pipeline */}
          <div className="bg-white rounded-2xl border border-[#E8E4DF] p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-[#1E1915] uppercase tracking-wider">
                Recipe Steps ({operations.length})
              </h3>
              <span className="text-[11px] text-[#736B63] font-medium">
                Executed in sequential order
              </span>
            </div>

            {operations.length === 0 ? (
              <div className="py-8 text-center text-[#8C827A] text-xs">
                No transformation steps added yet. Choose an operation above.
              </div>
            ) : (
              <div className="space-y-2.5">
                {operations.map((op, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] flex items-center justify-between gap-3 group hover:border-[#0061FE]/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-white border border-[#E8E4DF] flex items-center justify-center text-[10px] font-mono font-bold text-[#736B63]">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#1E1915] capitalize">
                            {op.op.replace("_", " ")}
                          </span>
                          {op.column && (
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white border border-[#E8E4DF] text-[#0061FE] font-medium">
                              {op.column}
                            </span>
                          )}
                          {op.strategy && (
                            <span className="text-[10px] uppercase font-bold text-[#8C827A]">
                              via {op.strategy}
                            </span>
                          )}
                          {op.target_type && (
                            <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                              → {op.target_type}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => removeOperation(idx)}
                      className="p-1 text-[#8C827A] hover:text-rose-600 transition-colors rounded hover:bg-rose-50"
                      title="Remove step"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Versioning Commit Controls & Summary */}
        <div className="lg:col-span-4 flex flex-col space-y-4">
          <div className="bg-white rounded-2xl border border-[#E8E4DF] p-5 shadow-2xs">
            <h3 className="text-xs font-bold text-[#1E1915] uppercase tracking-wider mb-3">
              Version Commit Metadata
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#736B63] block mb-1">
                  Commit Message
                </label>
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="e.g. Cleansed outlier salaries, imputed missing zipcodes..."
                  rows={3}
                  className="w-full p-2.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs text-[#1E1915] outline-none focus:border-[#0061FE]"
                />
              </div>

              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] text-xs text-[#736B63] space-y-1.5">
                <div className="flex justify-between font-medium">
                  <span>Current Version:</span>
                  <span className="font-mono text-[#1E1915] font-bold">
                    {previewData.filename}
                  </span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Target Next Version:</span>
                  <span className="font-mono text-emerald-700 font-bold">Auto-incremented DAG</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Base Hash:</span>
                  <span className="font-mono text-[#8C827A]">
                    {previewData.content_hash.slice(0, 10)}...
                  </span>
                </div>
              </div>

              <button
                onClick={handleApplyRecipe}
                disabled={isApplying || operations.length === 0}
                className="w-full py-2.5 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Execute & Mint Commit</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Code Modal */}
      {showCodeModal && lastResult?.generated_python_code && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E8E4DF] shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in">
            <div className="px-6 py-4 border-b border-[#E8E4DF] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-[#0061FE]" />
                <h3 className="text-sm font-bold text-[#1E1915]">
                  Reproducible Python / Polars Script
                </h3>
              </div>
              <button
                onClick={() => setShowCodeModal(false)}
                className="text-xs text-[#736B63] hover:text-[#1E1915]"
              >
                Close
              </button>
            </div>
            <div className="p-6 bg-[#1E1915] overflow-auto max-h-[60vh]">
              <pre className="font-mono text-xs text-[#E8E4DF] whitespace-pre-wrap">
                {lastResult.generated_python_code}
              </pre>
            </div>
            <div className="px-6 py-3 border-t border-[#E8E4DF] bg-[#FAF8F5] flex justify-end">
              <button
                onClick={() => copyPythonCode(lastResult.generated_python_code)}
                className="px-4 py-1.5 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? "Copied Script!" : "Copy Python Code"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
