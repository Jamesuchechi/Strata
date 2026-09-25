"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Upload,
  Database,
  Code2,
  Sparkles,
  GitBranch,
  ArrowRight,
  Plus,
  Zap,
  HardDrive,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingUp,
  Atom,
  MapPin,
  FileText,
} from "lucide-react";
import { fetchDatasets, fetchCommits, getStoredUser } from "@/lib/api";
import { DatasetItem } from "@/lib/types";

export default function DashboardOverviewPage() {
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [commits, setCommits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<ReturnType<typeof getStoredUser>>(null);

  useEffect(() => {
    setUser(getStoredUser());
    Promise.all([
      fetchDatasets().catch((err) => {
        console.error("Failed to fetch datasets in overview:", err);
        return [] as DatasetItem[];
      }),
      fetchCommits().catch((err) => {
        console.error("Failed to fetch commits in overview:", err);
        return [] as any[];
      }),
    ])
      .then(([ds, cm]) => {
        setDatasets(ds);
        setCommits(cm);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const totalRows = datasets.reduce((acc, d) => acc + (d.total_rows || 0), 0);
  const totalBytes = datasets.reduce((acc, d) => acc + (d.size_bytes || 0), 0);

  const formatSize = (bytes: number) => {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFormatIcon = (format: string) => {
    switch (format.toLowerCase()) {
      case "excel":
        return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
      case "parquet":
        return <Database className="w-4 h-4 text-[#0061FE]" />;
      case "sdf":
        return <Atom className="w-4 h-4 text-purple-600" />;
      case "geojson":
        return <MapPin className="w-4 h-4 text-rose-600" />;
      default:
        return <FileText className="w-4 h-4 text-blue-600" />;
    }
  };

  const quickLinks = [
    {
      title: "Upload & Ingest",
      desc: "Drag & drop CSV, Excel, Parquet, SDF, or GeoJSON with instant schema indexing.",
      href: "/upload",
      icon: <Upload className="w-5 h-5 text-[#0061FE]" />,
      badge: "Ingestion Studio",
      color: "border-[#0061FE]/20 hover:border-[#0061FE]",
    },
    {
      title: "Datasets Lakehouse",
      desc: "Explore table schemas, virtual rows, quality scores, and micro-stat sparklines.",
      href: "/datasets",
      icon: <Database className="w-5 h-5 text-emerald-600" />,
      badge: `${datasets.length} Tables Active`,
      color: "border-emerald-200 hover:border-emerald-500",
    },
    {
      title: "DuckDB SQL Studio",
      desc: "Run sub-second analytical queries against zero-copy in-memory Arrow buffers.",
      href: "/query",
      icon: <Code2 className="w-5 h-5 text-amber-600" />,
      badge: "WASM Engine",
      color: "border-amber-200 hover:border-amber-500",
    },
    {
      title: "Conversational AI Analyst",
      desc: "Ask questions in plain English; get verified SQL execution with zero hallucinations.",
      href: "/analyst",
      icon: <Sparkles className="w-5 h-5 text-purple-600" />,
      badge: "AI Grounded",
      color: "border-purple-200 hover:border-purple-500",
    },
  ];

  const realActivity = [
    ...commits.map((c) => ({
      action: `Snapshot Committed (${c.version})`,
      detail: c.message,
      time: c.date,
      icon: <GitBranch className="w-3.5 h-3.5 text-purple-600" />,
      link: "/versions",
    })),
    ...datasets.map((d) => ({
      action: "Dataset Ingested",
      detail: `${d.filename} registered in DuckDB with ${(d.total_rows || 0).toLocaleString()} rows`,
      time: d.created_at ? new Date(d.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Active",
      icon: getFormatIcon(d.format),
      link: `/datasets/${d.id}`,
    })),
  ].slice(0, 6);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Overview Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E4DF] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#8C827A] uppercase tracking-wider mb-1.5">
            <LayoutDashboard className="w-3.5 h-3.5 text-[#0061FE]" />
            <span>Workspace</span>
            <span>/</span>
            <span className="text-[#0061FE] font-bold">Studio Overview</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1E1915]">
            Welcome back{user?.full_name ? `, ${user.full_name}` : ""}
          </h1>
          <p className="text-xs sm:text-sm text-[#5C554D] mt-1 max-w-2xl">
            Here is the current state of your analytical workspace, active DuckDB tables, and version lineage.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href="/upload"
            className="px-4 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold flex items-center gap-2 shadow-sm shadow-[#0061FE]/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload Dataset</span>
          </Link>
          <Link
            href="/query"
            className="px-4 py-2 rounded-xl border border-[#E8E4DF] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 transition-colors"
          >
            <Code2 className="w-3.5 h-3.5 text-[#0061FE]" />
            <span>New SQL Query</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#8C827A]">
            <span>Active Datasets</span>
            <Database className="w-4 h-4 text-[#0061FE]" />
          </div>
          <div className="text-2xl font-serif font-bold text-[#1E1915]">
            {isLoading ? "..." : datasets.length}
          </div>
          <div className="text-[11px] text-[#057A55] font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>All registered in DuckDB</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#8C827A]">
            <span>Cached Virtual Rows</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-serif font-bold text-[#1E1915]">
            {isLoading ? "..." : totalRows.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#736B63] font-mono">
            Zero-copy memory pool
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#8C827A]">
            <span>Vectorized Query Engine</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-serif font-bold text-[#1E1915]">
            &lt; 2ms Latency
          </div>
          <div className="text-[11px] text-[#057A55] font-medium">
            DuckDB 1.5 WASM + API
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#8C827A]">
            <span>Git Version Lineage</span>
            <GitBranch className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-serif font-bold text-[#1E1915]">
            {isLoading ? "..." : (commits[0]?.version ? `main @ ${commits[0].version}` : "main @ clean")}
          </div>
          <div className="text-[11px] text-[#736B63] font-mono">
            {isLoading ? "..." : `${commits.length} immutable snapshot${commits.length === 1 ? "" : "s"}`}
          </div>
        </div>
      </div>

      {/* Quick Jump Action Cards */}
      <div className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-wider text-[#8C827A] font-bold">
          Studio Navigation Hub
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className={`p-5 rounded-2xl bg-white border shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group space-y-3 ${card.color}`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] group-hover:scale-105 transition-transform">
                    {card.icon}
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-[#FAF8F5] border border-[#E8E4DF] text-[#736B63]">
                    {card.badge}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#1E1915] group-hover:text-[#0061FE] transition-colors">
                  {card.title}
                </h3>
                <p className="text-xs text-[#5C554D] leading-relaxed">
                  {card.desc}
                </p>
              </div>

              <div className="flex items-center text-xs font-bold text-[#0061FE] pt-2 border-t border-[#E8E4DF]/60">
                <span>Launch</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Two Column Section: Recent Datasets + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Datasets Table (2 Cols) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#8C827A] font-bold">
              Active Studio Datasets
            </h2>
            <Link
              href="/datasets"
              className="text-xs font-semibold text-[#0061FE] hover:underline flex items-center gap-1"
            >
              <span>View All ({datasets.length})</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="rounded-2xl bg-white border border-[#E8E4DF] overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] border-b border-[#E8E4DF] text-[10px] font-mono uppercase text-[#8C827A]">
                <tr>
                  <th className="py-2.5 px-4">Dataset</th>
                  <th className="py-2.5 px-3">Format</th>
                  <th className="py-2.5 px-3">Rows</th>
                  <th className="py-2.5 px-3">Quality</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4DF]">
                {datasets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-[#8C827A]">
                      No datasets ingested yet.{" "}
                      <Link href="/upload" className="text-[#0061FE] font-semibold hover:underline">
                        Upload your first dataset
                      </Link>
                    </td>
                  </tr>
                ) : (
                  datasets.slice(0, 4).map((ds) => (
                    <tr key={ds.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-[#FAF8F5] border border-[#E8E4DF]">
                            {getFormatIcon(ds.format)}
                          </div>
                          <div>
                            <div className="font-bold text-[#1E1915]">{ds.name}</div>
                            <div className="text-[10px] text-[#8C827A] font-mono">{ds.filename}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono uppercase text-[10px] text-[#736B63]">
                        {ds.format}
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-[#1E1915]">
                        {ds.total_rows.toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        {ds.quality_score ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-200">
                            {ds.quality_score}% Clean
                          </span>
                        ) : (
                          <span className="text-[#8C827A]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/datasets/${ds.id}`}
                          className="px-2.5 py-1 rounded-lg bg-[#0061FE]/10 text-[#0061FE] font-semibold text-xs hover:bg-[#0061FE] hover:text-white transition-all inline-block"
                        >
                          Preview
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity & Timeline (1 Col) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#8C827A] font-bold">
              Recent Studio Activity
            </h2>
            <Link
              href="/versions"
              className="text-xs font-semibold text-[#0061FE] hover:underline flex items-center gap-1"
            >
              <span>Git History</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="rounded-2xl bg-white border border-[#E8E4DF] p-4 shadow-2xs space-y-3">
            {realActivity.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#8C827A]">
                No recent activity recorded yet. Ingest a dataset or run a query.
              </div>
            ) : (
              realActivity.map((act, i) => (
                <Link
                  key={i}
                  href={act.link}
                  className="flex items-start gap-3 text-xs hover:bg-[#FAF8F5] p-1.5 rounded-xl transition-colors block"
                >
                  <div className="p-1.5 rounded-lg bg-[#FAF8F5] border border-[#E8E4DF] shrink-0 mt-0.5">
                    {act.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-[#1E1915]">{act.action}</div>
                    <p className="text-[11px] text-[#5C554D] mt-0.5 leading-snug truncate">{act.detail}</p>
                    <div className="text-[10px] text-[#8C827A] font-mono mt-1">{act.time}</div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
