"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Layers,
  ShieldCheck,
  Search,
  ArrowUpRight,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { fetchSharedDataset } from "@/lib/api";
import { PreviewData } from "@/lib/types";
import { StrataMark } from "@/components/brand/StrataLogo";

export default function SharedDatasetPreviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchSharedDataset(token);
        setPreviewData(data);
      } catch (err: any) {
        setError(err.message || "Failed to load shared dataset");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [token]);

  const filteredRows = (previewData?.preview_rows || []).filter((row) => {
    if (!searchFilter.trim()) return true;
    return Object.values(row).some((val) =>
      String(val).toLowerCase().includes(searchFilter.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen bg-[#F7F5F2] flex flex-col font-sans">
      {/* Public Read-Only Header */}
      <header className="bg-white border-b border-[#E8E4DF] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StrataMark size={32} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#1E1915]">
                {previewData?.filename || "Shared Dataset Preview"}
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-mono font-bold uppercase">
                Read-Only Preview
              </span>
            </div>
            <p className="text-xs text-[#8C827A] mt-0.5">
              Securely shared snapshot from Strata AI Studio
            </p>
          </div>
        </div>

        <Link
          href="/login"
          className="px-4 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <span>Open in Strata</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col space-y-4">
        {/* Controls Toolbar */}
        <div className="bg-white rounded-2xl border border-[#E8E4DF] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C827A]" />
            <input
              type="text"
              placeholder="Search table values..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] focus:border-[#0061FE] text-xs text-[#1E1915] outline-none"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-[#736B63] font-mono">
            <span>
              Showing <strong>{filteredRows.length}</strong> of{" "}
              <strong>{previewData?.total_rows.toLocaleString() || 0}</strong> rows
            </span>
            <span>·</span>
            <span>
              <strong>{previewData?.total_columns || 0}</strong> columns
            </span>
          </div>
        </div>

        {/* Table Canvas */}
        <div className="flex-1 bg-white rounded-2xl border border-[#E8E4DF] shadow-2xs overflow-auto min-h-[500px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] space-y-3 text-[#736B63]">
              <div className="w-8 h-8 border-2 border-[#0061FE] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-mono">Loading shared snapshot preview...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] space-y-2 text-rose-600 p-6 text-center">
              <p className="font-bold text-sm">Failed to load shared preview</p>
              <p className="text-xs text-[#8C827A]">{error}</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#FAF8F5] border-b border-[#E8E4DF] z-10">
                <tr>
                  <th className="py-2.5 px-3 w-12 font-mono text-[10px] text-[#8C827A] text-center border-r border-[#E8E4DF]">
                    #
                  </th>
                  {previewData?.schema_fields.map((col) => (
                    <th
                      key={col.name}
                      className="py-2.5 px-3 font-semibold text-[#1E1915] border-r border-[#E8E4DF]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{col.name}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white border border-[#E8E4DF] text-[#736B63] uppercase">
                          {col.type}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4DF] font-mono text-[11px]">
                {filteredRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#FAF8F5]/60 transition-colors">
                    <td className="py-2 px-3 text-[#8C827A] text-center bg-[#FAF8F5]/30 border-r border-[#E8E4DF] select-none text-[10px]">
                      {idx + 1}
                    </td>
                    {previewData?.schema_fields.map((col) => {
                      const val = row[col.name];
                      const isNull = val === null || val === undefined;
                      return (
                        <td
                          key={col.name}
                          className={`py-2 px-3 border-r border-[#E8E4DF] truncate max-w-[240px] ${
                            isNull ? "text-[#8C827A] italic" : "text-[#1E1915]"
                          }`}
                        >
                          {isNull ? "null" : String(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
