"use client";

import React, { useState, useEffect } from "react";
import {
  GitFork,
  Database,
  GitCommit,
  ArrowRight,
  Sparkles,
  Info,
  Calendar,
  User,
} from "lucide-react";
import { fetchLineageGraph } from "@/lib/api";

export function LineageDAG() {
  const [graphData, setGraphData] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data = await fetchLineageGraph();
        setGraphData(data);
        if (data.nodes?.length > 0) {
          setSelectedNode(data.nodes[0]);
        }
      } catch (err) {
        console.error("Failed to load lineage graph:", err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-[#736B63] space-y-3">
        <div className="w-8 h-8 border-2 border-[#0061FE] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono">Building interactive lineage DAG...</p>
      </div>
    );
  }

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F5F2] overflow-hidden p-6 space-y-4">
      <div className="bg-white rounded-2xl border border-[#E8E4DF] p-5 shadow-2xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <GitFork className="w-5 h-5 text-purple-600" />
            <h2 className="text-base font-bold text-[#1E1915]">Data Lineage & Provenance DAG</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 font-bold">
              Full Traceability
            </span>
          </div>
          <p className="text-xs text-[#736B63] mt-0.5">
            Trace backward provenance and forward impact across datasets, wrangling transformations, and derived snapshots.
          </p>
        </div>
        <div className="text-xs font-mono text-[#736B63]">
          {nodes.length} Nodes · {edges.length} Edges
        </div>
      </div>

      {/* Main DAG Canvas */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        {/* Node Graph Flow (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E8E4DF] shadow-2xs p-6 overflow-auto flex flex-col justify-center items-center">
          {nodes.length === 0 ? (
            <div className="text-center text-xs text-[#8C827A]">
              No lineage nodes recorded yet. Ingest a dataset or run a wrangling recipe to begin tracking.
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-8 w-full">
              {nodes.map((n: any, idx: number) => {
                const isSelected = selectedNode?.id === n.id;
                const isDataset = n.type === "dataset";
                return (
                  <React.Fragment key={n.id}>
                    <div
                      onClick={() => setSelectedNode(n)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all w-60 shadow-2xs ${
                        isSelected
                          ? "border-[#0061FE] bg-blue-50/40 ring-2 ring-[#0061FE]/20"
                          : "border-[#E8E4DF] bg-[#FAF8F5] hover:border-[#0061FE]/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white border border-[#E8E4DF] font-bold text-[#736B63]">
                          {isDataset ? "Raw Ingest" : "DAG Commit"}
                        </span>
                        {isDataset ? (
                          <Database className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <GitCommit className="w-4 h-4 text-purple-600" />
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-[#1E1915] truncate" title={n.label}>
                        {n.label}
                      </h4>
                      <p className="text-[11px] font-mono text-[#736B63] mt-1">
                        {isDataset
                          ? `${n.rows?.toLocaleString() || 0} rows · ${n.cols || 0} cols`
                          : `Delta: ${n.delta || "0 rows"}`}
                      </p>
                    </div>

                    {idx < nodes.length - 1 && (
                      <div className="flex items-center text-[#8C827A] shrink-0">
                        <ArrowRight className="w-5 h-5 rotate-90 md:rotate-0" />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Node Details (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-[#E8E4DF] shadow-2xs p-5 overflow-y-auto space-y-4">
          <h3 className="text-xs font-bold text-[#1E1915] uppercase tracking-wider">
            Lineage Node Inspector
          </h3>

          {selectedNode ? (
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] space-y-2">
                <div className="font-bold text-[#1E1915] text-sm">{selectedNode.label}</div>
                <div className="text-[11px] font-mono text-[#736B63]">ID: {selectedNode.id}</div>
              </div>

              <div className="space-y-2 font-mono text-[11px]">
                <div className="flex justify-between py-1.5 border-b border-[#FAF8F5]">
                  <span className="text-[#736B63]">Node Type:</span>
                  <span className="font-bold text-[#1E1915] uppercase">{selectedNode.type}</span>
                </div>
                {selectedNode.format && (
                  <div className="flex justify-between py-1.5 border-b border-[#FAF8F5]">
                    <span className="text-[#736B63]">Source Format:</span>
                    <span className="font-bold text-[#1E1915]">{selectedNode.format}</span>
                  </div>
                )}
                {selectedNode.author && (
                  <div className="flex justify-between py-1.5 border-b border-[#FAF8F5]">
                    <span className="text-[#736B63]">Author:</span>
                    <span className="font-bold text-[#1E1915]">{selectedNode.author}</span>
                  </div>
                )}
                {selectedNode.delta && (
                  <div className="flex justify-between py-1.5 border-b border-[#FAF8F5]">
                    <span className="text-[#736B63]">Row Delta:</span>
                    <span className="font-bold text-emerald-700">{selectedNode.delta}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-[#8C827A] py-8 text-center">
              Select any node in the flow to inspect provenance details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
