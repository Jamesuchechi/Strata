"use client";

import React, { useState } from "react";
import { GitCommit, GitPullRequest, GitMerge, Clock, ArrowRight, ShieldCheck, Check, Sparkles } from "lucide-react";

interface DiffCell {
  oldVal: string;
  newVal: string;
  status: "added" | "modified" | "unchanged" | "removed";
}

interface DiffRow {
  key: string;
  fields: Record<string, DiffCell>;
}

const SAMPLE_DIFF_ROWS: DiffRow[] = [
  {
    key: "usr_1001",
    fields: {
      account_id: { oldVal: "usr_1001", newVal: "usr_1001", status: "unchanged" },
      tenure: { oldVal: "12", newVal: "12", status: "unchanged" },
      phone_number: { oldVal: "+1-555-0199", newVal: "[MASKED_PII_SHA]", status: "modified" },
      missing_charges: { oldVal: "NULL", newVal: "64.50 (imputed)", status: "added" },
      status: { oldVal: "trial", newVal: "active_pro", status: "modified" },
    },
  },
  {
    key: "usr_1002",
    fields: {
      account_id: { oldVal: "usr_1002", newVal: "usr_1002", status: "unchanged" },
      tenure: { oldVal: "24", newVal: "24", status: "unchanged" },
      phone_number: { oldVal: "+1-555-0432", newVal: "[MASKED_PII_SHA]", status: "modified" },
      missing_charges: { oldVal: "89.20", newVal: "89.20", status: "unchanged" },
      status: { oldVal: "active", newVal: "active", status: "unchanged" },
    },
  },
  {
    key: "usr_1003",
    fields: {
      account_id: { oldVal: "usr_1003", newVal: "usr_1003", status: "unchanged" },
      tenure: { oldVal: "NULL", newVal: "1 (zero-filled)", status: "added" },
      phone_number: { oldVal: "+1-555-0781", newVal: "[MASKED_PII_SHA]", status: "modified" },
      missing_charges: { oldVal: "124.00", newVal: "124.00", status: "unchanged" },
      status: { oldVal: "churned", newVal: "churned", status: "unchanged" },
    },
  },
];

