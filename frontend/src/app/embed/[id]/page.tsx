"use client";

import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Database,
  ExternalLink,
  ShieldCheck,
  Table,
  Layers,
  Sparkles,
  GitFork,
} from "lucide-react";
import { fetchShowcaseDataset } from "@/lib/api";
import { ShowcaseDataset } from "@/lib/types";
import { StrataMark } from "@/components/brand/StrataLogo";

export default function EmbedDatasetPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const datasetId = params.id as string;
  const theme = searchParams.get("theme") || "light";
  const showSchema = searchParams.get("schema") !== "false";

  const [dataset, setDataset] = useState<ShowcaseDataset | null>(null);
  const [activeTab, setActiveTab] = useState<"data" | "schema">("data");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!datasetId) return;
    setIsLoading(true);
    fetchShowcaseDataset(datasetId)
      .then((data) => setDataset(data.dataset))
      .catch((err) => console.error("Failed to load embedded dataset:", err))
      .finally(() => setIsLoading(false));
  }, [datasetId]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#FAF8F5] text-xs text-[#8C827A] space-y-2 font-sans">
        <div className="w-6 h-6 border-2 border-[#0061FE] border-t-transparent rounded-full animate-spin" />
        <p>Loading Strata Live Preview...</p>
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#FAF8F5] text-xs text-[#8C827A] font-sans">
        Dataset not found or embed expired.
      </div>
    );
  }

  const isDark = theme === "dark";

  return (
    <div
      className={`h-screen w-screen flex flex-col font-sans select-none overflow-hidden text-xs ${
        isDark ? "bg-[#1E1915] text-[#FAF8F5]" : "bg-white text-[#1E1915]"
      }`}
    >
      {/* Top Header Bar */}
      <div
        className={`px-4 py-2.5 flex items-center justify-between border-b ${
          isDark ? "bg-[#25201C] border-white/10" : "bg-[#FAF8F5] border-[#E8E4DF]"
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-5 h-5 rounded bg-[#0061FE] flex items-center justify-center text-white font-bold text-[10px]">
            S
          </div>
          <div className="truncate">
            <h1 className="font-bold truncate text-xs">{dataset.title}</h1>
            <p className={`text-[10px] truncate ${isDark ? "text-white/60" : "text-[#6F675F]"}`}>
              By {dataset.author} • {dataset.total_rows.toLocaleString()} rows • License: {dataset.license}
            </p>
          </div>
        </div>

        {/* Tab Switcher & Outlink */}
        <div className="flex items-center gap-2 shrink-0">
          {showSchema && (
            <div
              className={`flex items-center rounded-lg p-0.5 border ${
                isDark ? "bg-white/5 border-white/10" : "bg-white border-[#E8E4DF]"
              }`}
            >
              <button
                onClick={() => setActiveTab("data")}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                  activeTab === "data"
                    ? "bg-[#0061FE] text-white"
                    : isDark
                    ? "text-white/70"
                    : "text-[#6F675F]"
                }`}
              >
                Data
              </button>
              <button
                onClick={() => setActiveTab("schema")}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                  activeTab === "schema"
                    ? "bg-[#0061FE] text-white"
                    : isDark
                    ? "text-white/70"
                    : "text-[#6F675F]"
                }`}
              >
                Schema
              </button>
            </div>
          )}

          <a
            href={`/showcase`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#0061FE] hover:bg-[#0052D4] text-white font-semibold text-[10px] rounded-lg transition-colors shadow-sm"
          >
            <span>Explore in Strata</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        {activeTab === "data" ? (
          dataset.sample_rows && dataset.sample_rows.length > 0 ? (
            <table className="w-full text-left border-collapse text-[11px] font-mono">
              <thead
                className={`sticky top-0 z-10 border-b ${
                  isDark ? "bg-[#25201C] border-white/10" : "bg-[#FAF8F5] border-[#E8E4DF]"
                }`}
              >
                <tr>
                  {Object.keys(dataset.sample_rows[0]).map((col) => (
                    <th key={col} className="p-2.5 font-semibold whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody
                className={`divide-y ${
                  isDark ? "divide-white/5" : "divide-[#E8E4DF]"
                }`}
              >
                {dataset.sample_rows.map((row, i) => (
                  <tr key={i} className={isDark ? "hover:bg-white/5" : "hover:bg-blue-50/20"}>
                    {Object.values(row).map((val: any, j) => (
                      <td key={j} className="p-2.5 whitespace-nowrap">
                        {typeof val === "boolean" ? (val ? "true" : "false") : String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-xs opacity-60">No sample rows available.</div>
          )
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead
              className={`sticky top-0 z-10 border-b ${
                isDark ? "bg-[#25201C] border-white/10" : "bg-[#FAF8F5] border-[#E8E4DF]"
              }`}
            >
              <tr>
                <th className="p-2.5 font-semibold">Column</th>
                <th className="p-2.5 font-semibold">Type</th>
                <th className="p-2.5 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y ${
                isDark ? "divide-white/5" : "divide-[#E8E4DF]"
              }`}
            >
              {dataset.schema_fields?.map((f) => (
                <tr key={f.name}>
                  <td className="p-2.5 font-mono font-bold">{f.name}</td>
                  <td className="p-2.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#0061FE]/10 text-[#0061FE]">
                      {f.type}
                    </span>
                  </td>
                  <td className="p-2.5 opacity-80">{f.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer Bar */}
      <div
        className={`px-4 py-1.5 border-t flex items-center justify-between text-[10px] ${
          isDark ? "bg-[#25201C] border-white/10 text-white/50" : "bg-[#FAF8F5] border-[#E8E4DF] text-[#8C827A]"
        }`}
      >
        <span className="font-mono">DOI: {dataset.doi || "10.5281/strata"}</span>
        <span className="flex items-center gap-1.5 font-semibold">
          <StrataMark size={14} />
          <span>Powered by <strong className="text-[#0061FE]">Strata</strong> Data Science Studio</span>
        </span>
      </div>
    </div>
  );
}
