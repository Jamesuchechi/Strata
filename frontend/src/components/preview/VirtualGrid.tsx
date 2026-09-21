"use client";

import React from "react";
import { ColumnSchema, ColumnStat } from "@/lib/types";

interface VirtualGridProps {
  columns: ColumnSchema[];
  rows: Record<string, any>[];
  columnStats?: ColumnStat[];
  piiFlags?: Record<string, string>;
}

export function VirtualGrid({ columns, rows, columnStats, piiFlags }: VirtualGridProps) {
  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
        <p>No dataset loaded. Drag and drop a file or load a sample dataset.</p>
      </div>
    );
  }

  const statMap = new Map(columnStats?.map((s) => [s.name, s]));

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl backdrop-blur-md">
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-slate-950/95 backdrop-blur-md z-10 border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3 font-mono text-slate-500 border-r border-slate-800 w-12 text-center">#</th>
              {columns.map((col) => {
                const stat = statMap.get(col.name);
                const pii = piiFlags?.[col.name];
                return (
                  <th key={col.name} className="py-2.5 px-3 font-medium text-slate-200 border-r border-slate-800 min-w-[140px]">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="truncate font-semibold text-slate-100">{col.name}</span>
                      {pii && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 font-mono">
                          PII: {pii}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                      <span className="font-mono text-slate-400">{col.type}</span>
                      {stat && <span className="text-slate-500">{stat.null_pct}% null</span>}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-2 px-3 text-slate-500 text-center border-r border-slate-800/60 select-none">
                  {idx + 1}
                </td>
                {columns.map((col) => {
                  const val = row[col.name];
                  const isNull = val === null || val === undefined;
                  return (
                    <td key={col.name} className="py-2 px-3 border-r border-slate-800/60 truncate max-w-[220px]">
                      {isNull ? (
                        <span className="text-slate-600 italic">null</span>
                      ) : typeof val === "boolean" ? (
                        <span className={val ? "text-emerald-400" : "text-amber-400"}>{String(val)}</span>
                      ) : (
                        <span className="text-slate-300">{String(val)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