export function DiffInteractiveDemo() {
  const [selectedCommit, setSelectedCommit] = useState<string>("v1.1-clean");

  return (
    <div className="relative w-full group">
      {/* Ambient Dark Emerald/Cobalt Glow Underlay */}
      <div className="absolute -inset-1 bg-gradient-to-r from-[#0061FE]/25 via-[#057A55]/20 to-[#31C48D]/20 rounded-3xl blur-2xl opacity-50 group-hover:opacity-80 transition duration-700 pointer-events-none" />

      {/* Main Glassmorphic Dark Window */}
      <div className="relative w-full bg-[#1E1915]/95 backdrop-blur-2xl text-[#F7F5F2] rounded-2xl border border-white/10 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] overflow-hidden font-sans">
        {/* Top Chrome */}
        <div className="bg-[#171310]/90 backdrop-blur-md border-b border-[#332F2B] px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0061FE] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(0,97,254,0.3)]">
              <GitPullRequest className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Interactive Version Diff & Lineage</h4>
              <p className="text-xs text-[#A89F95]">Comparing v1.0 (Raw Ingest) &rarr; v1.1 (Cleaned & PII Masked)</p>
            </div>
          </div>

          {/* Change stats */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="px-3 py-1 rounded-full bg-[#057A55]/20 text-[#31C48D] border border-[#057A55]/40 font-semibold shadow-2xs">
              +3,410 rows added
            </span>
            <span className="px-3 py-1 rounded-full bg-[#E02424]/20 text-[#F98080] border border-[#E02424]/40 font-semibold shadow-2xs">
              -42 duplicates
            </span>
            <span className="px-3 py-1 rounded-full bg-[#0061FE]/20 text-[#76A9FA] border border-[#0061FE]/40 font-semibold shadow-2xs">
              1 column masked
            </span>
          </div>
        </div>

        {/* Commit History Timeline Bar */}
        <div className="bg-[#241E1A]/80 border-b border-[#332F2B] px-6 py-3 flex items-center gap-3 overflow-x-auto text-xs font-mono">
          <span className="text-[#8C827A] uppercase tracking-wider text-[11px] shrink-0 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Commits:
          </span>
          <button
            onClick={() => setSelectedCommit("v1.1-clean")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all duration-200 shrink-0 ${
              selectedCommit === "v1.1-clean"
                ? "bg-[#0061FE] text-white font-semibold shadow-md shadow-[#0061FE]/30 scale-[1.02]"
                : "bg-[#1E1915] text-[#B0A79E] hover:text-white hover:bg-[#2B2420]"
            }`}
          >
            <GitCommit className="w-3.5 h-3.5 text-white" />
            <span>v1.1 (Mask PII + KNN Impute)</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">HEAD</span>
          </button>

          <button
            onClick={() => setSelectedCommit("v1.0-raw")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all duration-200 shrink-0 ${
              selectedCommit === "v1.0-raw"
                ? "bg-[#0061FE] text-white font-semibold shadow-md shadow-[#0061FE]/30 scale-[1.02]"
                : "bg-[#1E1915] text-[#B0A79E] hover:text-white hover:bg-[#2B2420]"
            }`}
          >
            <GitCommit className="w-3.5 h-3.5 text-[#8C827A]" />
            <span>v1.0 (Initial S3 Ingest)</span>
            <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-[#8C827A] font-mono">root</span>
          </button>
        </div>

        {/* Side-by-Side Diff Table */}
        <div className="overflow-x-auto p-6 bg-[#171310]/95 bg-dots-dark">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-[#332F2B] text-[#A89F95]">
                <th className="py-2.5 px-3">Row Key</th>
                <th className="py-2.5 px-3">phone_number (Before &rarr; After)</th>
                <th className="py-2.5 px-3">missing_charges (Before &rarr; After)</th>
                <th className="py-2.5 px-3">status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2B2621]">
              {SAMPLE_DIFF_ROWS.map((row) => (
                <tr key={row.key} className="hover:bg-[#221C18] transition-colors duration-150">
                  <td className="py-3.5 px-3 text-[#736B63]">{row.key}</td>
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="line-through text-[#F98080] bg-[#E02424]/15 px-2 py-0.5 rounded border border-[#E02424]/30">
                        {row.fields.phone_number.oldVal}
                      </span>
                      <ArrowRight className="w-3 h-3 text-[#736B63]" />
                      <span className="text-[#76A9FA] bg-[#0061FE]/20 px-2 py-0.5 rounded font-semibold border border-[#0061FE]/40 flex items-center gap-1.5 shadow-2xs">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#76A9FA]" /> {row.fields.phone_number.newVal}
                      </span>
                    </div>
                  </td>

                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-2">
                      {row.fields.missing_charges.status === "added" ? (
                        <>
                          <span className="line-through text-[#A89F95] bg-white/5 px-2 py-0.5 rounded border border-white/10">
                            {row.fields.missing_charges.oldVal}
                          </span>
                          <ArrowRight className="w-3 h-3 text-[#736B63]" />
                          <span className="text-[#31C48D] bg-[#057A55]/25 px-2 py-0.5 rounded font-semibold border border-[#057A55]/40 shadow-2xs">
                            {row.fields.missing_charges.newVal}
                          </span>
                        </>
                      ) : (
                        <span className="text-[#E5E0D8]">{row.fields.missing_charges.newVal}</span>
                      )}
                    </div>
                  </td>

                  <td className="py-3.5 px-3">
                    {row.fields.status.status === "modified" ? (
                      <div className="flex items-center gap-1.5">
                        <span className="line-through text-[#F98080]">{row.fields.status.oldVal}</span>
                        <ArrowRight className="w-3 h-3 text-[#736B63]" />
                        <span className="text-[#FACA15] bg-[#E3A008]/20 px-2 py-0.5 rounded font-semibold border border-[#E3A008]/30 shadow-2xs">
                          {row.fields.status.newVal}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[#A89F95]">{row.fields.status.newVal}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom Diff Summary */}
        <div className="bg-[#1E1915] border-t border-[#332F2B] px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-[#A89F95]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#31C48D] animate-pulse" />
            <span>Audit-ready: Every row alteration is cryptographically signed and rollback-ready.</span>
          </div>
          <span className="text-[11px] font-mono text-[#76A9FA] hover:text-white hover:underline cursor-pointer transition-colors">
            One-click revert to v1.0 &rarr;
          </span>
        </div>
      </div>
    </div>
  );
}
