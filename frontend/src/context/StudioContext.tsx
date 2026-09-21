"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { ColumnStat, PreviewData, DatasetItem } from "@/lib/types";
import { fetchCommits } from "@/lib/api";

export interface QueryPlanInfo {
  sql: string;
  executionTimeMs?: number;
  rowCount?: number;
  columns?: string[];
  viewName?: string;
  error?: string;
}

export interface CommitInfo {
  version: string;
  hash: string;
  message: string;
  author: string;
  date: string;
  deltaRows?: string;
  deltaColumns?: string;
  addedCols?: string[];
  modifiedCols?: string[];
}

interface StudioContextType {
  activeContextTab: "column" | "sql" | "git" | "analyst";
  setActiveContextTab: (tab: "column" | "sql" | "git" | "analyst") => void;

  selectedColumn: ColumnStat | null;
  setSelectedColumn: (col: ColumnStat | null) => void;

  activeDataset: (PreviewData | DatasetItem) | null;
  setActiveDataset: (ds: (PreviewData | DatasetItem) | null) => void;

  activeQueryPlan: QueryPlanInfo | null;
  setActiveQueryPlan: (plan: QueryPlanInfo | null) => void;

  activeCommit: CommitInfo | null;
  setActiveCommit: (commit: CommitInfo | null) => void;

  isContextBarOpen: boolean;
  setIsContextBarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleContextBar: () => void;
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [activeContextTab, setActiveContextTab] = useState<
    "column" | "sql" | "git" | "analyst"
  >("column");
  const [selectedColumn, setSelectedColumn] = useState<ColumnStat | null>(null);
  const [activeDataset, setActiveDataset] = useState<
    (PreviewData | DatasetItem) | null
  >(null);
  const [activeQueryPlan, setActiveQueryPlan] = useState<QueryPlanInfo | null>(
    null
  );
  const [activeCommit, setActiveCommit] = useState<CommitInfo | null>(null);
  const [isContextBarOpen, setIsContextBarOpen] = useState(true);

  useEffect(() => {
    fetchCommits()
      .then((commits) => {
        if (commits && commits.length > 0) {
          const c = commits[0];
          setActiveCommit({
            version: c.version || "v1.0.0",
            hash: c.hash || c.full_hash?.slice(0, 7) || "0000000",
            message: c.message || "Snapshot",
            author: c.author || "System Ingest",
            date: c.date || "Just now",
            deltaRows: c.deltaRows,
            deltaColumns: c.deltaColumns,
            addedCols: c.diffSummary?.addedCols || c.addedCols || [],
            modifiedCols: c.diffSummary?.modifiedCols || c.modifiedCols || [],
          });
        }
      })
      .catch((err) => console.error("Could not load initial commit:", err));
  }, []);

  const toggleContextBar = () => {
    setIsContextBarOpen((prev) => !prev);
  };

  return (
    <StudioContext.Provider
      value={{
        activeContextTab,
        setActiveContextTab,
        selectedColumn,
        setSelectedColumn,
        activeDataset,
        setActiveDataset,
        activeQueryPlan,
        setActiveQueryPlan,
        activeCommit,
        setActiveCommit,
        isContextBarOpen,
        setIsContextBarOpen,
        toggleContextBar,
      }}
    >
      {children}
    </StudioContext.Provider>
  );
}

export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error("useStudio must be used within a StudioProvider");
  }
  return context;
}
