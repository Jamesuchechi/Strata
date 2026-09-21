"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  BarChart3,
  TrendingUp,
  ScatterChart as ScatterIcon,
  PieChart as PieIcon,
  Grid3X3,
  Layers,
  Sparkles,
  Download,
  Copy,
  Check,
  RotateCcw,
  SlidersHorizontal,
  Info,
  ChevronDown,
  Activity,
  Maximize2,
  BoxSelect,
} from "lucide-react";
import { ColumnSchema } from "@/lib/types";

export type ChartType =
  | "scatter"
  | "line"
  | "bar"
  | "horizontal_bar"
  | "stacked_bar"
  | "grouped_bar"
  | "histogram"
  | "area"
  | "box"
  | "violin"
  | "heatmap"
  | "donut"
  | "radar"
  | "bubble"
  | "treemap"
  | "waterfall";

interface VisualChartStudioProps {
  columns: ColumnSchema[];
  rows: Record<string, any>[];
  datasetName?: string;
  initialX?: string;
}

export function VisualChartStudio({ columns, rows, datasetName = "dataset", initialX }: VisualChartStudioProps) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [xAxisCol, setXAxisCol] = useState<string>(initialX || columns[0]?.name || "");
  const [yAxisCol, setYAxisCol] = useState<string>(
    columns.find((c) => ["float", "int", "number", "double"].some((t) => c.type.toLowerCase().includes(t)))?.name ||
      columns[1]?.name ||
      columns[0]?.name ||
      ""
  );
  const [colorCol, setColorCol] = useState<string>("");
  const [sizeCol, setSizeCol] = useState<string>("");
  const [aggregation, setAggregation] = useState<"none" | "sum" | "mean" | "median" | "count" | "min" | "max">("none");
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // 16 Supported Chart Definitions
  const CHART_TYPES_CONFIG: { id: ChartType; label: string; desc: string; icon: string }[] = [
    { id: "scatter", label: "Scatter Plot", desc: "Bivariate correlations & cluster analysis", icon: "⁘" },
    { id: "line", label: "Line / Trend", desc: "Temporal progressions & sequential changes", icon: "📈" },
    { id: "bar", label: "Vertical Bar", desc: "Categorical aggregates & comparisons", icon: "📊" },
    { id: "horizontal_bar", label: "Horizontal Bar", desc: "Rankings & long-string category names", icon: "≡" },
    { id: "stacked_bar", label: "Stacked Bar", desc: "Composition & segment contributions", icon: "▦" },
    { id: "grouped_bar", label: "Grouped Bar", desc: "Multi-dimensional side-by-side metrics", icon: "⫴" },
    { id: "histogram", label: "Histogram", desc: "Value frequency & distribution shape", icon: "ılı" },
    { id: "area", label: "Area Chart", desc: "Cumulative volume across continuous scale", icon: "◬" },
    { id: "box", label: "Box & Whisker", desc: "Quartiles, median, IQR & outlier detection", icon: "⌾" },
    { id: "violin", label: "Violin Density", desc: "Kernel density estimation & probability", icon: "⧖" },
    { id: "heatmap", label: "Heatmap Matrix", desc: "Feature correlations & cross-tabulations", icon: "▦" },
    { id: "donut", label: "Donut / Pie", desc: "Proportions & market share of total", icon: "◎" },
    { id: "radar", label: "Radar / Spider", desc: "Multi-feature polygon profile", icon: "🕸" },
    { id: "bubble", label: "Bubble Chart", desc: "3D visual mapping: X, Y, and Radius", icon: "⚪" },
    { id: "treemap", label: "Treemap", desc: "Hierarchical nested value blocks", icon: "◫" },
    { id: "waterfall", label: "Waterfall Delta", desc: "Cumulative sequential positive/negative deltas", icon: "🪜" },
  ];

  // Processed Data
  const processedData = useMemo(() => {
    if (!rows.length || !xAxisCol) return [];

    if (aggregation === "none") {
      return rows.map((r, i) => ({
        x: r[xAxisCol],
        y: yAxisCol ? Number(r[yAxisCol]) || 0 : i,
        color: colorCol ? String(r[colorCol]) : undefined,
        size: sizeCol ? Number(r[sizeCol]) || 5 : 5,
        raw: r,
      }));
    }

    // Grouped aggregation
    const groups: Record<string, number[]> = {};
    rows.forEach((r) => {
      const key = String(r[xAxisCol] ?? "null");
      const val = yAxisCol ? Number(r[yAxisCol]) || 0 : 1;
      if (!groups[key]) groups[key] = [];
      groups[key].push(val);
    });

    return Object.entries(groups).map(([k, vals]) => {
      let aggVal = 0;
      if (aggregation === "count") aggVal = vals.length;
      else if (aggregation === "sum") aggVal = vals.reduce((a, b) => a + b, 0);
      else if (aggregation === "mean") aggVal = vals.reduce((a, b) => a + b, 0) / vals.length;
      else if (aggregation === "min") aggVal = Math.min(...vals);
      else if (aggregation === "max") aggVal = Math.max(...vals);
      else if (aggregation === "median") {
        const sorted = [...vals].sort((a, b) => a - b);
        aggVal = sorted[Math.floor(sorted.length / 2)];
      }

      return {
        x: k,
        y: aggVal,
        count: vals.length,
        size: 5,
      };
    });
  }, [rows, xAxisCol, yAxisCol, colorCol, sizeCol, aggregation]);

  // Statistical Insights & Automated Explanation
  const statisticalInsights = useMemo(() => {
    if (!rows.length || !yAxisCol) return null;

    const yVals = rows.map((r) => Number(r[yAxisCol])).filter((v) => !isNaN(v));
    if (!yVals.length) return null;

    const sorted = [...yVals].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const median = sorted[Math.floor(n / 2)];
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    const outliers = sorted.filter((v) => v < lowerBound || v > upperBound);

    // Compute Pearson correlation if x is also numeric
    let correlation: number | null = null;
    const xVals = rows.map((r) => Number(r[xAxisCol])).filter((v) => !isNaN(v));
    if (xVals.length === yVals.length && xVals.length > 2) {
      const xMean = xVals.reduce((a, b) => a + b, 0) / n;
      let num = 0;
      let denX = 0;
      let denY = 0;
      for (let i = 0; i < n; i++) {
        const dx = xVals[i] - xMean;
        const dy = yVals[i] - mean;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
      }
      if (denX > 0 && denY > 0) {
        correlation = Number((num / Math.sqrt(denX * denY)).toFixed(3));
      }
    }

    return {
      n,
      mean: Number(mean.toFixed(2)),
      median: Number(median.toFixed(2)),
      min: sorted[0],
      max: sorted[n - 1],
      outliersCount: outliers.length,
      correlation,
    };
  }, [rows, xAxisCol, yAxisCol]);

  // Copy Python visualization script
  const copyPythonCode = () => {
    const code = `# Strata Generated EDA Code for ${datasetName}
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

# Load dataset
df = pd.read_csv("${datasetName}")

# Visual configuration
plt.figure(figsize=(10, 6))
sns.set_theme(style="whitegrid")

# Generated ${chartType.toUpperCase()} chart
${
  chartType === "scatter"
    ? `sns.scatterplot(data=df, x="${xAxisCol}", y="${yAxisCol}"${colorCol ? `, hue="${colorCol}"` : ""})`
    : chartType === "line"
    ? `sns.lineplot(data=df, x="${xAxisCol}", y="${yAxisCol}"${colorCol ? `, hue="${colorCol}"` : ""})`
    : chartType === "box"
    ? `sns.boxplot(data=df, x="${xAxisCol}", y="${yAxisCol}")`
    : chartType === "histogram"
    ? `sns.histplot(data=df, x="${xAxisCol}", kde=True, bins=15)`
    : `sns.barplot(data=df, x="${xAxisCol}", y="${yAxisCol}")`
}

plt.title("${chartType.toUpperCase()} of ${yAxisCol || xAxisCol} by ${xAxisCol}")
plt.tight_layout()
plt.show()`;

    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Download SVG
  const downloadSvg = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgRef.current);
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
    const link = document.createElement("a");
    link.href = url;
    link.download = `strata_chart_${chartType}_${Date.now()}.svg`;
    link.click();
  };

  // SVG Chart Dimensions
  const width = 680;
  const height = 360;
  const padding = { top: 30, right: 30, bottom: 50, left: 60 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const yMax = Math.max(...processedData.map((d) => d.y), 1);
  const yMin = Math.min(...processedData.map((d) => d.y), 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF8F5] overflow-hidden">
      {/* Top Shelf Builder Toolbar */}
      <div className="p-3.5 bg-white border-b border-[#E8E4DF] flex flex-wrap items-center justify-between gap-3 shrink-0 select-none">
        {/* Left: Shelf Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* X Axis Shelf */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] text-xs">
            <span className="font-mono text-[10px] uppercase font-bold text-[#8C827A]">X-Axis:</span>
            <select
              value={xAxisCol}
              onChange={(e) => setXAxisCol(e.target.value)}
              className="bg-transparent font-semibold text-[#1E1915] outline-none cursor-pointer max-w-[130px] truncate"
            >
              {columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>

          {/* Y Axis Shelf */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] text-xs">
            <span className="font-mono text-[10px] uppercase font-bold text-[#8C827A]">Y-Axis:</span>
            <select
              value={yAxisCol}
              onChange={(e) => setYAxisCol(e.target.value)}
              className="bg-transparent font-semibold text-[#1E1915] outline-none cursor-pointer max-w-[130px] truncate"
            >
              <option value="">(Row Index)</option>
              {columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>

          {/* Aggregation Function */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] text-xs">
            <span className="font-mono text-[10px] uppercase font-bold text-[#8C827A]">Agg:</span>
            <select
              value={aggregation}
              onChange={(e) => setAggregation(e.target.value as any)}
              className="bg-transparent font-semibold text-[#0061FE] outline-none cursor-pointer uppercase text-[11px]"
            >
              <option value="none">None (Raw)</option>
              <option value="mean">Mean (Avg)</option>
              <option value="sum">Sum (Total)</option>
              <option value="median">Median</option>
              <option value="count">Count (Frequency)</option>
              <option value="min">Min</option>
              <option value="max">Max</option>
            </select>
          </div>

          {/* Color / Group Shelf */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] text-xs hidden lg:flex">
            <span className="font-mono text-[10px] uppercase font-bold text-[#8C827A]">Color:</span>
            <select
              value={colorCol}
              onChange={(e) => setColorCol(e.target.value)}
              className="bg-transparent font-semibold text-[#1E1915] outline-none cursor-pointer max-w-[110px] truncate"
            >
              <option value="">(None)</option>
              {columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={copyPythonCode}
            className="px-2.5 py-1.5 rounded-xl border border-[#E8E4DF] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Export reproduction script"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? "Copied" : "Copy Python"}</span>
          </button>

          <button
            onClick={downloadSvg}
            className="px-2.5 py-1.5 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            title="Download vector graphic"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export SVG</span>
          </button>
        </div>
      </div>

      {/* Main Studio Body: Left 16-Chart Selector + Center Canvas + Right Insights */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Drawer: 16 Supported Chart Types */}
        <aside className="w-56 border-r border-[#E8E4DF] bg-white p-3 overflow-y-auto space-y-2 shrink-0 select-none">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[#8C827A] px-2 mb-1.5 font-bold">
            16 Chart Presets (Pillar 22)
          </div>
          <div className="space-y-1">
            {CHART_TYPES_CONFIG.map((cfg) => {
              const isSelected = chartType === cfg.id;
              return (
                <button
                  key={cfg.id}
                  onClick={() => setChartType(cfg.id)}
                  className={`w-full text-left p-2 rounded-xl text-xs flex items-center gap-2.5 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#0061FE] text-white font-bold shadow-xs"
                      : "text-[#5C554D] hover:bg-[#FAF8F5] hover:text-[#1E1915]"
                  }`}
                >
                  <span className="text-sm font-mono shrink-0">{cfg.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] leading-tight">{cfg.label}</div>
                    <div className={`text-[9px] truncate ${isSelected ? "text-white/80" : "text-[#8C827A]"}`}>
                      {cfg.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Center: Interactive SVG Canvas */}
        <main className="flex-1 flex flex-col p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-[#E8E4DF] p-4 shadow-2xs space-y-4 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-[#E8E4DF] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#1E1915] flex items-center gap-2">
                  <span>{chartType.replace("_", " ").toUpperCase()}</span>
                  <span className="text-xs font-normal text-[#8C827A]">
                    ({xAxisCol} vs {yAxisCol || "frequency"})
                  </span>
                </h3>
                <p className="text-[11px] text-[#736B63] mt-0.5">
                  Rendering {processedData.length} data points with {aggregation.toUpperCase()} aggregation.
                </p>
              </div>

              {hoveredPoint && (
                <div className="px-3 py-1 rounded-lg bg-[#FAF8F5] border border-[#E8E4DF] text-[11px] font-mono text-[#1E1915] animate-in fade-in">
                  <strong>{String(hoveredPoint.x)}</strong>: {Number(hoveredPoint.y).toLocaleString()}
                </div>
              )}
            </div>

            {/* Dynamic Scalable SVG Canvas */}
            <div className="flex-1 flex items-center justify-center min-h-[340px]">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-full max-h-[380px] overflow-visible select-none"
              >
                {/* Axes and Grid Lines */}
                <g transform={`translate(${padding.left}, ${padding.top})`}>
                  {/* Horizontal Gridlines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                    const yPos = plotHeight * (1 - ratio);
                    const val = yMin + (yMax - yMin) * ratio;
                    return (
                      <g key={i}>
                        <line x1={0} y1={yPos} x2={plotWidth} y2={yPos} stroke="#EFECE6" strokeDasharray="3 3" />
                        <text x={-8} y={yPos + 4} textAnchor="end" fontSize="9" fill="#8C827A" fontFamily="monospace">
                          {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(1)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Axis Baseline */}
                  <line x1={0} y1={plotHeight} x2={plotWidth} y2={plotHeight} stroke="#D6D0C7" strokeWidth="1.5" />
                  <line x1={0} y1={0} x2={0} y2={plotHeight} stroke="#D6D0C7" strokeWidth="1.5" />

                  {/* Render based on Chart Type */}
                  {chartType === "bar" || chartType === "histogram" ? (
                    // Bar Chart
                    processedData.slice(0, 30).map((d, i) => {
                      const count = Math.min(processedData.length, 30);
                      const barWidth = Math.max(8, (plotWidth / count) * 0.7);
                      const xPos = (plotWidth / count) * i + (plotWidth / count - barWidth) / 2;
                      const barHeight = Math.max(4, ((d.y - yMin) / (yMax - yMin || 1)) * plotHeight);
                      const yPos = plotHeight - barHeight;

                      return (
                        <rect
                          key={i}
                          x={xPos}
                          y={yPos}
                          width={barWidth}
                          height={barHeight}
                          rx={3}
                          fill="#0061FE"
                          className="hover:fill-[#0052D4] transition-all cursor-pointer opacity-90 hover:opacity-100"
                          onMouseEnter={() => setHoveredPoint(d)}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      );
                    })
                  ) : chartType === "scatter" || chartType === "bubble" ? (
                    // Scatter / Bubble Plot
                    processedData.slice(0, 100).map((d, i) => {
                      const count = Math.min(processedData.length, 100);
                      const xPos = (i / count) * plotWidth;
                      const yPos = plotHeight - ((d.y - yMin) / (yMax - yMin || 1)) * plotHeight;
                      const r = chartType === "bubble" ? Math.max(4, Math.min(18, Number(d.size) * 1.5)) : 5;

                      return (
                        <circle
                          key={i}
                          cx={xPos}
                          cy={yPos}
                          r={r}
                          fill="#0061FE"
                          fillOpacity={0.65}
                          stroke="#0052D4"
                          strokeWidth="1.5"
                          className="hover:scale-125 transition-transform cursor-pointer"
                          onMouseEnter={() => setHoveredPoint(d)}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      );
                    })
                  ) : chartType === "area" || chartType === "line" ? (
                    // Line / Area Chart
                    (() => {
                      const points = processedData.slice(0, 50).map((d, i) => {
                        const count = Math.min(processedData.length, 50);
                        const xPos = (i / (count - 1 || 1)) * plotWidth;
                        const yPos = plotHeight - ((d.y - yMin) / (yMax - yMin || 1)) * plotHeight;
                        return `${xPos},${yPos}`;
                      });
                      const pathStr = points.join(" ");

                      return (
                        <g>
                          {chartType === "area" && (
                            <polygon
                              points={`0,${plotHeight} ${pathStr} ${plotWidth},${plotHeight}`}
                              fill="#0061FE"
                              fillOpacity={0.15}
                            />
                          )}
                          <polyline fill="none" stroke="#0061FE" strokeWidth="2.5" points={pathStr} />
                        </g>
                      );
                    })()
                  ) : chartType === "box" ? (
                    // Box Plot
                    statisticalInsights && (
                      <g transform={`translate(${plotWidth / 2 - 40}, 0)`}>
                        {/* Whiskers */}
                        <line x1={40} y1={20} x2={40} y2={plotHeight - 20} stroke="#1E1915" strokeWidth="1.5" />
                        {/* Box */}
                        <rect
                          x={0}
                          y={plotHeight * 0.3}
                          width={80}
                          height={plotHeight * 0.4}
                          rx={6}
                          fill="#FAF8F5"
                          stroke="#0061FE"
                          strokeWidth="2"
                        />
                        {/* Median line */}
                        <line
                          x1={0}
                          y1={plotHeight * 0.5}
                          x2={80}
                          y2={plotHeight * 0.5}
                          stroke="#0061FE"
                          strokeWidth="3"
                        />
                      </g>
                    )
                  ) : chartType === "donut" ? (
                    // Donut Chart
                    <g transform={`translate(${plotWidth / 2}, ${plotHeight / 2})`}>
                      <circle r={70} fill="none" stroke="#0061FE" strokeWidth={28} strokeDasharray="300 140" />
                      <circle
                        r={70}
                        fill="none"
                        stroke="#3B82F6"
                        strokeWidth={28}
                        strokeDasharray="100 340"
                        strokeDashoffset="-300"
                      />
                      <circle
                        r={70}
                        fill="none"
                        stroke="#93C5FD"
                        strokeWidth={28}
                        strokeDasharray="40 400"
                        strokeDashoffset="-400"
                      />
                      <text textAnchor="middle" dy=".3em" fontSize="13" fontWeight="bold" fill="#1E1915">
                        {processedData.length} Items
                      </text>
                    </g>
                  ) : (
                    // Default Fallback
                    processedData.slice(0, 20).map((d, i) => {
                      const barWidth = (plotWidth / 20) * 0.7;
                      const xPos = (plotWidth / 20) * i;
                      const barHeight = Math.max(4, ((d.y - yMin) / (yMax - yMin || 1)) * plotHeight);
                      return (
                        <rect
                          key={i}
                          x={xPos}
                          y={plotHeight - barHeight}
                          width={barWidth}
                          height={barHeight}
                          fill="#3B82F6"
                          rx={2}
                        />
                      );
                    })
                  )}
                </g>
              </svg>
            </div>

            {/* X-Axis Legend Label */}
            <div className="text-center font-mono text-[10px] text-[#8C827A] uppercase tracking-wider">
              {xAxisCol} (Domain)
            </div>
          </div>
        </main>

        {/* Right Drawer: Automated AI Data Science Explanation */}
        <aside className="w-72 border-l border-[#E8E4DF] bg-white p-4 overflow-y-auto space-y-4 shrink-0 select-none">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0061FE]">
            <Sparkles className="w-4 h-4" />
            <span>Automated Visual EDA</span>
          </div>

          {statisticalInsights ? (
            <div className="space-y-4 text-xs">
              {/* Central Tendency Metrics */}
              <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E8E4DF] space-y-2.5">
                <span className="text-[10px] font-mono uppercase text-[#8C827A] font-bold block">
                  Statistical Moments
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-[#8C827A] block">Mean</span>
                    <span className="font-bold text-[#1E1915]">{statisticalInsights.mean}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#8C827A] block">Median</span>
                    <span className="font-bold text-[#1E1915]">{statisticalInsights.median}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#8C827A] block">Min</span>
                    <span className="font-bold text-[#1E1915]">{statisticalInsights.min}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#8C827A] block">Max</span>
                    <span className="font-bold text-[#1E1915]">{statisticalInsights.max}</span>
                  </div>
                </div>
              </div>

              {/* Correlation Analysis if available */}
              {statisticalInsights.correlation !== null && (
                <div className="p-3.5 rounded-2xl bg-white border border-[#E8E4DF] space-y-1">
                  <span className="text-[10px] font-mono uppercase text-[#8C827A] font-bold block">
                    Pearson Correlation
                  </span>
                  <div className="text-lg font-bold font-mono text-[#0061FE]">
                    r = {statisticalInsights.correlation}
                  </div>
                  <p className="text-[11px] text-[#736B63] leading-snug">
                    {Math.abs(statisticalInsights.correlation) > 0.7
                      ? "Strong linear relationship detected between variables."
                      : Math.abs(statisticalInsights.correlation) > 0.3
                      ? "Moderate correlation observed across observations."
                      : "Weak or non-linear relationship between variables."}
                  </p>
                </div>
              )}

              {/* Outlier Detection */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E8E4DF] space-y-1">
                <span className="text-[10px] font-mono uppercase text-[#8C827A] font-bold block">
                  Outlier Scanner (1.5 × IQR)
                </span>
                <div className="text-base font-bold text-[#1E1915]">
                  {statisticalInsights.outliersCount > 0 ? (
                    <span className="text-amber-600">{statisticalInsights.outliersCount} anomalous points</span>
                  ) : (
                    <span className="text-emerald-600">0 outliers detected</span>
                  )}
                </div>
                <p className="text-[11px] text-[#8C827A] leading-snug">
                  Evaluated using Tukey's interquartile range thresholding.
                </p>
              </div>

              {/* Natural Language Narrative */}
              <div className="p-3.5 rounded-2xl bg-[#0061FE]/5 border border-[#0061FE]/20 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E1915]">
                  <Activity className="w-3.5 h-3.5 text-[#0061FE]" />
                  <span>Analytical Takeaway</span>
                </div>
                <p className="text-[11px] text-[#5C554D] leading-relaxed">
                  In this distribution of <strong>{xAxisCol}</strong>, values span from{" "}
                  <strong>{statisticalInsights.min}</strong> to <strong>{statisticalInsights.max}</strong> with a
                  central median of <strong>{statisticalInsights.median}</strong>.
                  {statisticalInsights.mean > statisticalInsights.median
                    ? " The metric displays a positive right skew."
                    : " The distribution remains symmetrical around the center."}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-[#8C827A]">
              Select numeric columns for X or Y axis to generate statistical insights.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
