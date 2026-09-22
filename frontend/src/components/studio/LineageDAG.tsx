"use client";

import React, { useState, useEffect } from "react";
import {
  GitFork,
  Database,
  GitCommit,
  ArrowRight,
  Sparkles,
  Info,
  Calendar,
  User,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Download,
  Plus,
  RefreshCw,
  Box,
  Layers,
  Cpu,
  BarChart3,
  ExternalLink,
  ChevronRight,
  Sliders,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  fetchFullLineageGraph,
  traceBackwardLineage,
  traceForwardImpact,
  fetchRegisteredModels,
  registerModel,
  checkDeletionProtection,
  exportOpenLineage,
} from "@/lib/api";
import { LineageGraphResponse, RegisteredModel, DeletionProtectionCheck } from "@/lib/types";

export function LineageDAG() {
  const [graphData, setGraphData] = useState<LineageGraphResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [models, setModels] = useState<RegisteredModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Trace & Protection states
  const [backwardTrace, setBackwardTrace] = useState<any>(null);
  const [forwardImpact, setForwardImpact] = useState<any>(null);
  const [protectionCheck, setProtectionCheck] = useState<DeletionProtectionCheck | null>(null);
  const [isTracing, setIsTracing] = useState(false);
  const [isCheckingProtection, setIsCheckingProtection] = useState(false);

  // Model Registration Modal State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [newModelFramework, setNewModelFramework] = useState("LightGBM");
  const [newModelAlgorithm, setNewModelAlgorithm] = useState("LGBMClassifier");
  const [newModelMetricKey, setNewModelMetricKey] = useState("auc");
  const [newModelMetricVal, setNewModelMetricVal] = useState("0.945");
  const [newModelRunId, setNewModelRunId] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [g, mList] = await Promise.all([
        fetchFullLineageGraph(),
        fetchRegisteredModels(),
      ]);
      setGraphData(g);
      setModels(mList);
      if (g.nodes && g.nodes.length > 0) {
        setSelectedNode(g.nodes[0]);
      }
    } catch (err) {
      console.error("Failed to load lineage data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectNode = async (node: any) => {
    setSelectedNode(node);
    setBackwardTrace(null);
    setForwardImpact(null);
    setProtectionCheck(null);

    // If node is a commit snapshot or has a hash, automatically check deletion protection
    const hash = node.commit_hash || node.badge;
    if (hash && hash.length >= 6) {
      setIsCheckingProtection(true);
      try {
        const check = await checkDeletionProtection(hash);
        setProtectionCheck(check);
      } catch (e) {
        console.error("Protection check failed:", e);
      } finally {
        setIsCheckingProtection(false);
      }
    }
  };

  const handleTraceBackward = async () => {
    if (!selectedNode) return;
    setIsTracing(true);
    try {
      const res = await traceBackwardLineage(selectedNode.id);
      setBackwardTrace(res);
      setForwardImpact(null);
    } catch (err: any) {
      alert(`Backward trace failed: ${err.message}`);
    } finally {
      setIsTracing(false);
    }
  };

  const handleTraceForward = async () => {
    if (!selectedNode) return;
    setIsTracing(true);
    try {
      const res = await traceForwardImpact(selectedNode.id);
      setForwardImpact(res);
      setBackwardTrace(null);
    } catch (err: any) {
      alert(`Forward impact trace failed: ${err.message}`);
    } finally {
      setIsTracing(false);
    }
  };

  const handleExport = async (format: "openlineage" | "graphviz") => {
    try {
      const data = await exportOpenLineage(format);
      const content = typeof data === "string" ? data : JSON.stringify(data, null, 2);
      const blob = new Blob([content], {
        type: format === "graphviz" ? "text/vnd.graphviz" : "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `strata_lineage_${format}.${format === "graphviz" ? "dot" : "json"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleRegisterModelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName.trim()) return;
    setIsRegistering(true);
    try {
      const targetHash = selectedNode?.commit_hash || selectedNode?.badge || "v1.0.0";
      const dsName = selectedNode?.label?.replace("Source: ", "") || (selectedNode as any)?.dataset_name || "dataset";
      await registerModel({
        name: newModelName.trim(),
        framework: newModelFramework,
        algorithm: newModelAlgorithm,
        dataset_name: dsName,
        dataset_version_hash: targetHash,
        experiment_tracker: "MLflow",
        run_id: newModelRunId.trim() || `run-${Date.now().toString(36)}`,
        metrics: { [newModelMetricKey]: Number(newModelMetricVal) || 0.9 },
        status: "production",
      });
      setShowRegisterModal(false);
      setNewModelName("");
      await loadData();
    } catch (err: any) {
      alert(`Model registration failed: ${err.message}`);
    } finally {
      setIsRegistering(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-[#736B63] space-y-3">
        <div className="w-8 h-8 border-2 border-[#0061FE] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono">Building interactive lineage DAG & model registry...</p>
      </div>
    );
  }

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  const getNodeIcon = (type: string) => {
    switch (type) {
      case "raw_source":
        return <Database className="w-4 h-4 text-blue-600" />;
      case "dataset":
        return <Layers className="w-4 h-4 text-emerald-600" />;
      case "version":
        return <GitCommit className="w-4 h-4 text-indigo-600" />;
      case "feature_set":
        return <Sliders className="w-4 h-4 text-cyan-600" />;
      case "model":
        return <Cpu className="w-4 h-4 text-purple-600" />;
      case "dashboard":
        return <BarChart3 className="w-4 h-4 text-amber-600" />;
      default:
        return <Box className="w-4 h-4 text-neutral-600" />;
    }
  };

  const getNodeBadgeClass = (category: string) => {
    switch (category) {
      case "Source Ingestion":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Catalog Table":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Version Snapshot":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "Engineered Features":
        return "bg-cyan-50 text-cyan-700 border-cyan-200";
      case "Registered Model":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "Dashboard Report":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-neutral-50 text-neutral-700 border-neutral-200";
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F5F2] overflow-hidden p-6 space-y-4">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-[#E8E4DF] p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GitFork className="w-5 h-5 text-[#0061FE]" />
            <h2 className="text-base font-bold text-[#1E1915]">Full Provenance Lineage & Model Registry</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[#0061FE] font-bold">
              OpenLineage Certified
            </span>
          </div>
          <p className="text-xs text-[#736B63] mt-0.5">
            End-to-end provenance: Source Files → Cleaning Recipes → Commits → Feature Sets → ML Models → Dashboards.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleExport("openlineage")}
            className="px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Download standard OpenLineage JSON spec"
          >
            <Download className="w-3.5 h-3.5 text-[#0061FE]" />
            <span>OpenLineage JSON</span>
          </button>

          <button
            onClick={() => handleExport("graphviz")}
            className="px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Download GraphViz DOT file"
          >
            <Download className="w-3.5 h-3.5 text-[#736B63]" />
            <span>GraphViz DOT</span>
          </button>

          <button
            onClick={() => setShowRegisterModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-[#0061FE]/20 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Model</span>
          </button>

          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-[#E8E4DF] bg-white hover:bg-[#FAF8F5] text-[#736B63] cursor-pointer"
            title="Refresh DAG"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main DAG Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        {/* Node Graph Flow View (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E8E4DF] shadow-2xs p-6 overflow-auto flex flex-col justify-start">
          <div className="flex items-center justify-between pb-4 border-b border-[#E8E4DF] mb-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#1E1915]">Pipeline Stage Flow</span>
              <span className="text-[10px] font-mono text-[#8C827A]">
                ({nodes.length} Nodes · {edges.length} Lineage Edges)
              </span>
            </div>

            {/* Stage Legend */}
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Raw Ingest</span>
              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">Commit</span>
              <span className="px-2 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">Features</span>
              <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">ML Model</span>
              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Report</span>
            </div>
          </div>

          {nodes.length === 0 ? (
            <div className="text-center text-xs text-[#8C827A] py-12">
              No lineage nodes recorded yet.
            </div>
          ) : (
            <div className="flex flex-col gap-6 py-4 w-full">
              {/* Categorical Rows */}
              {["Source Ingestion", "Catalog Table", "Version Snapshot", "Engineered Features", "Registered Model", "Dashboard Report"].map((cat) => {
                const catNodes = nodes.filter((n) => n.category === cat);
                if (catNodes.length === 0) return null;

                return (
                  <div key={cat} className="space-y-2">
                    <div className="text-[10px] font-mono uppercase font-bold text-[#8C827A] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0061FE]" />
                      <span>{cat}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {catNodes.map((n) => {
                        const isSelected = selectedNode?.id === n.id;
                        return (
                          <div
                            key={n.id}
                            onClick={() => handleSelectNode(n)}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                              isSelected
                                ? "bg-white border-[#0061FE] shadow-sm ring-2 ring-[#0061FE]/20"
                                : "bg-[#FAF8F5] hover:bg-white border-[#E8E4DF] hover:border-[#D6D0C7]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full border font-bold ${getNodeBadgeClass(n.category)}`}>
                                {n.badge || n.type}
                              </span>
                              {getNodeIcon(n.type)}
                            </div>

                            <div className="font-bold text-xs text-[#1E1915] truncate" title={n.label}>
                              {n.label}
                            </div>

                            <div className="text-[10px] text-[#736B63] font-mono truncate">
                              {n.details || "Verified node"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Node Inspector Drawer (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-[#E8E4DF] shadow-2xs p-5 overflow-y-auto space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8E4DF]">
            <h3 className="text-xs font-bold text-[#1E1915] uppercase tracking-wider flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-[#0061FE]" />
              <span>Asset Inspector</span>
            </h3>
            {selectedNode && (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${getNodeBadgeClass(selectedNode.category)}`}>
                {selectedNode.category}
              </span>
            )}
          </div>

          {selectedNode ? (
            <div className="space-y-4 text-xs">
              {/* Asset Header */}
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] space-y-1">
                <div className="font-bold text-[#1E1915] text-sm">{selectedNode.label}</div>
                <div className="text-[10px] font-mono text-[#736B63]">Node ID: {selectedNode.id}</div>
              </div>

              {/* Deletion Protection Badge */}
              {protectionCheck && (
                <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                  protectionCheck.deletion_blocked
                    ? "bg-rose-50 border-rose-200 text-rose-800"
                    : "bg-emerald-50 border-emerald-200 text-emerald-800"
                }`}>
                  {protectionCheck.deletion_blocked ? (
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold text-xs">
                      {protectionCheck.deletion_blocked ? "Deletion Protected (Locked)" : "Deletion Permitted"}
                    </div>
                    <div className="text-[11px] mt-0.5">
                      {protectionCheck.deletion_blocked
                        ? `Locked by ${protectionCheck.blocking_models_count} downstream asset(s). Cannot be deleted while production models depend on this snapshot.`
                        : "No downstream active production models rely on this version."}
                    </div>
                  </div>
                </div>
              )}

              {/* Provenance Actions */}
              <div className="space-y-2">
                <div className="text-[10px] font-mono uppercase font-bold text-[#8C827A]">
                  Provenance Analysis
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleTraceBackward}
                    disabled={isTracing}
                    className="p-2.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] hover:bg-white text-[11px] font-semibold text-[#1E1915] flex flex-col items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <ArrowRight className="w-4 h-4 text-[#0061FE] rotate-180" />
                    <span>Trace Backward</span>
                  </button>

                  <button
                    onClick={handleTraceForward}
                    disabled={isTracing}
                    className="p-2.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] hover:bg-white text-[11px] font-semibold text-[#1E1915] flex flex-col items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <ArrowRight className="w-4 h-4 text-purple-600" />
                    <span>Forward Impact</span>
                  </button>
                </div>
              </div>

              {/* Backward Trace Results */}
              {backwardTrace && (
                <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200 space-y-2 animate-in fade-in-50 duration-150">
                  <div className="font-bold text-xs text-blue-900 flex items-center justify-between">
                    <span>Backward Provenance Path</span>
                    <span className="font-mono text-[10px]">{backwardTrace.upstream_depth} Steps</span>
                  </div>
                  <div className="space-y-1 font-mono text-[11px] text-blue-800">
                    {backwardTrace.lineage_path.map((item: any, i: number) => (
                      <div key={item.id} className="flex items-center gap-1.5">
                        <span className="text-blue-500 font-bold">{i + 1}.</span>
                        <span className="truncate">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Forward Impact Results */}
              {forwardImpact && (
                <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-200 space-y-2 animate-in fade-in-50 duration-150">
                  <div className="font-bold text-xs text-purple-900 flex items-center justify-between">
                    <span>Forward Impact Consequence</span>
                    <span className="font-mono text-[10px]">{forwardImpact.total_downstream_impacted} Assets Affected</span>
                  </div>
                  <p className="text-[11px] text-purple-800">
                    {forwardImpact.has_active_models
                      ? `⚠️ Modifying this node affects ${forwardImpact.impacted_models.length} active ML model(s): ${forwardImpact.impacted_models.join(", ")}`
                      : "No active downstream ML models are impacted."}
                  </p>
                </div>
              )}

              {/* Asset Specific Specs */}
              <div className="space-y-2 font-mono text-[11px]">
                <div className="text-[10px] font-mono uppercase font-bold text-[#8C827A] pt-1">
                  Metadata & Links
                </div>
                {selectedNode.run_id && (
                  <div className="flex justify-between py-1.5 border-b border-[#FAF8F5]">
                    <span className="text-[#736B63]">Experiment Run:</span>
                    <span className="font-bold text-[#0061FE]">{selectedNode.run_id}</span>
                  </div>
                )}
                {selectedNode.artifact_uri && (
                  <div className="flex justify-between py-1.5 border-b border-[#FAF8F5]">
                    <span className="text-[#736B63]">Artifact URI:</span>
                    <span className="font-bold text-[#1E1915] truncate max-w-[180px]">{selectedNode.artifact_uri}</span>
                  </div>
                )}
                {selectedNode.created_at && (
                  <div className="flex justify-between py-1.5 border-b border-[#FAF8F5]">
                    <span className="text-[#736B63]">Timestamp:</span>
                    <span className="text-[#1E1915]">{selectedNode.created_at}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-[#8C827A] py-8 text-center">
              Select any node in the flow to inspect provenance details.
            </div>
          )}
        </div>
      </div>

      {/* Model Registration Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E8E4DF] shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#E8E4DF] pb-3">
              <h3 className="text-sm font-bold text-[#1E1915] flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#0061FE]" />
                <span>Register Model in Strata Registry</span>
              </h3>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-[#8C827A] hover:text-[#1E1915] p-1 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterModelSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#5C554D] block mb-1">
                  Model Name
                </label>
                <input
                  required
                  type="text"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder="e.g. Churn Risk Predictor v2"
                  className="w-full px-3 py-2 rounded-xl border border-[#E8E4DF] text-xs text-[#1E1915] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#5C554D] block mb-1">
                    Framework
                  </label>
                  <select
                    value={newModelFramework}
                    onChange={(e) => setNewModelFramework(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs text-[#1E1915] outline-none cursor-pointer"
                  >
                    <option value="LightGBM">LightGBM</option>
                    <option value="XGBoost">XGBoost</option>
                    <option value="Scikit-Learn">Scikit-Learn</option>
                    <option value="PyTorch">PyTorch</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#5C554D] block mb-1">
                    Algorithm
                  </label>
                  <input
                    type="text"
                    value={newModelAlgorithm}
                    onChange={(e) => setNewModelAlgorithm(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E8E4DF] text-xs text-[#1E1915] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#5C554D] block mb-1">
                    Metric Name
                  </label>
                  <input
                    type="text"
                    value={newModelMetricKey}
                    onChange={(e) => setNewModelMetricKey(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E8E4DF] text-xs text-[#1E1915] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#5C554D] block mb-1">
                    Score
                  </label>
                  <input
                    type="text"
                    value={newModelMetricVal}
                    onChange={(e) => setNewModelMetricVal(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E8E4DF] text-xs text-[#1E1915] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#5C554D] block mb-1">
                  MLflow / W&B Run ID (optional)
                </label>
                <input
                  type="text"
                  value={newModelRunId}
                  onChange={(e) => setNewModelRunId(e.target.value)}
                  placeholder="e.g. mlflow-run-391f82"
                  className="w-full px-3 py-2 rounded-xl border border-[#E8E4DF] font-mono text-xs text-[#1E1915] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#E8E4DF] hover:bg-[#FAF8F5] text-xs font-semibold text-[#736B63] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRegistering || !newModelName.trim()}
                  className="px-4 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold shadow-sm disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isRegistering ? "Registering..." : "Register Model"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
