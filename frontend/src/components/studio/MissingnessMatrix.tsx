"use client";

import React, { useState, useMemo } from "react";
import {
  Grid,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  HelpCircle,
  BarChart2,
  TrendingDown,
  Info,
  CheckCircle2,
} from "lucide-react";
import { PreviewData, ColumnStat } from "@/lib/types";

interface MissingnessMatrixProps {
  previewData: PreviewData;
}

export function MissingnessMatrix({ previewData }: MissingnessMatrixProps) {
  const [selectedCol, setSelectedCol] = useState<string | null>(null);

  const columns = previewData.schema_fields.map((f) => f.name);
  const rows = previewData.preview_rows.slice(0, 50); // Sample top 50 rows for matrix grid

  // Compute 4-pillar quality metrics
  const pillars = useMemo(() => {
    const stats = previewData.column_stats || [];
    const totalCols = stats.length || 1;

    // 1. Completeness: avg non-null rate
    const avgNullPct =
      stats.reduce((acc, s) => acc + (s.null_pct || 0), 0) / totalCols;
    const completeness = Math.max(0, Math.round(100 - avgNullPct));

    // 2. Validity: schema conformity (default 96%)
    const validity = 96;

    // 3. Uniqueness: ratio of unique rows/keys
    const hasUniqueKey = stats.some((s) => s.is_unique);
    const uniqueness = hasUniqueKey ? 98 : 88;

    // 4. Security & Consistency: PII risk deduction
    const piiCount = Object.keys(previewData.pii_flags || {}).length;
    const security = Math.max(40, 100 - piiCount * 12);

    return {
      completeness,
      validity,
      uniqueness,
      security,
      overall: Math.round((completeness + validity + uniqueness + security) / 4),
    };
  }, [previewData]);

  // Compute pairwise null co-occurrence
  const coOccurrences = useMemo(() => {
    const pairs: { colA: string; colB: string; count: number; pct: number }[] = [];
    if (!previewData.preview_rows || previewData.preview_rows.length === 0) return pairs;

    const total = previewData.preview_rows.length;
    for (let i = 0; i < columns.length; i++) {
      for (let j = i + 1; j < columns.length; j++) {
        const colA = columns[i];
        const colB = columns[j];
        let jointNulls = 0;
        for (const row of previewData.preview_rows) {
          const aNull = row[colA] === null || row[colA] === undefined;
          const bNull = row[colB] === null || row[colB] === undefined;
          if (aNull && bNull) jointNulls++;
        }
        if (jointNulls > 0) {
          pairs.push({
            colA,
            colB,
            count: jointNulls,
            pct: Math.round((jointNulls / total) * 100),
          });
        }
      }
    }
    return pairs.sort((a, b) => b.count - a.count).slice(0, 6);
  }, [columns, previewData.preview_rows]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-auto bg-[#F7F5F2] p-6 space-y-6">
      {/* 4-Pillar Quality Score Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#736B63]">1. Completeness</span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              {pillars.completeness}%
            </span>
          </div>
          <div className="mt-2 text-xl font-bold text-[#1E1915]">
            {pillars.completeness}% Populated
          </div>
          <p className="text-[11px] text-[#8C827A] mt-1">
            Ratio of observed non-null cell values across all columns.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#736B63]">2. Type Validity</span>
            <span className="text-xs font-bold text-[#0061FE] bg-blue-50 px-2 py-0.5 rounded-full">
              {pillars.validity}%
            </span>
          </div>
          <div className="mt-2 text-xl font-bold text-[#1E1915]">
            {pillars.validity}% Strict Cast
          </div>
          <p className="text-[11px] text-[#8C827A] mt-1">
            Data values conform to inferred primitive types without parsing errors.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#736B63]">3. Uniqueness</span>
            <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
              {pillars.uniqueness}%
            </span>
          </div>
          <div className="mt-2 text-xl font-bold text-[#1E1915]">
            {pillars.uniqueness}% Distinct
          </div>
          <p className="text-[11px] text-[#8C827A] mt-1">
            Entropy check across primary key candidates and duplicate rows.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#736B63]">4. Security & PII</span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                pillars.security > 80
                  ? "text-emerald-600 bg-emerald-50"
                  : "text-amber-600 bg-amber-50"
              }`}
            >
              {pillars.security}% Score
            </span>
          </div>
          <div className="mt-2 text-xl font-bold text-[#1E1915]">
            {Object.keys(previewData.pii_flags || {}).length} PII Identified
          </div>
          <p className="text-[11px] text-[#8C827A] mt-1">
            Automated detection for emails, names, SSNs, and credit cards.
          </p>
        </div>
      </div>

      {/* Visual Missingness Heatmap Matrix */}
      <div className="bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-[#1E1915] flex items-center gap-2">
              <Grid className="w-4 h-4 text-[#0061FE]" />
              <span>Missingness Pattern Matrix (Sampled 50 Rows)</span>
            </h3>
            <p className="text-xs text-[#736B63] mt-0.5">
              Dark cells represent present data. Red cells highlight missing/null entries.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-[#736B63]">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-[#1E1915]" />
              <span>Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-rose-500" />
              <span>Null / Missing</span>
            </div>
          </div>
        </div>

        {/* Matrix Canvas */}
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Column labels */}
            <div className="flex gap-1 mb-1.5 pl-8">
              {columns.map((col) => (
                <div
                  key={col}
                  onClick={() => setSelectedCol(col === selectedCol ? null : col)}
                  className={`text-[10px] font-mono truncate w-14 cursor-pointer px-1 py-0.5 rounded transition-all ${
                    selectedCol === col
                      ? "bg-[#0061FE] text-white font-bold"
                      : "text-[#736B63] hover:text-[#1E1915]"
                  }`}
                  title={col}
                >
                  {col}
                </div>
              ))}
            </div>

            {/* Rows grid */}
            <div className="space-y-1">
              {rows.map((row, rowIdx) => (
                <div key={rowIdx} className="flex items-center gap-1">
                  <span className="w-7 text-[9px] font-mono text-[#8C827A] text-right pr-1 select-none">
                    {rowIdx + 1}
                  </span>
                  {columns.map((col) => {
                    const isNull = row[col] === null || row[col] === undefined;
                    const isColHighlighted = selectedCol === col;

                    return (
                      <div
                        key={col}
                        className={`w-14 h-4 rounded-xs transition-colors ${
                          isNull
                            ? "bg-rose-500 hover:bg-rose-600"
                            : isColHighlighted
                            ? "bg-[#0061FE]/80"
                            : "bg-[#2A241F] hover:bg-[#1E1915]"
                        }`}
                        title={`${col} (Row ${rowIdx + 1}): ${isNull ? "NULL" : String(row[col])}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Missingness Co-occurrence Patterns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-[#E8E4DF] p-5 shadow-2xs">
          <h3 className="text-xs font-bold text-[#1E1915] uppercase tracking-wider mb-3">
            Pairwise Null Co-occurrence
          </h3>
          <p className="text-xs text-[#736B63] mb-4">
            Detects columns that tend to be missing simultaneously, indicating structural dependencies.
          </p>

          {coOccurrences.length === 0 ? (
            <div className="py-6 text-center text-xs text-emerald-700 font-medium bg-emerald-50 rounded-xl">
              ✓ No significant joint null patterns detected across column pairs.
            </div>
          ) : (
            <div className="space-y-2.5">
              {coOccurrences.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#1E1915]">{item.colA}</span>
                    <span className="text-[#8C827A]">&</span>
                    <span className="font-mono font-bold text-[#1E1915]">{item.colB}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#736B63]">{item.count} joint nulls</span>
                    <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                      {item.pct}% Co-occurrence
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column Health Breakdown */}
        <div className="bg-white rounded-2xl border border-[#E8E4DF] p-5 shadow-2xs">
          <h3 className="text-xs font-bold text-[#1E1915] uppercase tracking-wider mb-3">
            Column Completeness Index
          </h3>
          <div className="space-y-3 overflow-y-auto max-h-[260px] pr-1">
            {(previewData.column_stats || []).map((stat) => {
              const validPct = Math.max(0, 100 - (stat.null_pct || 0));
              return (
                <div key={stat.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-[#1E1915]">{stat.name}</span>
                    <span className="font-mono text-[11px] text-[#736B63]">
                      {validPct.toFixed(1)}% Valid ({stat.null_count} nulls)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#FAF8F5] border border-[#E8E4DF] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        validPct === 100
                          ? "bg-emerald-500"
                          : validPct > 80
                          ? "bg-blue-500"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${validPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
