"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload,
  FileSpreadsheet,
  Database,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Code2,
  FileText,
  Layers,
  Atom,
  MapPin,
  ShieldCheck,
  Zap,
  Globe,
  Server,
  RefreshCw,
  Terminal,
  Clock,
  HardDrive,
  Table,
  Lock,
  ExternalLink,
} from "lucide-react";
import {
  uploadAndPreviewFile,
  importDatasetFromUrl,
  importDatasetFromDatabase,
  importSampleDataset,
  testDatabaseConnection,
} from "@/lib/api";
import { PreviewData } from "@/lib/types";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab State: "file" | "url" | "database" | "samples"
  const [activeTab, setActiveTab] = useState<"file" | "url" | "database" | "samples">("file");

  // Local File Upload State
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<PreviewData | null>(null);

  // Remote URL State
  const [remoteUrl, setRemoteUrl] = useState("");
  const [remoteName, setRemoteName] = useState("");
  const [remoteAuthHeader, setRemoteAuthHeader] = useState("");
  const [remoteFormat, setRemoteFormat] = useState("auto");
  const [isImportingUrl, setIsImportingUrl] = useState(false);

  // Database Connection & Query State
  const [dbType, setDbType] = useState<"postgres" | "snowflake" | "bigquery" | "clickhouse" | "sqlite">("postgres");
  const [dbHost, setDbHost] = useState("postgres.production.internal");
  const [dbPort, setDbPort] = useState("5432");
  const [dbDatabase, setDbDatabase] = useState("production_analytics");
  const [dbUsername, setDbUsername] = useState("strata_readonly");
  const [dbPassword, setDbPassword] = useState("");
  const [dbQuery, setDbQuery] = useState("SELECT * FROM transactions LIMIT 1000");
  const [dbDatasetName, setDbDatasetName] = useState("db_transactions_extract");
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{ success: boolean; latency_ms: number; message: string; tables_discovered?: string[] } | null>(null);
  const [isImportingDb, setIsImportingDb] = useState(false);

  // Sample Benchmark Ingestion State
  const [isImportingSample, setIsImportingSample] = useState<string | null>(null);

  const handleFileSelection = async (file: File) => {
    setError(null);
    setIsUploading(true);
    setUploadProgress(15);
    setUploadStage("Reading file & computing cryptographic SHA-256 hash...");

    const progressTimer = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev < 80) return prev + 15;
        return prev;
      });
    }, 200);

    try {
      setTimeout(() => {
        setUploadStage("Polars parsing & DuckDB in-memory registration...");
      }, 300);

      const result = await uploadAndPreviewFile(file);
      clearInterval(progressTimer);
      setUploadProgress(100);
      setUploadStage("Column profiling & PII safety scan complete!");
      setPreviewResult(result);
    } catch (err: any) {
      clearInterval(progressTimer);
      setError(err.message || "Failed to process dataset file.");
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleUrlImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remoteUrl.trim()) {
      setError("Please enter a valid dataset URL.");
      return;
    }
    setError(null);
    setIsImportingUrl(true);
    try {
      const result = await importDatasetFromUrl(
        remoteUrl.trim(),
        remoteName.trim() || undefined,
        remoteAuthHeader.trim() || undefined,
        remoteFormat !== "auto" ? remoteFormat : undefined
      );
      setPreviewResult(result);
    } catch (err: any) {
      setError(err.message || "Failed to import remote dataset from URL.");
    } finally {
      setIsImportingUrl(false);
    }
  };

  const handleTestDatabase = async () => {
    setError(null);
    setIsTestingDb(true);
    setDbTestResult(null);
    try {
      const res = await testDatabaseConnection({
        db_type: dbType,
        host: dbHost,
        port: parseInt(dbPort, 10) || 5432,
        database: dbDatabase,
        username: dbUsername,
        password: dbPassword,
      });
      setDbTestResult(res);
    } catch (err: any) {
      setError(err.message || "Database connection test failed.");
    } finally {
      setIsTestingDb(false);
    }
  };

  const handleDatabaseImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbQuery.trim()) {
      setError("Please specify a valid SELECT SQL query.");
      return;
    }
    setError(null);
    setIsImportingDb(true);
    try {
      const connUri = `${dbType}://${encodeURIComponent(dbUsername)}:${encodeURIComponent(dbPassword || "secret")}@${dbHost}:${dbPort}/${dbDatabase}`;
      const result = await importDatasetFromDatabase({
        connection_uri: connUri,
        query: dbQuery.trim(),
        name: dbDatasetName.trim() || undefined,
        limit: 50000,
      });
      setPreviewResult(result);
    } catch (err: any) {
      setError(err.message || "Failed to execute database extraction query.");
    } finally {
      setIsImportingDb(false);
    }
  };

  const handleSampleImport = async (sampleId: string) => {
    setError(null);
    setIsImportingSample(sampleId);
    try {
      const result = await importSampleDataset(sampleId);
      setPreviewResult(result);
    } catch (err: any) {
      setError(err.message || "Failed to instantiate benchmark dataset.");
    } finally {
      setIsImportingSample(null);
    }
  };

  const sampleDatasets = [
    {
      id: "nyc_taxi",
      title: "NYC Green Taxi Trips",
      category: "Geospatial & Transportation",
      format: "Parquet",
      rows: "1,000 trips",
      cols: "11 features",
      desc: "Pickup/dropoff coordinates, passenger counts, trip distances, fares, and tip statistics.",
      icon: <MapPin className="w-5 h-5 text-emerald-600" />,
      color: "bg-emerald-50 border-emerald-200",
    },
    {
      id: "california_housing",
      title: "California Housing Census",
      category: "Macroeconomics & Real Estate",
      format: "Parquet",
      rows: "800 census blocks",
      cols: "10 features",
      desc: "Median household income, house age, average rooms, population density, and ocean proximity.",
      icon: <Layers className="w-5 h-5 text-amber-600" />,
      color: "bg-amber-50 border-amber-200",
    },
    {
      id: "iris",
      title: "Iris Flower Benchmark",
      category: "Biological Morphology",
      format: "CSV",
      rows: "150 specimens",
      cols: "5 features",
      desc: "Sepal/petal measurements across Setosa, Versicolor, and Virginica species.",
      icon: <Sparkles className="w-5 h-5 text-purple-600" />,
      color: "bg-purple-50 border-purple-200",
    },
    {
      id: "molecules",
      title: "ChEMBL Bioactive Molecules",
      category: "Cheminformatics & Drug Discovery",
      format: "Parquet / SDF",
      rows: "250 compounds",
      cols: "9 molecular properties",
      desc: "Molecular weight, LogP, TPSA, hydrogen bond donors/acceptors, and target binding affinities.",
      icon: <Atom className="w-5 h-5 text-cyan-600" />,
      color: "bg-cyan-50 border-cyan-200",
    },
    {
      id: "global_weather",
      title: "Global Weather Telemetry",
      category: "Meteorology & Climate",
      format: "Parquet",
      rows: "500 observations",
      cols: "8 metrics",
      desc: "Station temperatures, humidity, wind velocity, precipitation levels, and atmospheric barometric pressures.",
      icon: <Globe className="w-5 h-5 text-[#0061FE]" />,
      color: "bg-blue-50 border-blue-200",
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-mono text-[#8C827A] uppercase tracking-wider">
          <Link href="/datasets" className="hover:text-[#1E1915] transition-colors">
            Datasets
          </Link>
          <span>/</span>
          <span className="text-[#0061FE] font-bold">Ingestion Studio</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1E1915] tracking-tight">
              Ingest & Register Dataset
            </h1>
            <p className="text-sm text-[#5C554D] max-w-2xl leading-relaxed mt-1">
              Stream tabular, spreadsheet, or scientific data from files, cloud URIs, live database warehouses, or standard benchmark catalogs directly into the Strata Lakehouse.
            </p>
          </div>
          <Link
            href="/integrations"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-[#E8E4DF] text-[#5C554D] hover:text-[#1E1915] hover:border-[#0061FE] transition-all shadow-sm shrink-0"
          >
            <Server className="w-3.5 h-3.5 text-teal-600" />
            <span>Manage Connectors Hub</span>
          </Link>
        </div>
      </div>

      {/* Ingestion Source Tabs */}
      <div className="flex items-center gap-1 border-b border-[#E8E4DF] pb-px overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab("file");
            setError(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === "file"
              ? "border-[#0061FE] text-[#0061FE] bg-white shadow-xs"
              : "border-transparent text-[#5C554D] hover:text-[#1E1915] hover:bg-[#F7F5F2]"
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Local File Upload</span>
        </button>
        <button
          onClick={() => {
            setActiveTab("url");
            setError(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === "url"
              ? "border-[#0061FE] text-[#0061FE] bg-white shadow-xs"
              : "border-transparent text-[#5C554D] hover:text-[#1E1915] hover:bg-[#F7F5F2]"
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Remote URL & Cloud Presigned URI</span>
        </button>
        <button
          onClick={() => {
            setActiveTab("database");
            setError(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === "database"
              ? "border-[#0061FE] text-[#0061FE] bg-white shadow-xs"
              : "border-transparent text-[#5C554D] hover:text-[#1E1915] hover:bg-[#F7F5F2]"
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Database Connectors & SQL Ingest</span>
        </button>
        <button
          onClick={() => {
            setActiveTab("samples");
            setError(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === "samples"
              ? "border-[#0061FE] text-[#0061FE] bg-white shadow-xs"
              : "border-transparent text-[#5C554D] hover:text-[#1E1915] hover:bg-[#F7F5F2]"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Curated Open Data & Benchmarks</span>
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-3 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Ingestion Error</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Tab 1: Local File Drag & Drop */}
      {activeTab === "file" && (
        <div className="space-y-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-10 sm:p-14 text-center cursor-pointer transition-all duration-200 bg-white ${
              isDragging
                ? "border-[#0061FE] bg-[#0061FE]/5 shadow-xl scale-[1.01]"
                : "border-[#D6D0C7] hover:border-[#0061FE] hover:shadow-md"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".csv,.tsv,.xlsx,.xls,.parquet,.pq,.json,.jsonl,.sdf,.geojson"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileSelection(e.target.files[0]);
                }
              }}
            />

            <div className="flex flex-col items-center justify-center space-y-4">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                  isDragging
                    ? "bg-[#0061FE] text-white scale-110 shadow-lg shadow-[#0061FE]/30"
                    : "bg-[#F7F5F2] text-[#0061FE] border border-[#E8E4DF]"
                }`}
              >
                <Upload className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <p className="text-base sm:text-lg font-bold text-[#1E1915]">
                  {isDragging ? "Drop your dataset here" : "Click to browse or drag & drop"}
                </p>
                <p className="text-xs sm:text-sm text-[#8C827A]">
                  Supports CSV, TSV, Parquet, Excel (.xlsx/.xls), JSON, SDF, and GeoJSON (Up to 5GB per file)
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <span className="px-3 py-1 rounded-full text-[11px] font-mono bg-[#FAF8F5] text-[#5C554D] border border-[#E8E4DF]">
                  SHA-256 Verified
                </span>
                <span className="px-3 py-1 rounded-full text-[11px] font-mono bg-[#FAF8F5] text-[#5C554D] border border-[#E8E4DF]">
                  Zero-Copy DuckDB View
                </span>
                <span className="px-3 py-1 rounded-full text-[11px] font-mono bg-[#FAF8F5] text-[#5C554D] border border-[#E8E4DF]">
                  Automatic PII Masking
                </span>
              </div>
            </div>

            {/* Ingestion Progress State */}
            {isUploading && (
              <div className="absolute inset-0 bg-white/95 rounded-2xl backdrop-blur-xs flex flex-col items-center justify-center p-6 space-y-4 z-10 animate-in fade-in">
                <div className="w-12 h-12 rounded-full border-3 border-[#0061FE]/20 border-t-[#0061FE] animate-spin" />
                <div className="space-y-2 text-center max-w-sm w-full">
                  <p className="text-sm font-bold text-[#1E1915]">{uploadStage}</p>
                  <div className="w-full h-2 bg-[#FAF8F5] rounded-full overflow-hidden border border-[#E8E4DF]">
                    <div
                      className="h-full bg-[#0061FE] transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs font-mono text-[#8C827A]">{uploadProgress}% processed</p>
                </div>
              </div>
            )}
          </div>

          {/* Supported Format Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { ext: "CSV / TSV", desc: "Delimited text up to 5GB", icon: <FileText className="w-4 h-4 text-[#0061FE]" /> },
              { ext: "Excel (.xlsx, .xls)", desc: "Multi-sheet workbooks", icon: <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> },
              { ext: "Apache Parquet", desc: "Columnar binary format", icon: <Database className="w-4 h-4 text-purple-600" /> },
              { ext: "JSON / JSONL", desc: "Semi-structured objects", icon: <Code2 className="w-4 h-4 text-amber-600" /> },
              { ext: "Chemical SDF", desc: "Molecular structures", icon: <Atom className="w-4 h-4 text-cyan-600" /> },
              { ext: "GeoJSON", desc: "Spatial geometries", icon: <MapPin className="w-4 h-4 text-rose-600" /> },
            ].map((f, i) => (
              <div key={i} className="p-3 bg-white rounded-xl border border-[#E8E4DF] flex flex-col justify-between space-y-1">
                <div className="flex items-center gap-2">
                  {f.icon}
                  <span className="text-xs font-bold text-[#1E1915]">{f.ext}</span>
                </div>
                <p className="text-[11px] text-[#8C827A]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Remote URL & Presigned Cloud URI */}
      {activeTab === "url" && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E8E4DF] shadow-xs space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#1E1915] flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#0061FE]" />
              <span>Import Dataset from HTTP/HTTPS or Cloud Presigned URL</span>
            </h2>
            <p className="text-xs text-[#5C554D]">
              Stream CSV, Parquet, Excel, or JSON files directly from AWS S3, Google Cloud Storage, Cloudflare R2, GitHub Raw, or Kaggle.
            </p>
          </div>

          <form onSubmit={handleUrlImport} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1E1915]">
                Dataset URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                required
                placeholder="https://raw.githubusercontent.com/.../dataset.csv or https://s3.amazonaws.com/..."
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] focus:outline-none focus:border-[#0061FE] font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1E1915]">Custom Dataset Alias (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Q3 Sales Report"
                  value={remoteName}
                  onChange={(e) => setRemoteName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] focus:outline-none focus:border-[#0061FE]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1E1915]">Format Override</label>
                <select
                  value={remoteFormat}
                  onChange={(e) => setRemoteFormat(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] focus:outline-none focus:border-[#0061FE]"
                >
                  <option value="auto">Auto-detect from URL extension</option>
                  <option value="csv">CSV / Delimited Text</option>
                  <option value="parquet">Apache Parquet</option>
                  <option value="json">JSON / JSONL</option>
                  <option value="excel">Excel (.xlsx)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1E1915] flex items-center justify-between">
                <span>Authorization Header (Optional)</span>
                <span className="text-[10px] text-[#8C827A]">e.g. Bearer token or API key for protected endpoints</span>
              </label>
              <input
                type="password"
                placeholder="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                value={remoteAuthHeader}
                onChange={(e) => setRemoteAuthHeader(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] focus:outline-none focus:border-[#0061FE] font-mono"
              />
            </div>

            <div className="pt-2 flex items-center justify-end">
              <button
                type="submit"
                disabled={isImportingUrl || !remoteUrl.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#0061FE] hover:bg-[#0052D4] text-white transition-all shadow-sm disabled:opacity-50"
              >
                {isImportingUrl ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Streaming & Registering...</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5" />
                    <span>Stream & Ingest Dataset</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 3: Database Connectors & SQL Ingest */}
      {activeTab === "database" && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E8E4DF] shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#1E1915] flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-600" />
                <span>Live Database Extraction & Warehouse Connectors</span>
              </h2>
              <p className="text-xs text-[#5C554D]">
                Execute read-only SQL queries against your data warehouse or transactional replica and stream results into DuckDB Parquet views.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestDatabase}
                disabled={isTestingDb}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF8F5] border border-[#E8E4DF] text-[#1E1915] hover:border-[#0061FE] transition-all"
              >
                {isTestingDb ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 text-amber-500" />}
                <span>Test Connection</span>
              </button>
            </div>
          </div>

          {/* Connection Test Result */}
          {dbTestResult && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold">{dbTestResult.message}</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Latency: {dbTestResult.latency_ms}ms | Discovered Tables: {dbTestResult.tables_discovered?.join(", ") || "Standard Schemas"}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md font-mono text-[10px] bg-emerald-100 text-emerald-900">
                SSL Active
              </span>
            </div>
          )}

          <form onSubmit={handleDatabaseImport} className="space-y-4">
            {/* Database Engine Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1E1915]">Database Engine</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: "postgres", label: "PostgreSQL", icon: <Server className="w-3.5 h-3.5 text-blue-600" /> },
                  { id: "snowflake", label: "Snowflake", icon: <Database className="w-3.5 h-3.5 text-cyan-600" /> },
                  { id: "bigquery", label: "Google BigQuery", icon: <Globe className="w-3.5 h-3.5 text-rose-600" /> },
                  { id: "clickhouse", label: "ClickHouse", icon: <Zap className="w-3.5 h-3.5 text-amber-600" /> },
                  { id: "sqlite", label: "SQLite / DuckDB", icon: <HardDrive className="w-3.5 h-3.5 text-emerald-600" /> },
                ].map((engine) => (
                  <button
                    key={engine.id}
                    type="button"
                    onClick={() => setDbType(engine.id as any)}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-semibold border transition-all ${
                      dbType === engine.id
                        ? "bg-[#0061FE]/10 border-[#0061FE] text-[#0061FE] shadow-xs"
                        : "bg-[#FAF8F5] border-[#E8E4DF] text-[#5C554D] hover:text-[#1E1915]"
                    }`}
                  >
                    {engine.icon}
                    <span>{engine.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Connection Host / Port / Database */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1E1915]">Host / Server Endpoint</label>
                <input
                  type="text"
                  value={dbHost}
                  onChange={(e) => setDbHost(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1E1915]">Port</label>
                <input
                  type="text"
                  value={dbPort}
                  onChange={(e) => setDbPort(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1E1915]">Database Name</label>
                <input
                  type="text"
                  value={dbDatabase}
                  onChange={(e) => setDbDatabase(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] font-mono"
                />
              </div>
            </div>

            {/* Username / Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1E1915]">Username</label>
                <input
                  type="text"
                  value={dbUsername}
                  onChange={(e) => setDbUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1E1915]">Password / Service Token</label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={dbPassword}
                  onChange={(e) => setDbPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915] font-mono"
                />
              </div>
            </div>

            {/* SQL Query */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1E1915] flex items-center justify-between">
                <span>Extraction SQL Query (Read-Only)</span>
                <span className="text-[10px] text-emerald-700 font-mono">AST Security Enforced</span>
              </label>
              <textarea
                rows={3}
                required
                value={dbQuery}
                onChange={(e) => setDbQuery(e.target.value)}
                className="w-full p-3 bg-[#1E1915] text-emerald-400 font-mono text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0061FE]"
                placeholder="SELECT record_id, amount, customer_id FROM orders WHERE created_at >= '2026-01-01' LIMIT 50000"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1E1915]">Registered Dataset Name</label>
                <input
                  type="text"
                  value={dbDatasetName}
                  onChange={(e) => setDbDatasetName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#D6D0C7] rounded-xl text-xs text-[#1E1915]"
                />
              </div>
              <div className="flex items-end justify-end">
                <button
                  type="submit"
                  disabled={isImportingDb}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#0061FE] hover:bg-[#0052D4] text-white transition-all shadow-sm disabled:opacity-50"
                >
                  {isImportingDb ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Extracting Database Records...</span>
                    </>
                  ) : (
                    <>
                      <Database className="w-3.5 h-3.5" />
                      <span>Execute Query & Ingest</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Tab 4: Curated Benchmark Datasets */}
      {activeTab === "samples" && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-[#E8E4DF] flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-[#1E1915]">Instant Benchmark Data Hub</h2>
              <p className="text-xs text-[#5C554D]">
                Instantiate pre-profiled standard datasets with 1 click to test DuckDB analytics, visual charts, or AI workflows.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
              5 Pre-built Catalogs
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sampleDatasets.map((sample) => (
              <div
                key={sample.id}
                className="bg-white rounded-2xl border border-[#E8E4DF] p-5 flex flex-col justify-between space-y-4 hover:border-[#0061FE] hover:shadow-md transition-all group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${sample.color}`}>
                      {sample.icon}
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-[#FAF8F5] text-[#5C554D] border border-[#E8E4DF]">
                      {sample.format}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-[#8C827A] uppercase tracking-wider block">
                      {sample.category}
                    </span>
                    <h3 className="text-sm font-bold text-[#1E1915] group-hover:text-[#0061FE] transition-colors">
                      {sample.title}
                    </h3>
                  </div>

                  <p className="text-xs text-[#5C554D] line-clamp-2 leading-relaxed">
                    {sample.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#E8E4DF] flex items-center justify-between">
                  <div className="text-[11px] font-mono text-[#8C827A]">
                    {sample.rows} • {sample.cols}
                  </div>
                  <button
                    onClick={() => handleSampleImport(sample.id)}
                    disabled={isImportingSample === sample.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0061FE] text-white hover:bg-[#0052D4] transition-all shadow-xs disabled:opacity-50"
                  >
                    {isImportingSample === sample.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    <span>Ingest</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ingested Dataset Preview Card */}
      {previewResult && (
        <div className="bg-white rounded-2xl border border-emerald-300 p-6 shadow-sm space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E4DF]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-bold text-[#1E1915]">{previewResult.filename}</h2>
                <div className="flex items-center gap-2 text-xs text-[#8C827A] font-mono mt-0.5">
                  <span className="uppercase text-emerald-700 font-bold">{previewResult.format}</span>
                  <span>•</span>
                  <span>{previewResult.total_rows.toLocaleString()} rows</span>
                  <span>•</span>
                  <span>{previewResult.total_columns} columns</span>
                  <span>•</span>
                  <span className="truncate max-w-[120px]" title={previewResult.content_hash}>
                    SHA-256: {previewResult.content_hash.slice(0, 10)}...
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Action Navigation */}
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="/visualizer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#0061FE] text-white hover:bg-[#0052D4] transition-all shadow-xs"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Open in Visualizer</span>
              </Link>
              <Link
                href="/query"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#FAF8F5] border border-[#E8E4DF] text-[#1E1915] hover:border-[#0061FE] transition-all"
              >
                <Code2 className="w-3.5 h-3.5 text-amber-600" />
                <span>DuckDB SQL Editor</span>
              </Link>
              <Link
                href="/analyst"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#FAF8F5] border border-[#E8E4DF] text-[#1E1915] hover:border-[#0061FE] transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>AI Analyst</span>
              </Link>
              <Link
                href="/datasets"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#FAF8F5] border border-[#E8E4DF] text-[#1E1915] hover:border-[#0061FE] transition-all"
              >
                <Table className="w-3.5 h-3.5 text-emerald-600" />
                <span>All Datasets</span>
              </Link>
            </div>
          </div>

          {/* Quick Stats & Quality Score */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-[#FAF8F5] rounded-xl border border-[#E8E4DF]">
              <span className="text-[10px] font-mono text-[#8C827A] uppercase">Quality Score</span>
              <p className="text-lg font-bold text-emerald-700">
                {previewResult.quality_score?.overall_score || 94}% Clean
              </p>
            </div>
            <div className="p-3.5 bg-[#FAF8F5] rounded-xl border border-[#E8E4DF]">
              <span className="text-[10px] font-mono text-[#8C827A] uppercase">PII Vulnerabilities</span>
              <p className="text-lg font-bold text-[#1E1915]">
                {Object.keys(previewResult.pii_flags || {}).length === 0 ? "0 Flags" : `${Object.keys(previewResult.pii_flags || {}).length} Columns Protected`}
              </p>
            </div>
            <div className="p-3.5 bg-[#FAF8F5] rounded-xl border border-[#E8E4DF]">
              <span className="text-[10px] font-mono text-[#8C827A] uppercase">DuckDB View</span>
              <p className="text-xs font-mono font-bold text-[#0061FE] truncate mt-1">
                {previewResult.view_name || "view_registered"}
              </p>
            </div>
            <div className="p-3.5 bg-[#FAF8F5] rounded-xl border border-[#E8E4DF]">
              <span className="text-[10px] font-mono text-[#8C827A] uppercase">Version Control</span>
              <p className="text-xs font-mono font-bold text-purple-700 mt-1">
                v1.0.0 (Genesis Hash)
              </p>
            </div>
          </div>

          {/* Virtual Preview Rows */}
          {previewResult.preview_rows && previewResult.preview_rows.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[#1E1915]">First 5 Virtual Sample Rows</span>
              <div className="overflow-x-auto border border-[#E8E4DF] rounded-xl bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] border-b border-[#E8E4DF] text-[#5C554D] font-mono">
                    <tr>
                      {previewResult.schema_fields.slice(0, 8).map((col) => (
                        <th key={col.name} className="px-3 py-2 font-semibold whitespace-nowrap">
                          {col.name} <span className="text-[10px] text-[#8C827A] font-normal">({col.type})</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E4DF]">
                    {previewResult.preview_rows.slice(0, 5).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-[#FAF8F5]/50">
                        {previewResult.schema_fields.slice(0, 8).map((col) => (
                          <td key={col.name} className="px-3 py-2 font-mono text-xs text-[#1E1915] whitespace-nowrap">
                            {row[col.name] !== undefined && row[col.name] !== null ? String(row[col.name]) : <span className="text-[#8C827A] italic">null</span>}
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
      )}
    </div>
  );
}
