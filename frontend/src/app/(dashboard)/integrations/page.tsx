"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Network,
  Cpu,
  Database,
  Code2,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Copy,
  Plus,
  Send,
  RefreshCw,
  Server,
  Layers,
  Globe,
  HardDrive,
  MessageSquare,
  Bot,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import {
  fetchIntegrationsStatus,
  fetchIntegrationCodeTemplates,
  testWebhookAlert,
  createWebhook,
  deleteWebhook,
  syncMLflow,
  fetchDatabaseConnections,
  saveDatabaseConnection,
  deleteDatabaseConnection,
  testDatabaseConnection,
  fetchDatasets,
} from "@/lib/api";
import {
  IntegrationStatusResponse,
  DatabaseConnection,
  WebhookConfig,
  DatasetItem,
} from "@/lib/types";

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<"connectors" | "boilerplate" | "webhooks" | "mlflow" | "databases">("connectors");
  const [statusData, setStatusData] = useState<IntegrationStatusResponse | null>(null);
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [dbConnections, setDbConnections] = useState<DatabaseConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Boilerplate Generator State
  const [selectedDataset, setSelectedDataset] = useState<string>("my_dataset.csv");
  const [selectedVersion, setSelectedVersion] = useState<string>("main");
  const [boilerplateTab, setBoilerplateTab] = useState<"jupyter_vscode" | "airflow" | "prefect" | "dbt" | "mlflow">("jupyter_vscode");
  const [codeTemplates, setCodeTemplates] = useState<Record<string, string>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Webhook Management & Test State
  const [isAddWebhookOpen, setIsAddWebhookOpen] = useState(false);
  const [newWhService, setNewWhService] = useState<"slack" | "discord" | "teams" | "generic">("slack");
  const [newWhName, setNewWhName] = useState("");
  const [newWhUrl, setNewWhUrl] = useState("");
  const [newWhEvents, setNewWhEvents] = useState<string[]>(["pipeline_failed", "schema_drift"]);
  const [testWhService, setTestWhService] = useState("slack");
  const [testWhMessage, setTestWhMessage] = useState("Strata Automated Alert: Pipeline run #1042 completed with 0 errors.");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testAlertResult, setTestAlertResult] = useState<any>(null);

  // MLflow Sync State
  const [mlflowUri, setMlflowUri] = useState("http://localhost:5000");
  const [mlflowExpName, setMlflowExpName] = useState("Strata_Production_Models");
  const [mlflowModelName, setMlflowModelName] = useState("lightgbm_customer_churn");
  const [mlflowDatasetName, setMlflowDatasetName] = useState("customers.parquet");
  const [mlflowVersionHash, setMlflowVersionHash] = useState("a1f94c8e7b1029");
  const [mlflowMetrics, setMlflowMetrics] = useState<string>("accuracy: 0.942\nauc_roc: 0.968\nf1_score: 0.931");
  const [isSyncingMlflow, setIsSyncingMlflow] = useState(false);
  const [mlflowSyncResult, setMlflowSyncResult] = useState<any>(null);

  // Database Connection Vault State
  const [isAddDbOpen, setIsAddDbOpen] = useState(false);
  const [newDbName, setNewDbName] = useState("");
  const [newDbType, setNewDbType] = useState<"postgres" | "snowflake" | "bigquery" | "clickhouse" | "sqlite" | "s3">("postgres");
  const [newDbHost, setNewDbHost] = useState("");
  const [newDbPort, setNewDbPort] = useState("");
  const [newDbDatabase, setNewDbDatabase] = useState("");
  const [newDbUsername, setNewDbUsername] = useState("");
  const [newDbPassword, setNewDbPassword] = useState("");
  const [testingConnId, setTestingConnId] = useState<string | null>(null);
  const [connTestResults, setConnTestResults] = useState<Record<string, any>>({});

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statusRes, datasetsRes, dbRes] = await Promise.all([
        fetchIntegrationsStatus().catch(() => null),
        fetchDatasets().catch(() => []),
        fetchDatabaseConnections().catch(() => ({ connections: [] })),
      ]);

      if (statusRes) {
        setStatusData(statusRes);
      }
      setDatasets(datasetsRes);
      if (datasetsRes.length > 0) {
        setSelectedDataset(datasetsRes[0].filename || datasetsRes[0].name);
        setSelectedVersion(datasetsRes[0].latest_version || "main");
      }
      setDbConnections(dbRes.connections || []);
    } catch (err: any) {
      setError(err.message || "Failed to load integrations data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDataset) {
      fetchIntegrationCodeTemplates(selectedDataset, selectedVersion)
        .then((res) => setCodeTemplates(res.templates))
        .catch((err) => console.error("Failed to load code templates:", err));
    }
  }, [selectedDataset, selectedVersion]);

  const handleCopyCode = (code: string, key: string) => {
    navigator.clipboard.writeText(code);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWhName.trim() || !newWhUrl.trim()) return;
    try {
      await createWebhook({
        service: newWhService,
        name: newWhName.trim(),
        url: newWhUrl.trim(),
        events: newWhEvents,
        is_active: true,
      });
      setIsAddWebhookOpen(false);
      setNewWhName("");
      setNewWhUrl("");
      setSuccessMsg("Webhook registered successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
      loadAllData();
    } catch (err: any) {
      setError(err.message || "Failed to create webhook");
    }
  };

  const handleDeleteWebhook = async (whId: string) => {
    try {
      await deleteWebhook(whId);
      setSuccessMsg("Webhook removed");
      setTimeout(() => setSuccessMsg(null), 3000);
      loadAllData();
    } catch (err: any) {
      setError(err.message || "Failed to delete webhook");
    }
  };

  const handleSendTestWebhook = async () => {
    setError(null);
    setIsSendingTest(true);
    setTestAlertResult(null);
    try {
      const res = await testWebhookAlert(testWhService, testWhMessage);
      setTestAlertResult(res);
      loadAllData();
    } catch (err: any) {
      setError(err.message || "Webhook test dispatch failed");
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSyncMLflow = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSyncingMlflow(true);
    setMlflowSyncResult(null);

    // Parse metrics
    const metricsObj: Record<string, number> = {};
    mlflowMetrics.split("\n").forEach((line) => {
      const parts = line.split(":");
      if (parts.length === 2) {
        const val = parseFloat(parts[1].trim());
        if (!isNaN(val)) {
          metricsObj[parts[0].trim()] = val;
        }
      }
    });

    try {
      const res = await syncMLflow({
        mlflow_tracking_uri: mlflowUri.trim(),
        experiment_name: mlflowExpName.trim(),
        model_name: mlflowModelName.trim(),
        dataset_name: mlflowDatasetName.trim(),
        version_hash: mlflowVersionHash.trim(),
        metrics: metricsObj,
      });
      setMlflowSyncResult(res);
      setSuccessMsg("Lineage and metrics successfully synced with MLflow!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || "MLflow synchronization failed");
    } finally {
      setIsSyncingMlflow(false);
    }
  };

  const handleSaveDbConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDbName.trim()) return;
    try {
      await saveDatabaseConnection({
        name: newDbName.trim(),
        db_type: newDbType,
        host: newDbHost.trim() || undefined,
        port: parseInt(newDbPort, 10) || undefined,
        database: newDbDatabase.trim() || undefined,
        username: newDbUsername.trim() || undefined,
        password: newDbPassword || undefined,
      });
      setIsAddDbOpen(false);
      setNewDbName("");
      setNewDbHost("");
      setNewDbPort("");
      setNewDbDatabase("");
      setNewDbUsername("");
      setNewDbPassword("");
      setSuccessMsg("Database profile saved to credentials vault!");
      setTimeout(() => setSuccessMsg(null), 3000);
      loadAllData();
    } catch (err: any) {
      setError(err.message || "Failed to save database connection profile");
    }
  };

  const handleDeleteDbConnection = async (connId: string) => {
    try {
      await deleteDatabaseConnection(connId);
      loadAllData();
    } catch (err: any) {
      setError(err.message || "Failed to delete connection profile");
    }
  };

  const handleTestSavedConnection = async (conn: DatabaseConnection) => {
    setTestingConnId(conn.id);
    try {
      const res = await testDatabaseConnection({
        db_type: conn.db_type,
        host: conn.host,
        port: conn.port,
        database: conn.database,
        username: conn.username,
      });
      setConnTestResults((prev) => ({ ...prev, [conn.id]: res }));
    } catch (err: any) {
      setConnTestResults((prev) => ({
        ...prev,
        [conn.id]: { success: false, message: err.message || "Connection failed" },
      }));
    } finally {
      setTestingConnId(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-mono text-[#8C827A] uppercase tracking-wider">
          <Link href="/dashboard" className="hover:text-[#1E1915] transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-[#0061FE] font-bold">Integrations & Connectors</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1E1915] tracking-tight">
              Ecosystem Integrations & Connectors
            </h1>
            <p className="text-sm text-[#5C554D] max-w-2xl leading-relaxed mt-1">
              Connect Strata zero-copy datasets with JupyterLab, VS Code, Apache Airflow, Prefect, dbt, and MLflow, and configure real-time alert webhooks.
            </p>
          </div>
          <button
            onClick={loadAllData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-[#E8E4DF] text-[#5C554D] hover:text-[#1E1915] hover:border-[#0061FE] transition-all shadow-xs shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh Health</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#E8E4DF] pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab("connectors")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === "connectors"
              ? "border-[#0061FE] text-[#0061FE] bg-white shadow-xs"
              : "border-transparent text-[#5C554D] hover:text-[#1E1915] hover:bg-[#F7F5F2]"
          }`}
        >
          <Network className="w-3.5 h-3.5 text-teal-600" />
          <span>Ecosystem Connectors</span>
        </button>
        <button
          onClick={() => setActiveTab("boilerplate")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === "boilerplate"
              ? "border-[#0061FE] text-[#0061FE] bg-white shadow-xs"
              : "border-transparent text-[#5C554D] hover:text-[#1E1915] hover:bg-[#F7F5F2]"
          }`}
        >
          <Code2 className="w-3.5 h-3.5 text-[#0061FE]" />
          <span>Code Boilerplate Generator</span>
        </button>
        <button
          onClick={() => setActiveTab("webhooks")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === "webhooks"
              ? "border-[#0061FE] text-[#0061FE] bg-white shadow-xs"
              : "border-transparent text-[#5C554D] hover:text-[#1E1915] hover:bg-[#F7F5F2]"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
          <span>Webhooks & Alerts</span>
        </button>
        <button
          onClick={() => setActiveTab("mlflow")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === "mlflow"
              ? "border-[#0061FE] text-[#0061FE] bg-white shadow-xs"
              : "border-transparent text-[#5C554D] hover:text-[#1E1915] hover:bg-[#F7F5F2]"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>MLflow Lineage Sync</span>
        </button>
        <button
          onClick={() => setActiveTab("databases")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === "databases"
              ? "border-[#0061FE] text-[#0061FE] bg-white shadow-xs"
              : "border-transparent text-[#5C554D] hover:text-[#1E1915] hover:bg-[#F7F5F2]"
          }`}
        >
          <Database className="w-3.5 h-3.5 text-emerald-600" />
          <span>Database Connections Vault</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-800 text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tab 1: Connectors Grid */}
      {activeTab === "connectors" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                id: "jupyter",
                name: "JupyterLab & VS Code Extension",
                category: "Notebooks & IDE",
                status: "active",
                desc: "Zero-copy data exploration using Python SDK, Polars, and DuckDB in-memory buffers.",
                icon: <Terminal className="w-5 h-5 text-[#0061FE]" />,
                badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
              },
              {
                id: "airflow",
                name: "Apache Airflow Operator",
                category: "Data Orchestration",
                status: "ready",
                desc: "Schedule vectorized dataset synchronization and ETL pipeline runs via custom Airflow DAGs.",
                icon: <Cpu className="w-5 h-5 text-rose-600" />,
                badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
              },
              {
                id: "prefect",
                name: "Prefect Flow Engine",
                category: "Dataflow Automation",
                status: "ready",
                desc: "Execute resilient dataflows with automatic retries and version-tagged dataset tracking.",
                icon: <Zap className="w-5 h-5 text-amber-600" />,
                badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
              },
              {
                id: "dbt",
                name: "dbt Core / dbt Cloud Adapter",
                category: "Transformation",
                status: "ready",
                desc: "Transform Strata Lakehouse snapshots with modular SQL models and incremental tables.",
                icon: <Layers className="w-5 h-5 text-purple-600" />,
                badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
              },
              {
                id: "mlflow",
                name: "MLflow Experiment Tracking",
                category: "MLOps & Lineage",
                status: statusData?.connectors?.find((c) => c.id === "mlflow")?.status || "ready",
                desc: "Log dataset commit hashes, schema changes, and model training metrics directly into MLflow.",
                icon: <Sparkles className="w-5 h-5 text-cyan-600" />,
                badgeColor: "bg-cyan-50 text-cyan-700 border-cyan-200",
              },
              {
                id: "slack",
                name: "Slack Webhook Notifications",
                category: "Incident Alerting",
                status: "active",
                desc: "Post pipeline failures, schema drift warnings, and model promotion events to Slack channels.",
                icon: <MessageSquare className="w-5 h-5 text-emerald-600" />,
                badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
              },
            ].map((conn) => (
              <div
                key={conn.id}
                className="bg-white rounded-2xl border border-[#E8E4DF] p-5 flex flex-col justify-between space-y-4 hover:border-[#0061FE] hover:shadow-md transition-all group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] flex items-center justify-center">
                      {conn.icon}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono border uppercase font-bold ${conn.badgeColor}`}
                    >
                      {conn.status}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-[#8C827A] uppercase tracking-wider block">
                      {conn.category}
                    </span>
                    <h3 className="text-sm font-bold text-[#1E1915] group-hover:text-[#0061FE] transition-colors">
                      {conn.name}
                    </h3>
                  </div>

                  <p className="text-xs text-[#5C554D] leading-relaxed">
                    {conn.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#E8E4DF] flex items-center justify-between">
                  <button
                    onClick={() => {
                      setActiveTab("boilerplate");
                      if (conn.id === "jupyter") setBoilerplateTab("jupyter_vscode");
                      if (conn.id === "airflow") setBoilerplateTab("airflow");
                      if (conn.id === "prefect") setBoilerplateTab("prefect");
                      if (conn.id === "dbt") setBoilerplateTab("dbt");
                      if (conn.id === "mlflow") setBoilerplateTab("mlflow");
                    }}
                    className="text-xs font-semibold text-[#0061FE] hover:underline flex items-center gap-1"
                  >
                    <span>View Boilerplate</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                  <span className="text-[10px] font-mono text-[#8C827A]">Pillar 12.0</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Code Boilerplate Generator */}
      {activeTab === "boilerplate" && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E8E4DF] shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#1E1915] flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#0061FE]" />
                <span>Zero-Copy Integration Boilerplate</span>
              </h2>
              <p className="text-xs text-[#5C554D]">
                Generate battle-tested boilerplate code to load and query Strata datasets directly within your data stack.
              </p>
            </div>

            {/* Dataset & Version Selectors */}
            <div className="flex items-center gap-2">
              <select
                value={selectedDataset}
                onChange={(e) => setSelectedDataset(e.target.value)}
                className="px-3 py-1.5 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] font-semibold"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.filename || d.name}>
                    {d.name || d.filename}
                  </option>
                ))}
                {datasets.length === 0 && <option value="demo_dataset.csv">demo_dataset.csv</option>}
              </select>
              <select
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(e.target.value)}
                className="px-3 py-1.5 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] font-mono"
              >
                <option value="main">main (v1.0.0)</option>
                <option value="v1.1.0">v1.1.0</option>
                <option value="v1.2.0">v1.2.0</option>
              </select>
            </div>
          </div>

          {/* Boilerplate Framework Sub-tabs */}
          <div className="flex items-center gap-2 border-b border-[#E8E4DF] pb-2 overflow-x-auto">
            {[
              { id: "jupyter_vscode", label: "JupyterLab / VS Code (Python)", icon: <Terminal className="w-3.5 h-3.5" /> },
              { id: "airflow", label: "Apache Airflow DAG", icon: <Cpu className="w-3.5 h-3.5" /> },
              { id: "prefect", label: "Prefect 2.0 Flow", icon: <Zap className="w-3.5 h-3.5" /> },
              { id: "dbt", label: "dbt Staging Model SQL", icon: <Layers className="w-3.5 h-3.5" /> },
              { id: "mlflow", label: "MLflow Lineage Logger", icon: <Sparkles className="w-3.5 h-3.5" /> },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setBoilerplateTab(t.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  boilerplateTab === t.id
                    ? "bg-[#0061FE] text-white shadow-xs"
                    : "bg-[#FAF8F5] text-[#5C554D] hover:text-[#1E1915]"
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Code Viewer Panel */}
          <div className="relative rounded-2xl bg-[#1E1915] text-[#FAF8F5] p-5 font-mono text-xs overflow-x-auto shadow-inner">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#3A332C]">
              <div className="flex items-center gap-2 text-[#8C827A]">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
                <span className="text-[11px] ml-2 font-mono">
                  {boilerplateTab === "dbt" ? "models/staging/stg_strata.sql" : "strata_integration_script.py"}
                </span>
              </div>
              <button
                onClick={() => handleCopyCode(codeTemplates[boilerplateTab] || "# Loading...", boilerplateTab)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[#2B241E] hover:bg-[#3A332C] text-white border border-[#4A423A] transition-all"
              >
                {copiedKey === boilerplateTab ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-[#8C827A]" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
            <pre className="text-emerald-400 font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre">
              {codeTemplates[boilerplateTab] || "# Loading code templates..."}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 3: Webhooks & Live Alerts */}
      {activeTab === "webhooks" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#1E1915]">Registered Webhook Endpoints</h2>
              <p className="text-xs text-[#5C554D]">
                Automatically dispatch high-priority notifications to Slack, Discord, Microsoft Teams, or custom HTTP endpoints.
              </p>
            </div>
            <button
              onClick={() => setIsAddWebhookOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#0061FE] text-white hover:bg-[#0052D4] transition-all shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Webhook</span>
            </button>
          </div>

          {/* Add Webhook Modal / Form */}
          {isAddWebhookOpen && (
            <div className="bg-white p-6 rounded-2xl border border-[#0061FE] shadow-md space-y-4 animate-in fade-in">
              <h3 className="text-sm font-bold text-[#1E1915]">Register New Outgoing Webhook</h3>
              <form onSubmit={handleCreateWebhook} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1E1915]">Service Platform</label>
                    <select
                      value={newWhService}
                      onChange={(e) => setNewWhService(e.target.value as any)}
                      className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915]"
                    >
                      <option value="slack">Slack Incoming Webhook</option>
                      <option value="discord">Discord Webhook</option>
                      <option value="teams">Microsoft Teams MessageCard</option>
                      <option value="generic">Custom Generic Webhook</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1E1915]">Webhook Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Data Ops Incident Channel"
                      value={newWhName}
                      onChange={(e) => setNewWhName(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#1E1915]">Webhook Destination URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://hooks.slack.com/services/..."
                    value={newWhUrl}
                    onChange={(e) => setNewWhUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddWebhookOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#FAF8F5] text-[#5C554D] hover:bg-[#F7F5F2]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0061FE] text-white hover:bg-[#0052D4]"
                  >
                    Save Webhook
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Webhook List */}
          <div className="bg-white rounded-2xl border border-[#E8E4DF] divide-y divide-[#E8E4DF] overflow-hidden">
            {(statusData?.webhooks || []).map((wh) => (
              <div key={wh.id} className="p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#1E1915]">{wh.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {wh.service.toUpperCase()}
                    </span>
                    {wh.is_active ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-gray-100 text-gray-600">
                        Paused
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-[#8C827A] truncate max-w-md">{wh.url}</p>
                  <div className="flex items-center gap-1.5 pt-1">
                    {wh.events.map((evt: string) => (
                      <span
                        key={evt}
                        className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-[#FAF8F5] text-[#5C554D] border border-[#E8E4DF]"
                      >
                        {evt}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteWebhook(wh.id)}
                    className="p-2 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                    title="Delete Webhook"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Live Alert Test Dispatcher */}
          <div className="bg-white p-6 rounded-2xl border border-[#E8E4DF] shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#1E1915] flex items-center gap-2">
              <Send className="w-4 h-4 text-[#0061FE]" />
              <span>Dispatch Realtime Test Alert</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1E1915]">Target Platform</label>
                <select
                  value={testWhService}
                  onChange={(e) => setTestWhService(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915]"
                >
                  <option value="slack">Slack</option>
                  <option value="discord">Discord</option>
                  <option value="teams">Microsoft Teams</option>
                  <option value="generic">Generic Webhook</option>
                </select>
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-[#1E1915]">Alert Message</label>
                <input
                  type="text"
                  value={testWhMessage}
                  onChange={(e) => setTestWhMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {testAlertResult ? (
                <div className="text-xs text-emerald-700 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{testAlertResult.message}</span>
                </div>
              ) : <div />}
              <button
                onClick={handleSendTestWebhook}
                disabled={isSendingTest}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#0061FE] hover:bg-[#0052D4] text-white transition-all shadow-xs disabled:opacity-50"
              >
                {isSendingTest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Send Real Alert</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: MLflow Tracking & Lineage Sync */}
      {activeTab === "mlflow" && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E8E4DF] shadow-xs space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#1E1915] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-600" />
              <span>MLflow Experiment Tracking & Lineage Sync</span>
            </h2>
            <p className="text-xs text-[#5C554D]">
              Synchronize model hyperparameters, metrics, and dataset snapshot version hashes with a remote MLflow Tracking Server.
            </p>
          </div>

          <form onSubmit={handleSyncMLflow} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1E1915]">MLflow Tracking URI</label>
                <input
                  type="url"
                  required
                  value={mlflowUri}
                  onChange={(e) => setMlflowUri(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1E1915]">Experiment Name</label>
                <input
                  type="text"
                  required
                  value={mlflowExpName}
                  onChange={(e) => setMlflowExpName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1E1915]">Model Name</label>
                <input
                  type="text"
                  required
                  value={mlflowModelName}
                  onChange={(e) => setMlflowModelName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1E1915]">Dataset Name</label>
                <input
                  type="text"
                  required
                  value={mlflowDatasetName}
                  onChange={(e) => setMlflowDatasetName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1E1915]">Commit / Version Hash</label>
                <input
                  type="text"
                  required
                  value={mlflowVersionHash}
                  onChange={(e) => setMlflowVersionHash(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#1E1915] flex items-center justify-between">
                <span>Model Metrics (key: value per line)</span>
                <span className="text-[10px] text-[#8C827A]">Logged to MLflow run</span>
              </label>
              <textarea
                rows={3}
                value={mlflowMetrics}
                onChange={(e) => setMlflowMetrics(e.target.value)}
                className="w-full p-3 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] font-mono"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              {mlflowSyncResult && (
                <div className="text-xs text-emerald-700 font-mono">
                  Synced! Run ID: <span className="font-bold">{mlflowSyncResult.run_id}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={isSyncingMlflow}
                className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#0061FE] hover:bg-[#0052D4] text-white transition-all shadow-sm disabled:opacity-50"
              >
                {isSyncingMlflow ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Sync with MLflow</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 5: Database & Cloud Storage Connections Vault */}
      {activeTab === "databases" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#1E1915]">Saved Database Connection Profiles</h2>
              <p className="text-xs text-[#5C554D]">
                Stored warehouse credentials for scheduled pipelines, ETL tasks, and live table extractions.
              </p>
            </div>
            <button
              onClick={() => setIsAddDbOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#0061FE] text-white hover:bg-[#0052D4] transition-all shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Connection</span>
            </button>
          </div>

          {/* Add Connection Profile Modal */}
          {isAddDbOpen && (
            <div className="bg-white p-6 rounded-2xl border border-[#0061FE] shadow-md space-y-4 animate-in fade-in">
              <h3 className="text-sm font-bold text-[#1E1915]">Add Connection Profile to Vault</h3>
              <form onSubmit={handleSaveDbConnection} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1E1915]">Profile Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Analytics Postgres Read Replica"
                      value={newDbName}
                      onChange={(e) => setNewDbName(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1E1915]">Engine Type</label>
                    <select
                      value={newDbType}
                      onChange={(e) => setNewDbType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915]"
                    >
                      <option value="postgres">PostgreSQL</option>
                      <option value="snowflake">Snowflake</option>
                      <option value="bigquery">Google BigQuery</option>
                      <option value="clickhouse">ClickHouse</option>
                      <option value="sqlite">SQLite</option>
                      <option value="s3">AWS S3 Lakehouse</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1E1915]">Host</label>
                    <input
                      type="text"
                      placeholder="postgres.data-infra.internal"
                      value={newDbHost}
                      onChange={(e) => setNewDbHost(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1E1915]">Port</label>
                    <input
                      type="text"
                      placeholder="5432"
                      value={newDbPort}
                      onChange={(e) => setNewDbPort(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1E1915]">Database Name</label>
                    <input
                      type="text"
                      placeholder="production_analytics"
                      value={newDbDatabase}
                      onChange={(e) => setNewDbDatabase(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1E1915]">Username</label>
                    <input
                      type="text"
                      placeholder="strata_readonly"
                      value={newDbUsername}
                      onChange={(e) => setNewDbUsername(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1E1915]">Password / Secret Key</label>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={newDbPassword}
                      onChange={(e) => setNewDbPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddDbOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#FAF8F5] text-[#5C554D] hover:bg-[#F7F5F2]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0061FE] text-white hover:bg-[#0052D4]"
                  >
                    Save Profile
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Connections List */}
          <div className="bg-white rounded-2xl border border-[#E8E4DF] divide-y divide-[#E8E4DF] overflow-hidden">
            {dbConnections.map((conn) => {
              const testRes = connTestResults[conn.id];
              return (
                <div key={conn.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-purple-600" />
                      <span className="font-bold text-sm text-[#1E1915]">{conn.name}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                        {conn.db_type}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {conn.status}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-[#8C827A]">
                      {conn.host || "localhost"}:{conn.port || 5432} / {conn.database || "default"} ({conn.username || "analyst"})
                    </p>
                    {testRes && (
                      <div className="pt-1 text-[11px] text-emerald-700 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{testRes.message} ({testRes.latency_ms}ms)</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestSavedConnection(conn)}
                      disabled={testingConnId === conn.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF8F5] border border-[#E8E4DF] text-[#1E1915] hover:border-[#0061FE] transition-all"
                    >
                      {testingConnId === conn.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Zap className="w-3 h-3 text-amber-500" />
                      )}
                      <span>Ping</span>
                    </button>
                    <button
                      onClick={() => handleDeleteDbConnection(conn.id)}
                      className="p-2 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                      title="Delete Connection"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
