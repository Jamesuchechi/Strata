"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Cpu,
  Play,
  RotateCw,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Server,
  Code2,
  Share2,
  Send,
  Lock,
  EyeOff,
  UserX,
  Layers,
  Database,
  Check,
  Copy,
  ExternalLink,
  Sparkles,
  Activity,
  HardDrive,
  BarChart2,
  Flame,
  ArrowRight,
} from "lucide-react";
import {
  fetchPipelines,
  runPipeline,
  pipelineDryRun,
  fetchPipelineRuns,
  fetchDeadLetterQueue,
  retryDeadLetterJob,
  fetchIntegrationsStatus,
  fetchIntegrationCodeTemplates,
  testWebhookAlert,
  fetchEncryptionStatus,
  fetchAuditLogs,
  maskDatasetExport,
  gdprRedactCustomer,
  fetchAdminOverview,
  fetchPlatformHealth,
  fetchRateLimits,
  fetchWorkerQueues,
} from "@/lib/api";
import {
  PipelineItem,
  PipelineRun,
  DeadLetterItem,
  IntegrationStatusResponse,
  AuditLogItem,
  AdminOverview,
  PlatformHealth,
} from "@/lib/types";

export default function PipelinesAndPlatformPage() {
  const [activeTab, setActiveTab] = useState<"pipelines" | "integrations" | "security" | "admin">("pipelines");

  // Pipeline State
  const [pipelines, setPipelines] = useState<PipelineItem[]>([]);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [dlq, setDlq] = useState<DeadLetterItem[]>([]);
  const [selectedRun, setSelectedRun] = useState<PipelineRun | null>(null);
  const [isExecuting, setIsExecuting] = useState<string | null>(null);

  // Integrations State
  const [integrations, setIntegrations] = useState<IntegrationStatusResponse | null>(null);
  const [codeTemplates, setCodeTemplates] = useState<Record<string, string>>({});
  const [selectedCodeTab, setSelectedCodeTab] = useState<"airflow" | "prefect" | "dbt" | "jupyter_vscode" | "mlflow">("airflow");
  const [webhookTestService, setWebhookTestService] = useState<string>("slack");
  const [webhookMessage, setWebhookMessage] = useState<string>("Strata Alert: Production pipeline executed with 0 errors.");
  const [webhookSentStatus, setWebhookSentStatus] = useState<string | null>(null);

  // Security & Audit State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [chainIntegrity, setChainIntegrity] = useState<boolean>(true);
  const [encryptionData, setEncryptionData] = useState<any>(null);
  const [maskSuccess, setMaskSuccess] = useState<any>(null);
  const [gdprCustomerId, setGdprCustomerId] = useState<string>("CUST-1002");
  const [gdprResult, setGdprResult] = useState<any>(null);

  // Admin Telemetry State
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [rateLimits, setRateLimits] = useState<any>(null);
  const [queueTelemetry, setQueueTelemetry] = useState<any>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const loadData = async () => {
    try {
      const pData = await fetchPipelines();
      setPipelines(pData.pipelines || []);

      const rData = await fetchPipelineRuns();
      setRuns(rData.runs || []);
      if (rData.runs && rData.runs.length > 0) {
        setSelectedRun(rData.runs[0]);
      }

      const dlqData = await fetchDeadLetterQueue();
      setDlq(dlqData.dlq || []);

      const intData = await fetchIntegrationsStatus();
      setIntegrations(intData);

      const codes = await fetchIntegrationCodeTemplates("customer_churn.csv", "v1.2.0");
      setCodeTemplates(codes.templates || {});

      const audit = await fetchAuditLogs();
      setAuditLogs(audit.audit_logs || []);
      setChainIntegrity(audit.chain_integrity_verified);

      const enc = await fetchEncryptionStatus();
      setEncryptionData(enc);

      const adm = await fetchAdminOverview();
      setAdminOverview(adm);

      const hlth = await fetchPlatformHealth();
      setHealth(hlth);

      const rl = await fetchRateLimits();
      setRateLimits(rl);

      const q = await fetchWorkerQueues();
      setQueueTelemetry(q);
    } catch (err) {
      console.error("Failed to load platform data:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunPipeline = async (pipelineId: string) => {
    setIsExecuting(pipelineId);
    try {
      const res = await runPipeline(pipelineId);
      setSelectedRun(res.run);
      setRuns((prev) => [res.run, ...prev]);
      alert(`Pipeline execution finished in ${res.run.duration_ms}ms with 0 errors!`);
    } catch (err: any) {
      alert(`Pipeline failed: ${err.message}`);
      const updatedDlq = await fetchDeadLetterQueue();
      setDlq(updatedDlq.dlq || []);
    } finally {
      setIsExecuting(null);
    }
  };

  const handleRetryDlq = async (dlqId: string) => {
    try {
      const res = await retryDeadLetterJob(dlqId);
      if (res.status === "retry_success") {
        alert("DLQ job retried and resolved successfully!");
        setDlq((prev) => prev.filter((d) => d.dlq_id !== dlqId));
      } else {
        alert(`Retry failed: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Retry request error: ${err.message}`);
    }
  };

  const handleTestWebhook = async () => {
    try {
      const res = await testWebhookAlert(webhookTestService, webhookMessage);
      setWebhookSentStatus(`Delivered to ${webhookTestService.toUpperCase()} (${res.event.id})`);
      setTimeout(() => setWebhookSentStatus(null), 3000);
    } catch (err: any) {
      alert(`Webhook dispatch failed: ${err.message}`);
    }
  };

  const handleMaskTest = async () => {
    try {
      const res = await maskDatasetExport("churn_demo", ["email", "name"]);
      setMaskSuccess(res);
    } catch (err: any) {
      alert(`PII Masking failed: ${err.message}`);
    }
  };

  const handleGdprRedact = async () => {
    if (!confirm(`Are you sure you want to execute GDPR Article 17 cascading erasure for customer ID '${gdprCustomerId}'?`)) {
      return;
    }
    try {
      const res = await gdprRedactCustomer(gdprCustomerId, ["churn_demo"]);
      setGdprResult(res);
      alert(`GDPR right-to-be-forgotten executed: ${res.total_records_purged} records purged cascadingly.`);
    } catch (err: any) {
      alert(`GDPR redaction error: ${err.message}`);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#1E1915] via-[#2A2420] to-[#1E1915] rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-[#0061FE]/15 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold tracking-wide uppercase text-white/90 border border-white/15 backdrop-blur-sm">
            <Cpu className="w-3.5 h-3.5 text-[#0061FE]" />
            Scale-Ready Platform • Pillars 7, 12, 13, 16 & 17
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Pipelines, Compute Sandboxes & Platform Ops
          </h1>
          <p className="text-[#E8E4DF] text-sm sm:text-base leading-relaxed">
            Execute scheduled Python/Polars ETL pipelines in memory-isolated sandboxes, observe worker
            queues, verify cryptographic audit trails, configure Airflow/dbt/MLflow bridges, and enforce GDPR compliance.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/10 text-xs font-mono">
            <div>
              <p className="text-white/60">Platform Status</p>
              <p className="text-lg font-bold text-emerald-400">99.98% Live</p>
            </div>
            <div>
              <p className="text-white/60">Worker Queues</p>
              <p className="text-lg font-bold text-[#60A5FA]">4 Active</p>
            </div>
            <div>
              <p className="text-white/60">Audit Trail</p>
              <p className="text-lg font-bold text-purple-300">SHA256 Chained</p>
            </div>
            <div>
              <p className="text-white/60">Dead-Letter DLQ</p>
              <p className="text-lg font-bold text-amber-400">{dlq.length} Jobs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Studio Navigation Tabs */}
      <div className="border-b border-[#E8E4DF] flex items-center gap-2 text-xs font-bold">
        <button
          onClick={() => setActiveTab("pipelines")}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "pipelines"
              ? "border-[#0061FE] text-[#0061FE] bg-blue-50/20"
              : "border-transparent text-[#6F675F] hover:text-[#1E1915]"
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Pipelines & Compute Sandboxes (7.4 - 7.9)</span>
        </button>

        <button
          onClick={() => setActiveTab("integrations")}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "integrations"
              ? "border-[#0061FE] text-[#0061FE] bg-blue-50/20"
              : "border-transparent text-[#6F675F] hover:text-[#1E1915]"
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>Ecosystem Connectors & Webhooks (12.1 - 12.10)</span>
        </button>

        <button
          onClick={() => setActiveTab("security")}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "security"
              ? "border-[#0061FE] text-[#0061FE] bg-blue-50/20"
              : "border-transparent text-[#6F675F] hover:text-[#1E1915]"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Security, Audit & GDPR (16.1 - 16.6)</span>
        </button>

        <button
          onClick={() => setActiveTab("admin")}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "admin"
              ? "border-[#0061FE] text-[#0061FE] bg-blue-50/20"
              : "border-transparent text-[#6F675F] hover:text-[#1E1915]"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Admin & Platform Ops (17.1 - 17.5)</span>
        </button>
      </div>

      {/* Tab 1: Pipelines & Compute Sandboxes */}
      {activeTab === "pipelines" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pipelines List */}
            <div className="lg:col-span-1 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#1E1915]">Registered Pipelines</h3>
                <span className="text-xs font-mono text-[#8C827A]">{pipelines.length} Active</span>
              </div>

              {pipelines.map((p) => (
                <div
                  key={p.id}
                  className="bg-white border border-[#E8E4DF] hover:border-[#0061FE] rounded-xl p-4 shadow-sm space-y-3 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-50 text-purple-700 border border-purple-200 uppercase font-semibold">
                      {p.trigger} ({p.schedule})
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {p.last_status}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-[#1E1915]">{p.name}</h4>
                    <p className="text-xs text-[#6F675F] line-clamp-2 mt-0.5">{p.description}</p>
                  </div>

                  <div className="pt-2 border-t border-[#E8E4DF] flex items-center justify-between text-xs text-[#8C827A] font-mono text-[11px]">
                    <span>{p.max_memory_mb}MB RAM</span>
                    <span>•</span>
                    <span>{p.steps.length} Steps</span>
                    <span>•</span>
                    <button
                      onClick={() => handleRunPipeline(p.id)}
                      disabled={isExecuting === p.id}
                      className="px-2.5 py-1 bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-sm transition-colors disabled:opacity-50"
                    >
                      <Play className="w-3 h-3" />
                      <span>{isExecuting === p.id ? "Running..." : "Run Sandbox"}</span>
                    </button>
                  </div>
                </div>
              ))}

              {/* Dead-Letter Queue (DLQ) Card */}
              {dlq.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-amber-900 font-bold text-xs">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Dead-Letter Queue (DLQ)</span>
                    </div>
                    <span>{dlq.length} Failed</span>
                  </div>
                  <p className="text-[11px] text-amber-700">
                    Failed jobs captured with full stack trace for triage:
                  </p>
                  <div className="space-y-2">
                    {dlq.map((item) => (
                      <div key={item.dlq_id} className="p-2.5 bg-white rounded-lg border border-amber-200 text-xs space-y-1">
                        <div className="flex items-center justify-between font-mono text-[10px] text-[#8C827A]">
                          <span>{item.dlq_id}</span>
                          <span className="text-rose-600 font-bold">Retries: {item.retry_count}</span>
                        </div>
                        <p className="font-mono text-[11px] text-rose-700 truncate">{item.error}</p>
                        <button
                          onClick={() => handleRetryDlq(item.dlq_id)}
                          className="mt-1 px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-semibold flex items-center gap-1"
                        >
                          <RotateCw className="w-2.5 h-2.5" />
                          <span>Retry Job</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Execution Sandbox Logs & Terminal */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#0061FE]" />
                  <h3 className="text-sm font-bold text-[#1E1915]">
                    Compute Sandbox Execution Logs {selectedRun ? `(${selectedRun.run_id})` : ""}
                  </h3>
                </div>
                {selectedRun && (
                  <span className="text-xs font-mono text-[#8C827A]">
                    Duration: {selectedRun.duration_ms}ms • Output: {selectedRun.output_rows} rows x {selectedRun.output_columns} cols
                  </span>
                )}
              </div>

              {/* Terminal View */}
              <div className="bg-[#1E1915] rounded-xl p-5 text-emerald-400 font-mono text-xs shadow-inner h-96 overflow-y-auto space-y-2">
                {selectedRun ? (
                  selectedRun.logs.map((line, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-white/40 select-none">$</span>
                      <span className={line.includes("ERROR") ? "text-rose-400" : "text-emerald-300"}>
                        {line}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-white/40 flex items-center justify-center h-full">
                    Select or trigger a pipeline run to inspect live stdout/stderr telemetry.
                  </div>
                )}
              </div>

              {/* Sample Output Preview */}
              {selectedRun?.sample_preview && selectedRun.sample_preview.length > 0 && (
                <div className="bg-white border border-[#E8E4DF] rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-[#1E1915]">Transformed Data Sample</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-[11px] border-collapse">
                      <thead>
                        <tr className="border-b border-[#E8E4DF] bg-[#FAF8F5]">
                          {Object.keys(selectedRun.sample_preview[0]).map((col) => (
                            <th key={col} className="p-2 font-semibold text-[#1E1915] whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8E4DF]">
                        {selectedRun.sample_preview.map((row, i) => (
                          <tr key={i} className="hover:bg-blue-50/20">
                            {Object.values(row).map((val: any, j) => (
                              <td key={j} className="p-2 whitespace-nowrap text-[#4A423B]">
                                {String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Ecosystem Connectors & Webhooks */}
      {activeTab === "integrations" && (
        <div className="space-y-6">
          {/* Connectors Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {integrations?.connectors.map((c) => (
              <div key={c.id} className="p-4 bg-white border border-[#E8E4DF] rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#8C827A] uppercase">{c.type}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <h4 className="text-xs font-bold text-[#1E1915]">{c.name}</h4>
                <div className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded inline-block">
                  {c.status.toUpperCase()}
                </div>
              </div>
            ))}
          </div>

          {/* Webhook Alert Dispatcher */}
          <div className="bg-[#FAF8F5] border border-[#E8E4DF] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#1E1915]">Webhook Alert Dispatcher (12.3)</h3>
                <p className="text-xs text-[#6F675F]">
                  Broadcast pipeline completions, schema drifts, or ML metric alerts directly to your team.
                </p>
              </div>
              {webhookSentStatus && (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                  {webhookSentStatus}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <select
                value={webhookTestService}
                onChange={(e) => setWebhookTestService(e.target.value)}
                className="px-3 py-2 bg-white border border-[#E8E4DF] rounded-lg text-xs font-medium"
              >
                <option value="slack">Slack (#data-alerts)</option>
                <option value="discord">Discord (#mlops-pipeline)</option>
                <option value="teams">Microsoft Teams</option>
              </select>

              <input
                type="text"
                value={webhookMessage}
                onChange={(e) => setWebhookMessage(e.target.value)}
                className="flex-1 px-3 py-2 bg-white border border-[#E8E4DF] rounded-lg text-xs"
              />

              <button
                onClick={handleTestWebhook}
                className="px-4 py-2 bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Test Webhook</span>
              </button>
            </div>
          </div>

          {/* Production Code Templates */}
          <div className="bg-white border border-[#E8E4DF] rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1E1915]">
                Export Production Boilerplate (Airflow, Prefect, dbt, Jupyter & MLflow)
              </h3>
              <button
                onClick={() => copyToClipboard(codeTemplates[selectedCodeTab] || "", "code_copy")}
                className="inline-flex items-center gap-1 px-3 py-1 bg-[#FAF8F5] border border-[#E8E4DF] hover:bg-[#E8E4DF] rounded-lg text-xs font-semibold text-[#1E1915]"
              >
                {copiedKey === "code_copy" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === "code_copy" ? "Copied!" : "Copy Snippet"}</span>
              </button>
            </div>

            {/* Code Tabs */}
            <div className="flex items-center gap-2 border-b border-[#E8E4DF] pb-2 text-xs font-semibold">
              {(["airflow", "prefect", "dbt", "jupyter_vscode", "mlflow"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedCodeTab(tab)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                    selectedCodeTab === tab
                      ? "bg-[#1E1915] text-white"
                      : "text-[#6F675F] hover:bg-[#FAF8F5]"
                  }`}
                >
                  {tab.replace("_", " & ")}
                </button>
              ))}
            </div>

            <div className="bg-[#1E1915] text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-x-auto">
              <pre>{codeTemplates[selectedCodeTab] || "# Loading snippet..."}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Security, Audit Trail & GDPR */}
      {activeTab === "security" && (
        <div className="space-y-6">
          {/* Encryption & Cryptographic Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-white border border-[#E8E4DF] rounded-xl space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#1E1915] flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <span>AES-256 Envelope Encryption (Pillar 16.1)</span>
                </h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Compliant
                </span>
              </div>
              <p className="text-xs text-[#6F675F]">
                Storage volumes encrypted using XTS-AES-256. Database columns protected with transparent hardware-backed KMS key rotation.
              </p>
            </div>

            <div className="p-5 bg-white border border-[#E8E4DF] rounded-xl space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#1E1915] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#0061FE]" />
                  <span>Cryptographic Audit Trail (Pillar 16.3)</span>
                </h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {chainIntegrity ? "SHA256 Chain Verified" : "Integrity Warning"}
                </span>
              </div>
              <p className="text-xs text-[#6F675F]">
                Each action is hashed and chained to prior event hashes, producing an immutable blockchain-style audit record.
              </p>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-white border border-[#E8E4DF] rounded-2xl overflow-hidden shadow-sm space-y-2">
            <div className="p-4 border-b border-[#E8E4DF] bg-[#FAF8F5] flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#1E1915]">Immutable Audit Log History ({auditLogs.length} Records)</h3>
              <span className="text-[11px] font-mono text-emerald-700 font-semibold">100% Cryptographically Tamper-Proof</span>
            </div>
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#FAF8F5] text-[#8C827A] border-b border-[#E8E4DF]">
                  <tr>
                    <th className="p-2.5">Timestamp</th>
                    <th className="p-2.5">Actor</th>
                    <th className="p-2.5">Action</th>
                    <th className="p-2.5">Target</th>
                    <th className="p-2.5">Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E4DF]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-blue-50/10">
                      <td className="p-2.5 text-[#8C827A] whitespace-nowrap">{log.timestamp}</td>
                      <td className="p-2.5 font-bold text-[#1E1915] whitespace-nowrap">{log.actor}</td>
                      <td className="p-2.5 text-blue-700 whitespace-nowrap">{log.action}</td>
                      <td className="p-2.5 text-[#4A423B] whitespace-nowrap">{log.target}</td>
                      <td className="p-2.5 text-[#8C827A] text-[10px] truncate max-w-xs">{log.hash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* PII Masking & GDPR Tools */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PII Masking */}
            <div className="bg-white border border-[#E8E4DF] rounded-2xl p-5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#1E1915] flex items-center gap-1.5">
                  <EyeOff className="w-4 h-4 text-purple-600" />
                  <span>Column-Level PII Masking (16.4)</span>
                </h4>
                <button
                  onClick={handleMaskTest}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold"
                >
                  Test Mask Export
                </button>
              </div>
              <p className="text-xs text-[#6F675F]">
                Synthetically obfuscate sensitive identifiers (emails, phone numbers, names) on restricted downloads.
              </p>
              {maskSuccess && (
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-900 space-y-1">
                  <p className="font-bold">Masked Columns: {maskSuccess.masked_columns.join(", ")}</p>
                  <p className="font-mono text-[11px] truncate">
                    Sample: {JSON.stringify(maskSuccess.sample_preview[0])}
                  </p>
                </div>
              )}
            </div>

            {/* GDPR Redaction */}
            <div className="bg-white border border-[#E8E4DF] rounded-2xl p-5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#1E1915] flex items-center gap-1.5">
                  <UserX className="w-4 h-4 text-rose-600" />
                  <span>GDPR Cascading Erasure (16.5)</span>
                </h4>
                <button
                  onClick={handleGdprRedact}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
                >
                  Purge Customer
                </button>
              </div>
              <p className="text-xs text-[#6F675F]">
                Right to be Forgotten cascading purge across datasets and historical lineage.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={gdprCustomerId}
                  onChange={(e) => setGdprCustomerId(e.target.value)}
                  className="flex-1 p-2 bg-[#FAF8F5] border border-[#E8E4DF] rounded-lg text-xs font-mono"
                  placeholder="Customer ID to purge..."
                />
              </div>
              {gdprResult && (
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900">
                  Purged {gdprResult.total_records_purged} records for {gdprResult.customer_identifier}.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Admin, Health & Queue Telemetry */}
      {activeTab === "admin" && (
        <div className="space-y-6">
          {/* Cluster Telemetry Gauges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-white border border-[#E8E4DF] rounded-xl shadow-2xs">
              <div className="text-xs text-[#8C827A] flex items-center justify-between mb-1">
                <span>CPU Load</span>
                <Cpu className="w-4 h-4 text-[#0061FE]" />
              </div>
              <div className="text-2xl font-bold text-[#1E1915] font-mono">{health?.cpu_usage_pct}%</div>
              <div className="text-[10px] text-emerald-700 font-semibold mt-1">Normal Operating Range</div>
            </div>

            <div className="p-4 bg-white border border-[#E8E4DF] rounded-xl shadow-2xs">
              <div className="text-xs text-[#8C827A] flex items-center justify-between mb-1">
                <span>RAM Usage</span>
                <Server className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-[#1E1915] font-mono">{health?.memory_used_mb} MB</div>
              <div className="text-[10px] text-[#8C827A] font-mono mt-1">Of 8,192 MB Allocated</div>
            </div>

            <div className="p-4 bg-white border border-[#E8E4DF] rounded-xl shadow-2xs">
              <div className="text-xs text-[#8C827A] flex items-center justify-between mb-1">
                <span>DuckDB Latency (p95)</span>
                <Clock className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-[#1E1915] font-mono">{health?.duckdb_latency_p95_ms} ms</div>
              <div className="text-[10px] text-emerald-700 font-semibold mt-1">Sub-second Vectorized</div>
            </div>

            <div className="p-4 bg-white border border-[#E8E4DF] rounded-xl shadow-2xs">
              <div className="text-xs text-[#8C827A] flex items-center justify-between mb-1">
                <span>Uptime</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-[#1E1915] font-mono">{adminOverview?.uptime_hours} hrs</div>
              <div className="text-[10px] text-emerald-700 font-semibold mt-1">99.98% High Availability</div>
            </div>
          </div>

          {/* Rate Limiting Policies */}
          <div className="bg-white border border-[#E8E4DF] rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#1E1915]">Token Bucket Throttling Policies (17.3)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-[#FAF8F5] border border-[#E8E4DF] rounded-xl space-y-1">
                <h4 className="text-xs font-bold text-[#1E1915]">Community Free</h4>
                <p className="text-sm font-mono text-[#0061FE] font-bold">60 req/min</p>
                <p className="text-[11px] text-[#8C827A]">Burst allowance: 15 req • 2 concurrent</p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                <h4 className="text-xs font-bold text-blue-900">Pro Researcher</h4>
                <p className="text-sm font-mono text-[#0061FE] font-bold">300 req/min</p>
                <p className="text-[11px] text-blue-700">Burst allowance: 60 req • 8 concurrent</p>
              </div>

              <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-1">
                <h4 className="text-xs font-bold text-purple-900">Team Enterprise</h4>
                <p className="text-sm font-mono text-purple-700 font-bold">1,200 req/min</p>
                <p className="text-[11px] text-purple-700">Burst allowance: 250 req • 32 concurrent</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
