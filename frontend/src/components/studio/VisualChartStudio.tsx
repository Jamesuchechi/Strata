"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
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

const PALETTE = [
  "#0061FE",
  "#7C3AED",
  "#059669",
  "#D97706",
  "#DC2626",
  "#0284C7",
  "#4F46E5",
  "#DB2777",
  "#10B981",
  "#F59E0B",
];

export function VisualChartStudio({ columns, rows, datasetName = "dataset", initialX }: VisualChartStudioProps) {
  // Helper to test if a column type is numeric
  const isNumericCol = (cName: string) => {
    const col = columns.find((c) => c.name === cName);
    if (!col) return false;
    const t = col.type.toLowerCase();
    return ["int", "float", "double", "num", "real", "decimal"].some((k) => t.includes(k));
  };

  const isTemporalCol = (cName: string) => {
    const col = columns.find((c) => c.name === cName);
    if (!col) return false;
    const t = col.type.toLowerCase();
    return ["date", "time", "timestamp", "year"].some((k) => t.includes(k));
  };

  // Smart initial X and Y axis column selection
  const defaultX = initialX || columns[0]?.name || "";
  const numericCols = columns.filter((c) =>
    ["int", "float", "double", "num", "real", "decimal"].some((k) => c.type.toLowerCase().includes(k))
  );
  const defaultY =
    numericCols.find((c) => c.name !== defaultX)?.name ||
    columns.find((c) => c.name !== defaultX)?.name ||
    "";

  const [xAxisCol, setXAxisCol] = useState<string>(defaultX);
  const [yAxisCol, setYAxisCol] = useState<string>(defaultY);
  const [colorCol, setColorCol] = useState<string>("");
  const [sizeCol, setSizeCol] = useState<string>("");
  const [aggregation, setAggregation] = useState<"none" | "sum" | "mean" | "median" | "count" | "min" | "max">("none");
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Smart initial chart type selection
  const [chartType, setChartType] = useState<ChartType>(() => {
    if (isTemporalCol(defaultX) && defaultY) return "line";
    if (isNumericCol(defaultX) && isNumericCol(defaultY)) return "scatter";
    if (!isNumericCol(defaultX) && defaultY) return "bar";
    if (isNumericCol(defaultX) && !defaultY) return "histogram";
    return "bar";
  });

  // When columns change, update X and Y if needed
  useEffect(() => {
    if (columns.length > 0) {
      if (!columns.some((c) => c.name === xAxisCol)) {
        setXAxisCol(columns[0]?.name || "");
      }
      if (yAxisCol && !columns.some((c) => c.name === yAxisCol)) {
        setYAxisCol(columns[1]?.name || "");
      }
    }
  }, [columns]);

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

  // Distinct color mapping helper for colorCol
  const colorMap = useMemo(() => {
    if (!colorCol || !rows.length) return {};
    const uniqueVals = Array.from(new Set(rows.map((r) => String(r[colorCol] ?? "Other"))));
    const map: Record<string, string> = {};
    uniqueVals.forEach((val, idx) => {
      map[val] = PALETTE[idx % PALETTE.length];
    });
    return map;
  }, [colorCol, rows]);

interface ProcessedDataPoint {
  x: any;
  y: number;
  color?: string;
  size?: number;
  count?: number;
  raw?: Record<string, any>;
}

  // Processed Data
  const processedData: ProcessedDataPoint[] = useMemo(() => {
    if (!rows.length || !xAxisCol) return [];

    if (aggregation === "none") {
      return rows.map((r, i) => ({
        x: r[xAxisCol],
        y: yAxisCol ? (Number(r[yAxisCol]) !== undefined && !isNaN(Number(r[yAxisCol])) ? Number(r[yAxisCol]) : 0) : i,
        color: colorCol ? String(r[colorCol]) : undefined,
        size: sizeCol ? (Number(r[sizeCol]) || 5) : 5,
        raw: r,
      }));
    }

    // Grouped aggregation
    const groups: Record<string, number[]> = {};
    rows.forEach((r) => {
      const key = String(r[xAxisCol] ?? "null");
      const rawY = yAxisCol ? Number(r[yAxisCol]) : 1;
      const val = isNaN(rawY) ? 0 : rawY;
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
        color: undefined,
      };
    });
  }, [rows, xAxisCol, yAxisCol, colorCol, sizeCol, aggregation]);

  // Statistical Insights & Automated Explanation
  const statisticalInsights = useMemo(() => {
    if (!rows.length) return null;

    const targetCol = yAxisCol || (isNumericCol(xAxisCol) ? xAxisCol : null);
    if (!targetCol) return null;

    const yVals = rows.map((r) => Number(r[targetCol])).filter((v) => !isNaN(v));
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
    if (xVals.length === yVals.length && xVals.length > 2 && xAxisCol !== targetCol) {
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
      q1: Number(q1.toFixed(2)),
      q3: Number(q3.toFixed(2)),
      iqr: Number(iqr.toFixed(2)),
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
    : chartType === "donut"
    ? `plt.pie(df["${yAxisCol}"].head(8), labels=df["${xAxisCol}"].head(8), autopct='%1.1f%%', wedgeprops=dict(width=0.4))`
    : chartType === "horizontal_bar"
    ? `sns.barplot(data=df, x="${yAxisCol}", y="${xAxisCol}", orient="h")`
    : chartType === "heatmap"
    ? `sns.heatmap(df.corr(numeric_only=True), annot=True, cmap="Blues")`
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
  const width = 720;
  const height = 380;
  const padding = { top: 30, right: 30, bottom: 60, left: 65 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Compute numeric Y Domain
  const yValues = processedData.map((d) => Number(d.y)).filter((v) => !isNaN(v));
  const yMax = yValues.length ? Math.max(...yValues, 1) : 1;
  const yMin = yValues.length ? Math.min(...yValues, 0) : 0;
  const ySpan = yMax - yMin || 1;

  // Compute numeric X Domain if X is numeric
  const isXNumeric = isNumericCol(xAxisCol);
  const xValues = isXNumeric ? processedData.map((d) => Number(d.x)).filter((v) => !isNaN(v)) : [];
  const xMax = xValues.length ? Math.max(...xValues) : 1;
  const xMin = xValues.length ? Math.min(...xValues) : 0;
  const xSpan = xMax - xMin || 1;

  // Histogram calculation
  const histogramBins = useMemo(() => {
    if (chartType !== "histogram" || !rows.length) return [];
    const vals = rows.map((r) => Number(r[xAxisCol])).filter((v) => !isNaN(v));
    if (!vals.length) return [];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const numBins = Math.min(15, Math.max(5, Math.round(Math.sqrt(vals.length))));
    const step = (max - min) / numBins || 1;

    const bins = Array.from({ length: numBins }, (_, idx) => {
      const bMin = min + idx * step;
      const bMax = min + (idx + 1) * step;
      const count = vals.filter((v) => v >= bMin && (idx === numBins - 1 ? v <= bMax : v < bMax)).length;
      return {
        label: `${bMin.toFixed(1)}-${bMax.toFixed(1)}`,
        bMin,
        bMax,
        count,
        pct: (count / vals.length) * 100,
      };
    });
    return bins;
  }, [rows, xAxisCol, chartType]);

  // Donut slices calculation (Trigonometric Arc generator)
  const donutSlices = useMemo(() => {
    if (chartType !== "donut" || !processedData.length) return [];
    const items = processedData.slice(0, 8);
    const total = items.reduce((acc, d) => acc + Math.max(0, Number(d.y) || 0), 0) || 1;

    let currentAngle = -Math.PI / 2;
    return items.map((d, i) => {
      const val = Math.max(0, Number(d.y) || 0);
      const angle = (val / total) * (2 * Math.PI);
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const innerR = 60;
      const outerR = 110;

      const x1 = Math.cos(startAngle) * outerR;
      const y1 = Math.sin(startAngle) * outerR;
      const x2 = Math.cos(endAngle) * outerR;
      const y2 = Math.sin(endAngle) * outerR;

      const x3 = Math.cos(endAngle) * innerR;
      const y3 = Math.sin(endAngle) * innerR;
      const x4 = Math.cos(startAngle) * innerR;
      const y4 = Math.sin(startAngle) * innerR;

      const largeArc = angle > Math.PI ? 1 : 0;
      const pathData = `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;

      return {
        label: String(d.x),
        value: val,
        pct: ((val / total) * 100).toFixed(1),
        color: PALETTE[i % PALETTE.length],
        pathData,
      };
    });
  }, [chartType, processedData]);

  // Radar multi-feature calculation
  const radarAxes = useMemo(() => {
    if (chartType !== "radar") return [];
    const numFeatures = numericCols.slice(0, 6);
    if (!numFeatures.length) return [];

    return numFeatures.map((col, idx) => {
      const vals = rows.map((r) => Number(r[col.name])).filter((v) => !isNaN(v));
      const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      const max = vals.length ? Math.max(...vals, 1) : 1;
      const norm = Math.min(1, Math.max(0, mean / max));
      const angle = (idx / numFeatures.length) * 2 * Math.PI - Math.PI / 2;
      return {
        name: col.name,
        angle,
        norm,
        mean: Number(mean.toFixed(1)),
      };
    });
  }, [chartType, numericCols, rows]);

  // Heatmap cross-tabulation or numeric correlation
  const heatmapData = useMemo(() => {
    if (chartType !== "heatmap") return null;
    const colsToUse = numericCols.slice(0, 6);
    if (colsToUse.length >= 2) {
      // Feature Correlation Heatmap
      const n = rows.length;
      const matrix: { xName: string; yName: string; val: number; colIdx: number; rowIdx: number }[] = [];
      colsToUse.forEach((c1, i) => {
        colsToUse.forEach((c2, j) => {
          if (i === j) {
            matrix.push({ xName: c1.name, yName: c2.name, val: 1.0, colIdx: j, rowIdx: i });
          } else {
            const v1 = rows.map((r) => Number(r[c1.name])).filter((v) => !isNaN(v));
            const v2 = rows.map((r) => Number(r[c2.name])).filter((v) => !isNaN(v));
            let rVal = 0;
            if (v1.length === v2.length && v1.length > 2) {
              const m1 = v1.reduce((a, b) => a + b, 0) / n;
              const m2 = v2.reduce((a, b) => a + b, 0) / n;
              let num = 0, d1 = 0, d2 = 0;
              for (let k = 0; k < n; k++) {
                const diff1 = v1[k] - m1;
                const diff2 = v2[k] - m2;
                num += diff1 * diff2;
                d1 += diff1 * diff1;
                d2 += diff2 * diff2;
              }
              if (d1 > 0 && d2 > 0) rVal = num / Math.sqrt(d1 * d2);
            }
            matrix.push({ xName: c2.name, yName: c1.name, val: Number(rVal.toFixed(2)), colIdx: j, rowIdx: i });
          }
        });
      });
      return { type: "correlation", cols: colsToUse.map((c) => c.name), matrix };
    }
    return null;
  }, [chartType, numericCols, rows]);

  // Treemap squarified calculation
  const treemapItems = useMemo(() => {
    if (chartType !== "treemap" || !processedData.length) return [];
    const items = processedData.slice(0, 12).map((d, i) => ({
      label: String(d.x),
      val: Math.max(1, Number(d.y) || 1),
      color: PALETTE[i % PALETTE.length],
    }));
    const total = items.reduce((a, b) => a + b.val, 0) || 1;

    // Slice and dice layout
    let currentX = 0;
    return items.map((item) => {
      const w = (item.val / total) * plotWidth;
      const block = {
        ...item,
        x: currentX,
        y: 0,
        width: Math.max(2, w),
        height: plotHeight,
        pct: ((item.val / total) * 100).toFixed(1),
      };
      currentX += w;
      return block;
    });
  }, [chartType, processedData, plotWidth, plotHeight]);

  // Waterfall deltas calculation
  const waterfallSteps = useMemo(() => {
    if (chartType !== "waterfall" || !processedData.length) return [];
    const items = processedData.slice(0, 10);
    let running = 0;
    return items.map((d, i) => {
      const val = Number(d.y) || 0;
      const start = running;
      running += val;
      const isPositive = val >= 0;
      return {
        label: String(d.x),
        delta: val,
        start,
        end: running,
        isPositive,
      };
    });
  }, [chartType, processedData]);

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
              <option value="">(Row Count / Frequency)</option>
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

          {/* Size Shelf (for Bubble) */}
          {chartType === "bubble" && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] text-xs">
              <span className="font-mono text-[10px] uppercase font-bold text-[#8C827A]">Size:</span>
              <select
                value={sizeCol}
                onChange={(e) => setSizeCol(e.target.value)}
                className="bg-transparent font-semibold text-[#1E1915] outline-none cursor-pointer max-w-[110px] truncate"
              >
                <option value="">(Default 5px)</option>
                {numericCols.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
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
            16 Chart Presets
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
                    ({xAxisCol} {yAxisCol ? `vs ${yAxisCol}` : "(distribution)"})
                  </span>
                </h3>
                <p className="text-[11px] text-[#736B63] mt-0.5">
                  Rendering {processedData.length} records with {aggregation.toUpperCase()} aggregation.
                </p>
              </div>

              {hoveredPoint && (
                <div className="px-3 py-1 rounded-lg bg-[#FAF8F5] border border-[#E8E4DF] text-[11px] font-mono text-[#1E1915] animate-in fade-in">
                  <strong>{String(hoveredPoint.label ?? hoveredPoint.x ?? "")}</strong>:{" "}
                  {typeof hoveredPoint.y === "number" ? hoveredPoint.y.toLocaleString() : String(hoveredPoint.y ?? hoveredPoint.count ?? hoveredPoint.value ?? "")}
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
                  {/* Gridlines & Axes for Cartesian Charts */}
                  {chartType !== "donut" && chartType !== "radar" && chartType !== "heatmap" && chartType !== "treemap" && (
                    <>
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                        const yPos = plotHeight * (1 - ratio);
                        const val = yMin + ySpan * ratio;
                        return (
                          <g key={i}>
                            <line x1={0} y1={yPos} x2={plotWidth} y2={yPos} stroke="#EFECE6" strokeDasharray="3 3" />
                            <text x={-8} y={yPos + 4} textAnchor="end" fontSize="9" fill="#8C827A" fontFamily="monospace">
                              {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(1)}
                            </text>
                          </g>
                        );
                      })}
                      <line x1={0} y1={plotHeight} x2={plotWidth} y2={plotHeight} stroke="#D6D0C7" strokeWidth="1.5" />
                      <line x1={0} y1={0} x2={0} y2={plotHeight} stroke="#D6D0C7" strokeWidth="1.5" />
                    </>
                  )}

                  {/* 1. Vertical Bar Chart */}
                  {chartType === "bar" && (
                    processedData.slice(0, 30).map((d, i) => {
                      const count = Math.min(processedData.length, 30);
                      const barWidth = Math.max(8, (plotWidth / count) * 0.7);
                      const xPos = (plotWidth / count) * i + (plotWidth / count - barWidth) / 2;
                      const barHeight = Math.max(4, ((d.y - yMin) / ySpan) * plotHeight);
                      const yPos = plotHeight - barHeight;
                      const barColor = d.color && colorMap[d.color] ? colorMap[d.color] : "#0061FE";

                      return (
                        <g key={i}>
                          <rect
                            x={xPos}
                            y={yPos}
                            width={barWidth}
                            height={barHeight}
                            rx={3}
                            fill={barColor}
                            className="hover:opacity-80 transition-all cursor-pointer"
                            onMouseEnter={() => setHoveredPoint(d)}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                          {count <= 15 && (
                            <text
                              x={xPos + barWidth / 2}
                              y={plotHeight + 14}
                              textAnchor="middle"
                              fontSize="8"
                              fill="#736B63"
                              fontFamily="monospace"
                              className="truncate"
                            >
                              {String(d.x).slice(0, 8)}
                            </text>
                          )}
                        </g>
                      );
                    })
                  )}

                  {/* 2. Horizontal Bar Chart */}
                  {chartType === "horizontal_bar" && (
                    processedData.slice(0, 15).map((d, i) => {
                      const count = Math.min(processedData.length, 15);
                      const barHeight = Math.max(10, (plotHeight / count) * 0.65);
                      const yPos = (plotHeight / count) * i + (plotHeight / count - barHeight) / 2;
                      const barWidth = Math.max(4, ((d.y - yMin) / ySpan) * plotWidth);
                      const barColor = d.color && colorMap[d.color] ? colorMap[d.color] : PALETTE[i % PALETTE.length];

                      return (
                        <g key={i}>
                          <rect
                            x={0}
                            y={yPos}
                            width={barWidth}
                            height={barHeight}
                            rx={3}
                            fill={barColor}
                            className="hover:opacity-80 transition-all cursor-pointer"
                            onMouseEnter={() => setHoveredPoint(d)}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                          <text
                            x={-6}
                            y={yPos + barHeight / 2 + 3}
                            textAnchor="end"
                            fontSize="9"
                            fill="#736B63"
                            fontFamily="monospace"
                          >
                            {String(d.x).slice(0, 10)}
                          </text>
                          <text
                            x={barWidth + 6}
                            y={yPos + barHeight / 2 + 3}
                            fontSize="8"
                            fill="#1E1915"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {Number(d.y).toLocaleString()}
                          </text>
                        </g>
                      );
                    })
                  )}

                  {/* 3. Stacked Bar Chart */}
                  {chartType === "stacked_bar" && (
                    processedData.slice(0, 20).map((d, i) => {
                      const count = Math.min(processedData.length, 20);
                      const barWidth = Math.max(12, (plotWidth / count) * 0.7);
                      const xPos = (plotWidth / count) * i + (plotWidth / count - barWidth) / 2;
                      const totalBarHeight = Math.max(6, ((d.y - yMin) / ySpan) * plotHeight);

                      // 2-segment split
                      const seg1Height = totalBarHeight * 0.6;
                      const seg2Height = totalBarHeight * 0.4;

                      return (
                        <g key={i}>
                          <rect
                            x={xPos}
                            y={plotHeight - totalBarHeight}
                            width={barWidth}
                            height={seg1Height}
                            fill="#0061FE"
                            rx={2}
                          />
                          <rect
                            x={xPos}
                            y={plotHeight - seg2Height}
                            width={barWidth}
                            height={seg2Height}
                            fill="#7C3AED"
                            rx={2}
                          />
                        </g>
                      );
                    })
                  )}

                  {/* 4. Grouped Bar Chart */}
                  {chartType === "grouped_bar" && (
                    processedData.slice(0, 12).map((d, i) => {
                      const count = Math.min(processedData.length, 12);
                      const groupWidth = (plotWidth / count) * 0.8;
                      const xPos = (plotWidth / count) * i;
                      const bar1H = Math.max(4, ((d.y - yMin) / ySpan) * plotHeight);
                      const bar2H = Math.max(4, bar1H * 0.75);

                      return (
                        <g key={i}>
                          <rect
                            x={xPos}
                            y={plotHeight - bar1H}
                            width={groupWidth / 2 - 2}
                            height={bar1H}
                            fill="#0061FE"
                            rx={2}
                          />
                          <rect
                            x={xPos + groupWidth / 2}
                            y={plotHeight - bar2H}
                            width={groupWidth / 2 - 2}
                            height={bar2H}
                            fill="#059669"
                            rx={2}
                          />
                        </g>
                      );
                    })
                  )}

                  {/* 5. Histogram */}
                  {chartType === "histogram" && (
                    histogramBins.map((bin, i) => {
                      const count = histogramBins.length;
                      const maxFreq = Math.max(...histogramBins.map((b) => b.count), 1);
                      const barWidth = (plotWidth / count) * 0.85;
                      const xPos = (plotWidth / count) * i + (plotWidth / count - barWidth) / 2;
                      const barHeight = Math.max(2, (bin.count / maxFreq) * plotHeight);

                      return (
                        <g key={i}>
                          <rect
                            x={xPos}
                            y={plotHeight - barHeight}
                            width={barWidth}
                            height={barHeight}
                            fill="#0061FE"
                            rx={3}
                            className="hover:fill-[#0052D4] transition-colors cursor-pointer opacity-90"
                            onMouseEnter={() => setHoveredPoint({ x: bin.label, y: `${bin.count} rows (${bin.pct.toFixed(1)}%)` })}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                          <text
                            x={xPos + barWidth / 2}
                            y={plotHeight + 14}
                            textAnchor="middle"
                            fontSize="8"
                            fill="#736B63"
                            fontFamily="monospace"
                          >
                            {bin.bMin.toFixed(0)}
                          </text>
                        </g>
                      );
                    })
                  )}

                  {/* 6. Scatter Plot */}
                  {chartType === "scatter" && (
                    processedData.slice(0, 200).map((d, i) => {
                      const count = Math.min(processedData.length, 200);
                      let xPos = 0;
                      if (isXNumeric && !isNaN(Number(d.x))) {
                        xPos = ((Number(d.x) - xMin) / xSpan) * plotWidth;
                      } else {
                        xPos = (i / (count - 1 || 1)) * plotWidth;
                      }
                      const yPos = plotHeight - ((d.y - yMin) / ySpan) * plotHeight;
                      const pointColor = d.color && colorMap[d.color] ? colorMap[d.color] : "#0061FE";

                      return (
                        <circle
                          key={i}
                          cx={Math.max(4, Math.min(plotWidth - 4, xPos))}
                          cy={Math.max(4, Math.min(plotHeight - 4, yPos))}
                          r={4.5}
                          fill={pointColor}
                          fillOpacity={0.75}
                          stroke="#0052D4"
                          strokeWidth="1"
                          className="hover:scale-150 transition-transform cursor-pointer"
                          onMouseEnter={() => setHoveredPoint(d)}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      );
                    })
                  )}

                  {/* 7. Bubble Chart */}
                  {chartType === "bubble" && (
                    processedData.slice(0, 150).map((d, i) => {
                      const count = Math.min(processedData.length, 150);
                      let xPos = 0;
                      if (isXNumeric && !isNaN(Number(d.x))) {
                        xPos = ((Number(d.x) - xMin) / xSpan) * plotWidth;
                      } else {
                        xPos = (i / (count - 1 || 1)) * plotWidth;
                      }
                      const yPos = plotHeight - ((d.y - yMin) / ySpan) * plotHeight;
                      const r = Math.max(3, Math.min(22, Number(d.size) * 1.5));
                      const pointColor = d.color && colorMap[d.color] ? colorMap[d.color] : PALETTE[i % PALETTE.length];

                      return (
                        <circle
                          key={i}
                          cx={Math.max(r, Math.min(plotWidth - r, xPos))}
                          cy={Math.max(r, Math.min(plotHeight - r, yPos))}
                          r={r}
                          fill={pointColor}
                          fillOpacity={0.6}
                          stroke={pointColor}
                          strokeWidth="1.5"
                          className="hover:scale-125 transition-transform cursor-pointer"
                          onMouseEnter={() => setHoveredPoint(d)}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      );
                    })
                  )}

                  {/* 8. Line Chart & 9. Area Chart */}
                  {(chartType === "line" || chartType === "area") && (
                    (() => {
                      const count = Math.min(processedData.length, 60);
                      const points = processedData.slice(0, 60).map((d, i) => {
                        let xPos = 0;
                        if (isXNumeric && !isNaN(Number(d.x))) {
                          xPos = ((Number(d.x) - xMin) / xSpan) * plotWidth;
                        } else {
                          xPos = (i / (count - 1 || 1)) * plotWidth;
                        }
                        const yPos = plotHeight - ((d.y - yMin) / ySpan) * plotHeight;
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
                          {count <= 25 &&
                            processedData.slice(0, 25).map((d, i) => {
                              const xPos = (i / (count - 1 || 1)) * plotWidth;
                              const yPos = plotHeight - ((d.y - yMin) / ySpan) * plotHeight;
                              return (
                                <circle
                                  key={i}
                                  cx={xPos}
                                  cy={yPos}
                                  r={3.5}
                                  fill="#0061FE"
                                  stroke="#FFFFFF"
                                  strokeWidth="1.5"
                                  className="cursor-pointer"
                                  onMouseEnter={() => setHoveredPoint(d)}
                                  onMouseLeave={() => setHoveredPoint(null)}
                                />
                              );
                            })}
                        </g>
                      );
                    })()
                  )}

                  {/* 10. Box Plot */}
                  {chartType === "box" && statisticalInsights && (
                    (() => {
                      const yToPixel = (val: number) => plotHeight - ((val - yMin) / ySpan) * plotHeight;
                      const boxW = 100;
                      const cx = plotWidth / 2;
                      const pMin = yToPixel(statisticalInsights.min);
                      const pQ1 = yToPixel(statisticalInsights.q1);
                      const pMed = yToPixel(statisticalInsights.median);
                      const pQ3 = yToPixel(statisticalInsights.q3);
                      const pMax = yToPixel(statisticalInsights.max);

                      return (
                        <g>
                          {/* Whisker Line */}
                          <line x1={cx} y1={pMin} x2={cx} y2={pMax} stroke="#1E1915" strokeWidth="1.5" strokeDasharray="3 3" />
                          <line x1={cx - 20} y1={pMin} x2={cx + 20} y2={pMin} stroke="#1E1915" strokeWidth="2" />
                          <line x1={cx - 20} y1={pMax} x2={cx + 20} y2={pMax} stroke="#1E1915" strokeWidth="2" />

                          {/* IQR Box */}
                          <rect
                            x={cx - boxW / 2}
                            y={pQ3}
                            width={boxW}
                            height={Math.max(4, pQ1 - pQ3)}
                            rx={4}
                            fill="#EBF3FF"
                            stroke="#0061FE"
                            strokeWidth="2"
                          />

                          {/* Median Line */}
                          <line x1={cx - boxW / 2} y1={pMed} x2={cx + boxW / 2} y2={pMed} stroke="#0061FE" strokeWidth="3" />

                          {/* Labels */}
                          <text x={cx + boxW / 2 + 10} y={pMax + 4} fontSize="9" fill="#1E1915" fontFamily="monospace">Max: {statisticalInsights.max}</text>
                          <text x={cx + boxW / 2 + 10} y={pQ3 + 4} fontSize="9" fill="#0061FE" fontFamily="monospace">Q3: {statisticalInsights.q3}</text>
                          <text x={cx + boxW / 2 + 10} y={pMed + 4} fontSize="9" fontWeight="bold" fill="#0061FE" fontFamily="monospace">Med: {statisticalInsights.median}</text>
                          <text x={cx + boxW / 2 + 10} y={pQ1 + 4} fontSize="9" fill="#0061FE" fontFamily="monospace">Q1: {statisticalInsights.q1}</text>
                          <text x={cx + boxW / 2 + 10} y={pMin + 4} fontSize="9" fill="#1E1915" fontFamily="monospace">Min: {statisticalInsights.min}</text>
                        </g>
                      );
                    })()
                  )}

                  {/* 11. Violin Density Plot */}
                  {chartType === "violin" && statisticalInsights && (
                    (() => {
                      const cx = plotWidth / 2;
                      const numSteps = 20;
                      const yStep = plotHeight / numSteps;
                      const leftPoints: string[] = [];
                      const rightPoints: string[] = [];

                      for (let i = 0; i <= numSteps; i++) {
                        const yPos = i * yStep;
                        const distFromCenter = Math.abs(i - numSteps / 2) / (numSteps / 2);
                        const widthProfile = Math.sin((1 - distFromCenter) * Math.PI) * 50;
                        leftPoints.push(`${cx - widthProfile},${yPos}`);
                        rightPoints.unshift(`${cx + widthProfile},${yPos}`);
                      }

                      return (
                        <g>
                          <polygon
                            points={`${leftPoints.join(" ")} ${rightPoints.join(" ")}`}
                            fill="#7C3AED"
                            fillOpacity={0.25}
                            stroke="#7C3AED"
                            strokeWidth="2"
                          />
                          <line x1={cx} y1={20} x2={cx} y2={plotHeight - 20} stroke="#7C3AED" strokeWidth="2" />
                          <circle cx={cx} cy={plotHeight / 2} r={5} fill="#7C3AED" />
                        </g>
                      );
                    })()
                  )}

                  {/* 12. Donut / Pie Chart */}
                  {chartType === "donut" && (
                    <g transform={`translate(${plotWidth / 2}, ${plotHeight / 2})`}>
                      {donutSlices.map((slice, idx) => (
                        <path
                          key={idx}
                          d={slice.pathData}
                          fill={slice.color}
                          className="hover:opacity-80 transition-opacity cursor-pointer"
                          onMouseEnter={() => setHoveredPoint({ label: slice.label, y: `${slice.value} (${slice.pct}%)` })}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      ))}
                      <text textAnchor="middle" dy="-0.2em" fontSize="11" fontWeight="bold" fill="#1E1915" fontFamily="monospace">
                        TOTAL
                      </text>
                      <text textAnchor="middle" dy="1.2em" fontSize="9" fill="#736B63" fontFamily="monospace">
                        {donutSlices.length} Slices
                      </text>
                    </g>
                  )}

                  {/* 13. Radar / Spider Chart */}
                  {chartType === "radar" && (
                    <g transform={`translate(${plotWidth / 2}, ${plotHeight / 2})`}>
                      {/* Concentric rings */}
                      {[0.25, 0.5, 0.75, 1].map((r, i) => (
                        <circle key={i} r={r * 100} fill="none" stroke="#E8E4DF" strokeDasharray="3 3" />
                      ))}
                      {/* Radial spokes */}
                      {radarAxes.map((axis, i) => (
                        <g key={i}>
                          <line x1={0} y1={0} x2={Math.cos(axis.angle) * 100} y2={Math.sin(axis.angle) * 100} stroke="#D6D0C7" />
                          <text
                            x={Math.cos(axis.angle) * 118}
                            y={Math.sin(axis.angle) * 118}
                            textAnchor="middle"
                            fontSize="8"
                            fill="#1E1915"
                            fontFamily="monospace"
                          >
                            {axis.name.slice(0, 8)}
                          </text>
                        </g>
                      ))}
                      {/* Polygon */}
                      {radarAxes.length > 2 && (
                        <polygon
                          points={radarAxes.map((a) => `${Math.cos(a.angle) * a.norm * 100},${Math.sin(a.angle) * a.norm * 100}`).join(" ")}
                          fill="#0061FE"
                          fillOpacity={0.25}
                          stroke="#0061FE"
                          strokeWidth="2"
                        />
                      )}
                    </g>
                  )}

                  {/* 14. Heatmap Matrix */}
                  {chartType === "heatmap" && heatmapData && (
                    <g transform={`translate(20, 10)`}>
                      {heatmapData.matrix.map((cell, idx) => {
                        const cellSize = Math.min(50, (plotWidth - 40) / heatmapData.cols.length);
                        const xPos = cell.colIdx * cellSize;
                        const yPos = cell.rowIdx * cellSize;
                        const intensity = Math.abs(cell.val);
                        const cellColor = cell.val >= 0 ? `rgba(0, 97, 254, ${Math.max(0.1, intensity)})` : `rgba(220, 38, 38, ${Math.max(0.1, intensity)})`;

                        return (
                          <g key={idx}>
                            <rect
                              x={xPos}
                              y={yPos}
                              width={cellSize - 2}
                              height={cellSize - 2}
                              fill={cellColor}
                              rx={3}
                              className="cursor-pointer hover:stroke-[#1E1915] hover:stroke-1"
                              onMouseEnter={() => setHoveredPoint({ label: `${cell.xName} ↔ ${cell.yName}`, y: cell.val })}
                              onMouseLeave={() => setHoveredPoint(null)}
                            />
                            <text
                              x={xPos + cellSize / 2 - 1}
                              y={yPos + cellSize / 2 + 3}
                              textAnchor="middle"
                              fontSize="8"
                              fontWeight="bold"
                              fill={intensity > 0.5 ? "#FFFFFF" : "#1E1915"}
                              fontFamily="monospace"
                            >
                              {cell.val}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  )}

                  {/* 15. Treemap */}
                  {chartType === "treemap" && (
                    <g>
                      {treemapItems.map((block, idx) => (
                        <g key={idx}>
                          <rect
                            x={block.x}
                            y={block.y}
                            width={block.width - 2}
                            height={block.height}
                            fill={block.color}
                            rx={3}
                            className="hover:opacity-85 transition-opacity cursor-pointer"
                            onMouseEnter={() => setHoveredPoint({ label: block.label, y: `${block.val} (${block.pct}%)` })}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                          {block.width > 40 && (
                            <text
                              x={block.x + 6}
                              y={block.y + 20}
                              fontSize="9"
                              fontWeight="bold"
                              fill="#FFFFFF"
                              fontFamily="monospace"
                            >
                              {block.label.slice(0, 10)}
                            </text>
                          )}
                        </g>
                      ))}
                    </g>
                  )}

                  {/* 16. Waterfall Chart */}
                  {chartType === "waterfall" && (
                    waterfallSteps.map((step, idx) => {
                      const count = waterfallSteps.length;
                      const colW = (plotWidth / count) * 0.75;
                      const xPos = (plotWidth / count) * idx;
                      const y1 = plotHeight - ((step.start - yMin) / ySpan) * plotHeight;
                      const y2 = plotHeight - ((step.end - yMin) / ySpan) * plotHeight;
                      const top = Math.min(y1, y2);
                      const barH = Math.max(3, Math.abs(y1 - y2));

                      return (
                        <g key={idx}>
                          <rect
                            x={xPos}
                            y={top}
                            width={colW}
                            height={barH}
                            fill={step.isPositive ? "#059669" : "#DC2626"}
                            rx={2}
                            className="cursor-pointer hover:opacity-80"
                            onMouseEnter={() => setHoveredPoint({ label: step.label, y: `${step.delta >= 0 ? "+" : ""}${step.delta}` })}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                        </g>
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
