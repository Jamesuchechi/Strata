"use client";

import React from "react";
import { FileSpreadsheet } from "lucide-react";

interface SheetTabsProps {
  sheets: string[];
  activeSheet: string;
  onSelectSheet: (sheet: string) => void;
}

export function SheetTabs({ sheets, activeSheet, onSelectSheet }: SheetTabsProps) {
  if (!sheets || sheets.length <= 1) return null;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-800 bg-slate-950/60 px-3 py-1.5 rounded-t-xl">
      <span className="text-[11px] text-slate-500 flex items-center gap-1 mr-2 font-mono">
        <FileSpreadsheet className="w-3.5 h-3.5" /> Sheets:
      </span>
      {sheets.map((sheet) => {
        const isActive = sheet === activeSheet;
        return (
          <button
            key={sheet}
            onClick={() => onSelectSheet(sheet)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              isActive
                ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            {sheet}
          </button>
        );
      })}
    </div>
  );
}
