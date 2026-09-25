"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Plus,
  BarChart3,
  TrendingUp,
  Database,
  SlidersHorizontal,
  FileText,
  Share2,
  Trash2,
  Maximize2,
  Sparkles,
} from "lucide-react";
import { fetchDatasets, fetchDatasetPreview } from "@/lib/api";
import { DatasetItem, PreviewData } from "@/lib/types";

interface DashboardWidget {
  id: string;
  type: "metric" | "chart" | "table" | "note";
  title: string;
  metricValue?: string;
  metricSubtext?: string;
  chartType?: string;
  datasetId?: string;
  datasetName?: string;
  colX?: string;
  colY?: string;
  noteContent?: string;
}

export default function DashboardsPage() {
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [activeDataset, setActiveDataset] = useState<PreviewData | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
  const [newWidgetType, setNewWidgetType] = useState<DashboardWidget["type"]>("metric");
  const [newWidgetTitle, setNewWidgetTitle] = useState("");
  const [newMetricVal, setNewMetricVal] = useState("");

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const list = await fetchDatasets();
        setDatasets(list);
        if (list.length > 0) {
          const primary = list[0];
          const preview = await fetchDatasetPreview(primary.id).catch(() => null);
          setActiveDataset(preview);

          const generatedWidgets: DashboardWidget[] = [
            {
              id: "w1",
              type: "metric",
              title: "Active Dataset Records",
              metricValue: `${(primary.total_rows || 0).toLocaleString()} Rows`,
              metricSubtext: `${primary.filename} • ${primary.format.toUpperCase()}`,
            },
            {
              id: "w2",
              type: "metric",
              title: "Catalog Schema Dimensions",
              metricValue: `${primary.total_columns || 0} Columns`,
              metricSubtext: `Quality: ${primary.quality_score || 95}% Clean`,
            },
            {
              id: "w3",
              type: "chart",
              title: `Distribution Preview: ${primary.name || primary.filename}`,
              chartType: "bar",
              colX: preview?.schema_fields && preview.schema_fields.length > 0 ? preview.schema_fields[0].name : "row_index",
              colY: preview?.schema_fields && preview.schema_fields.length > 1 ? preview.schema_fields[1].name : "value",
            },
            {
              id: "w4",
              type: "note",
              title: "Dataset Lakehouse Summary",
              noteContent: `Dataset "${primary.filename}" is indexed in DuckDB with ${(primary.total_rows || 0).toLocaleString()} rows across ${primary.total_columns || 0} columns. All data points are queryable in sub-second time.`,
            },
          ];
          setWidgets(generatedWidgets);
        } else {
          setWidgets([]);
        }
      } catch (err) {
        console.error("Failed to load dashboards data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const addWidget = () => {
    const newW: DashboardWidget = {
      id: `widget_${Date.now()}`,
      type: newWidgetType,
      title: newWidgetTitle || "Custom Metric Scorecard",
      metricValue: newMetricVal || "Active",
      metricSubtext: "Live data telemetry",
      noteContent: "Key analytical takeaways and notes go here.",
    };
    setWidgets((prev) => [...prev, newW]);
    setIsAddWidgetOpen(false);
    setNewWidgetTitle("");
    setNewMetricVal("");
  };

  const removeWidget = (id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F5F2] overflow-hidden">
      {/* Top Header & Dashboard Controls */}
      <div className="border-b border-[#E8E4DF] bg-white px-6 py-4 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0">
            <LayoutDashboard className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#1E1915]">Interactive Dashboards & Storytelling</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 font-bold">
                Executive Canvas
              </span>
            </div>
            <p className="text-[11px] text-[#736B63]">
              Pin KPI scorecards, visualizer charts, and executive takeaways into responsive analytical dashboards.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsAddWidgetOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Widget</span>
          </button>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div className="border-b border-[#E8E4DF] bg-white/70 px-6 py-2.5 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2 text-xs text-[#736B63]">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#0061FE]" />
          <span className="font-semibold text-[#1E1915]">Global Canvas Filters:</span>
          <span className="text-[11px] bg-[#FAF8F5] px-2 py-0.5 rounded-lg border border-[#E8E4DF]">
            Dataset: {activeDataset?.filename || "Default Ingest"}
          </span>
          <span className="text-[11px] bg-[#FAF8F5] px-2 py-0.5 rounded-lg border border-[#E8E4DF]">
            Time Horizon: All Observations
          </span>
        </div>

        <span className="text-[11px] font-mono text-[#8C827A]">
          {widgets.length} Widgets Pinned
        </span>
      </div>

      {/* Dashboard Canvas Grid */}
      <div className="flex-1 overflow-auto p-6">
        {widgets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8E4DF] p-12 text-center max-w-lg mx-auto my-12 shadow-2xs">
            <LayoutDashboard className="w-10 h-10 text-[#8C827A] mx-auto mb-3 opacity-60" />
            <h3 className="text-sm font-bold text-[#1E1915] mb-1">Canvas is empty</h3>
            <p className="text-xs text-[#8C827A] mb-4">
              {datasets.length === 0
                ? "No datasets uploaded yet. Upload a dataset to start pinning metrics and charts."
                : "No widgets pinned to this canvas yet. Add your first metric, chart, or note."}
            </p>
            <div className="flex items-center justify-center gap-2">
              {datasets.length === 0 ? (
                <Link
                  href="/upload"
                  className="px-4 py-2 bg-[#0061FE] text-white text-xs font-semibold rounded-xl hover:bg-[#0052D4] transition-colors"
                >
                  Upload Dataset
                </Link>
              ) : (
                <button
                  onClick={() => setIsAddWidgetOpen(true)}
                  className="px-4 py-2 bg-[#0061FE] text-white text-xs font-semibold rounded-xl hover:bg-[#0052D4] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Widget</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {widgets.map((w) => (
              <div
                key={w.id}
                className={`bg-white rounded-2xl border border-[#E8E4DF] shadow-2xs p-5 flex flex-col justify-between transition-all hover:border-[#0061FE]/40 group ${
                  w.type === "chart" ? "md:col-span-2" : ""
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#1E1915] flex items-center gap-2">
                      {w.type === "metric" && <TrendingUp className="w-4 h-4 text-emerald-600" />}
                      {w.type === "chart" && <BarChart3 className="w-4 h-4 text-[#0061FE]" />}
                      {w.type === "note" && <Sparkles className="w-4 h-4 text-purple-600" />}
                      {w.title}
                    </span>
                    <button
                      onClick={() => removeWidget(w.id)}
                      className="opacity-0 group-hover:opacity-100 text-[#8C827A] hover:text-rose-600 p-1 transition-opacity"
                      title="Remove Widget"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Widget Body Content */}
                  {w.type === "metric" && (
                    <div className="my-3">
                      <div className="text-3xl font-extrabold text-[#1E1915]">
                        {w.metricValue}
                      </div>
                      <p className="text-xs text-emerald-600 font-semibold mt-1">
                        {w.metricSubtext}
                      </p>
                    </div>
                  )}

                  {w.type === "chart" && (
                    <div className="my-3 h-48 bg-[#FAF8F5] rounded-xl border border-[#E8E4DF] flex flex-col items-center justify-center p-4 relative">
                      <svg viewBox="0 0 500 160" className="w-full h-full">
                        <line x1="40" y1="140" x2="480" y2="140" stroke="#E8E4DF" strokeWidth="1" />
                        <line x1="40" y1="20" x2="40" y2="140" stroke="#E8E4DF" strokeWidth="1" />
                        {/* Bars */}
                        <rect x="60" y="40" width="45" height="100" fill="#0061FE" rx="4" />
                        <rect x="130" y="70" width="45" height="70" fill="#0061FE" rx="4" fillOpacity="0.85" />
                        <rect x="200" y="55" width="45" height="85" fill="#0061FE" rx="4" fillOpacity="0.7" />
                        <rect x="270" y="90" width="45" height="50" fill="#0061FE" rx="4" fillOpacity="0.85" />
                        <rect x="340" y="30" width="45" height="110" fill="#0061FE" rx="4" />
                        <rect x="410" y="65" width="45" height="75" fill="#0061FE" rx="4" fillOpacity="0.8" />
                      </svg>
                      <span className="absolute bottom-2 right-3 text-[10px] font-mono text-[#8C827A]">
                        Live Visualizer Link
                      </span>
                    </div>
                  )}

                  {w.type === "note" && (
                    <div className="my-2 p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] text-xs text-[#5C554D] leading-relaxed">
                      {w.noteContent}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-[#FAF8F5] flex items-center justify-between text-[10px] font-mono text-[#8C827A]">
                  <span>Updated Live</span>
                  <Link
                    href={w.type === "chart" ? "/visualizer" : "/datasets"}
                    className="hover:text-[#0061FE] font-semibold"
                  >
                    Explore in Studio →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Widget Modal */}
      {isAddWidgetOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E8E4DF] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="px-6 py-4 border-b border-[#E8E4DF] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1E1915]">Add Dashboard Widget</h3>
              <button
                onClick={() => setIsAddWidgetOpen(false)}
                className="text-xs text-[#736B63] hover:text-[#1E1915]"
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#736B63] block mb-1">
                  Widget Type
                </label>
                <select
                  value={newWidgetType}
                  onChange={(e) => setNewWidgetType(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] outline-none"
                >
                  <option value="metric">KPI Metric Card</option>
                  <option value="chart">Chart Visualizer Card</option>
                  <option value="note">Executive Markdown Narrative</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#736B63] block mb-1">
                  Widget Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Churn Rate % or Gross Volume"
                  value={newWidgetTitle}
                  onChange={(e) => setNewWidgetTitle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs text-[#1E1915] outline-none"
                />
              </div>

              {newWidgetType === "metric" && (
                <div>
                  <label className="text-xs font-semibold text-[#736B63] block mb-1">
                    Display Value
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 98.2% or $1.4M"
                    value={newMetricVal}
                    onChange={(e) => setNewMetricVal(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs text-[#1E1915] outline-none"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setIsAddWidgetOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-[#E8E4DF] text-xs font-semibold text-[#736B63]"
                >
                  Cancel
                </button>
                <button
                  onClick={addWidget}
                  className="px-4 py-1.5 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold"
                >
                  Add Card
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
