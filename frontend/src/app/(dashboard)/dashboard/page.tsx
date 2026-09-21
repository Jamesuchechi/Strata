"use client";

import React, { useState } from "react";
import {
  FileSpreadsheet,
  Database,
  Code2,
  Table as TableIcon,
  BarChart3,
  SlidersHorizontal,
  Download,
  Filter,
  ArrowUpDown,
  Search,
  Plus,
  GitBranch,
  Sparkles,
  Check,
  ChevronDown,
} from "lucide-react";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("orders_q3");
  const [viewMode, setViewMode] = useState<"grid" | "schema" | "profiler" | "charts">("grid");
  const [activeSheet, setActiveSheet] = useState("Transactions");
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedColumn, setSelectedColumn] = useState<string>("revenue_usd");

  const tabs = [
    { id: "orders_q3", title: "orders_q3_2026.xlsx", type: "excel" },
    { id: "telecom_churn", title: "telecom_churn.parquet", type: "parquet" },
    { id: "sql_cohort", title: "SQL: Top Cohorts", type: "sql" },
  ];

  const sheets = ["Summary", "Transactions", "COGS", "Assumptions"];

  const columns = [
    { name: "order_id", type: "INT64", pii: false },
    { name: "customer_name", type: "VARCHAR", pii: true },
    { name: "transaction_date", type: "TIMESTAMP", pii: false },
    { name: "sku_category", type: "VARCHAR", pii: false },
    { name: "quantity", type: "INT32", pii: false },
    { name: "unit_price", type: "DOUBLE", pii: false },
    { name: "revenue_usd", type: "DOUBLE", pii: false },
    { name: "payment_status", type: "VARCHAR", pii: false },
    { name: "delivery_state", type: "VARCHAR", pii: false },
  ];

  const mockRows = [
    {
      order_id: 104291,
      customer_name: "Eleanor Vance",
      transaction_date: "2026-09-14 14:22:01",
      sku_category: "Cloud Compute",
      quantity: 4,
      unit_price: 340.0,
      revenue_usd: 1360.0,
      payment_status: "COMPLETED",
      delivery_state: "CA",
    },
    {
      order_id: 104292,
      customer_name: "Marcus Thorne",
      transaction_date: "2026-09-14 14:25:34",
      sku_category: "GPU Clusters",
      quantity: 2,
      unit_price: 2400.0,
      revenue_usd: 4800.0,
      payment_status: "COMPLETED",
      delivery_state: "NY",
    },
    {
      order_id: 104293,
      customer_name: "Sophia Sterling",
      transaction_date: "2026-09-14 14:29:10",
      sku_category: "Storage Volume",
      quantity: 12,
      unit_price: 45.5,
      revenue_usd: 546.0,
      payment_status: "SETTLED",
      delivery_state: "TX",
    },
    {
      order_id: 104294,
      customer_name: "Liam O'Connor",
      transaction_date: "2026-09-14 14:31:45",
      sku_category: "Edge Analytics",
      quantity: 1,
      unit_price: 890.0,
      revenue_usd: 890.0,
      payment_status: "COMPLETED",
      delivery_state: "WA",
    },
    {
      order_id: 104295,
      customer_name: "Aria Montgomery",
      transaction_date: "2026-09-14 14:38:22",
      sku_category: "Cloud Compute",
      quantity: 8,
      unit_price: 340.0,
      revenue_usd: 2720.0,
      payment_status: "COMPLETED",
      delivery_state: "IL",
    },
    {
      order_id: 104296,
      customer_name: "Devon Chen",
      transaction_date: "2026-09-14 14:41:09",
      sku_category: "GPU Clusters",
      quantity: 1,
      unit_price: 2400.0,
      revenue_usd: 2400.0,
      payment_status: "PENDING",
      delivery_state: "MA",
    },
    {
      order_id: 104297,
      customer_name: "Maya Lin",
      transaction_date: "2026-09-14 14:45:50",
      sku_category: "Storage Volume",
      quantity: 20,
      unit_price: 45.5,
      revenue_usd: 910.0,
      payment_status: "COMPLETED",
      delivery_state: "CO",
    },
    {
      order_id: 104298,
      customer_name: "Julian Rivera",
      transaction_date: "2026-09-14 14:50:18",
      sku_category: "Edge Analytics",
      quantity: 3,
      unit_price: 890.0,
      revenue_usd: 2670.0,
      payment_status: "COMPLETED",
      delivery_state: "FL",
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF8F5]">
      {/* 1. Editor Tab Bar */}
      <div className="flex items-center justify-between border-b border-[#E8E4DF] bg-[#EFECE6]/50 px-3 pt-2">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-t-xl text-xs font-semibold cursor-pointer border-t border-x transition-all ${
                  isActive
                    ? "bg-[#FAF8F5] border-[#E8E4DF] text-[#1E1915] shadow-2xs"
                    : "border-transparent text-[#736B63] hover:text-[#1E1915] hover:bg-white/40"
                }`}
              >
                {tab.type === "excel" && <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />}
                {tab.type === "parquet" && <Database className="w-3.5 h-3.5 text-[#0061FE]" />}
                {tab.type === "sql" && <Code2 className="w-3.5 h-3.5 text-amber-600" />}
                <span>{tab.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    alert(`Closed ${tab.title}`);
                  }}
                  className="w-4 h-4 rounded hover:bg-[#E8E4DF] flex items-center justify-center text-[10px] text-[#8C827A]"
                >
                  ×
                </button>
              </div>
            );
          })}

          <button
            onClick={() => alert("Open new dataset tab")}
            className="p-1 rounded-lg hover:bg-[#EFECE6] text-[#736B63] text-xs font-semibold ml-1"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Toolbar Actions */}
        <div className="flex items-center gap-2 pb-1.5">
          <button
            onClick={() => alert("Creating dataset version snapshot...")}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#E8E4DF] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] shadow-2xs"
          >
            <GitBranch className="w-3 h-3 text-[#0061FE]" />
            <span>Snapshot</span>
          </button>
          <button
            onClick={() => alert("Exporting Parquet...")}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#E8E4DF] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] shadow-2xs"
          >
            <Download className="w-3 h-3 text-[#5C554D]" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* 2. Canvas Sub-Toolbar: View Switcher & Filters */}
      <div className="p-3 border-b border-[#E8E4DF] bg-white flex flex-wrap items-center justify-between gap-3 select-none">
        {/* View Switcher (Grid vs Schema vs Profiler vs Charts) */}
        <div className="flex p-1 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] text-xs font-semibold">
          {[
            { id: "grid", label: "Data Grid", icon: <TableIcon className="w-3.5 h-3.5" /> },
            { id: "schema", label: "Schema", icon: <Code2 className="w-3.5 h-3.5" /> },
            { id: "profiler", label: "Profiler", icon: <BarChart3 className="w-3.5 h-3.5" /> },
            { id: "charts", label: "Visualizer", icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setViewMode(mode.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                viewMode === mode.id
                  ? "bg-white text-[#0061FE] font-bold shadow-2xs border border-[#E8E4DF]"
                  : "text-[#736B63] hover:text-[#1E1915]"
              }`}
            >
              {mode.icon}
              <span>{mode.label}</span>
            </button>
          ))}
        </div>

        {/* Filter & Search Bar */}
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-[#8C827A] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter rows (e.g. quantity > 5)..."
              className="w-full bg-[#FAF8F5] border border-[#E8E4DF] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#1E1915] focus:bg-white focus:outline-none focus:border-[#0061FE]"
            />
          </div>
        </div>

        {/* Dataset Stats */}
        <div className="flex items-center gap-3 text-xs font-mono text-[#736B63]">
          <span>84,200 rows</span>
          <span>·</span>
          <span>14 cols</span>
          <span>·</span>
          <span className="text-emerald-700 font-semibold">DuckDB 8.4ms</span>
        </div>
      </div>

      {/* 3. Main Content: Virtualized Data Grid */}
      <div className="flex-1 overflow-auto bg-white">
        {viewMode === "grid" && (
          <table className="w-full border-collapse text-left text-xs font-mono">
            {/* Table Header */}
            <thead>
              <tr className="border-b border-[#E8E4DF] bg-[#FAF8F5] sticky top-0 z-10">
                <th className="py-2.5 px-3 text-[#8C827A] font-semibold border-r border-[#E8E4DF] w-12 text-center">
                  #
                </th>
                {columns.map((col) => {
                  const isSelected = selectedColumn === col.name;
                  return (
                    <th
                      key={col.name}
                      onClick={() => setSelectedColumn(col.name)}
                      className={`py-2.5 px-3 border-r border-[#E8E4DF] cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-[#0061FE]/10 text-[#0061FE] font-bold"
                          : "hover:bg-[#EFECE6] text-[#1E1915]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{col.name}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-white border border-[#D6D0C7] text-[#736B63]">
                            {col.type}
                          </span>
                          <ArrowUpDown className="w-3 h-3 text-[#8C827A]" />
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-[#E8E4DF]/60">
              {mockRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-[#0061FE]/[0.03] transition-colors">
                  <td className="py-2 px-3 text-[#8C827A] border-r border-[#E8E4DF] text-center font-semibold bg-[#FAF8F5]/50">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3 border-r border-[#E8E4DF] font-bold text-[#1E1915]">
                    {row.order_id}
                  </td>
                  <td className="py-2 px-3 border-r border-[#E8E4DF] text-[#1E1915]">
                    {row.customer_name}
                  </td>
                  <td className="py-2 px-3 border-r border-[#E8E4DF] text-[#5C554D]">
                    {row.transaction_date}
                  </td>
                  <td className="py-2 px-3 border-r border-[#E8E4DF] text-[#1E1915]">
                    {row.sku_category}
                  </td>
                  <td className="py-2 px-3 border-r border-[#E8E4DF] text-right text-[#1E1915]">
                    {row.quantity}
                  </td>
                  <td className="py-2 px-3 border-r border-[#E8E4DF] text-right font-semibold text-[#1E1915]">
                    ${row.unit_price.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 border-r border-[#E8E4DF] text-right font-bold text-emerald-700 bg-emerald-50/30">
                    ${row.revenue_usd.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 border-r border-[#E8E4DF]">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-800 text-[10px] font-bold">
                      {row.payment_status}
                    </span>
                  </td>
                  <td className="py-2 px-3 border-r border-[#E8E4DF] text-center font-bold text-[#1E1915]">
                    {row.delivery_state}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Schema View */}
        {viewMode === "schema" && (
          <div className="p-6 max-w-4xl space-y-4">
            <h3 className="font-serif text-lg font-bold text-[#1E1915]">Table Schema & Constraints</h3>
            <div className="rounded-2xl border border-[#E8E4DF] overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#FAF8F5] border-b border-[#E8E4DF]">
                  <tr>
                    <th className="p-3">Column Name</th>
                    <th className="p-3">DuckDB Type</th>
                    <th className="p-3">Nullable</th>
                    <th className="p-3">Compliance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E4DF]">
                  {columns.map((col) => (
                    <tr key={col.name} className="hover:bg-[#FAF8F5]">
                      <td className="p-3 font-bold text-[#1E1915]">{col.name}</td>
                      <td className="p-3 text-[#0061FE]">{col.type}</td>
                      <td className="p-3 text-[#736B63]">YES</td>
                      <td className="p-3">
                        {col.pii ? (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">
                            PII (Name)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                            Safe
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Profiler View */}
        {viewMode === "profiler" && (
          <div className="p-6 max-w-4xl space-y-6">
            <h3 className="font-serif text-lg font-bold text-[#1E1915]">Automated Dataset Profiler</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8E4DF] space-y-1">
                <span className="text-xs text-[#736B63]">Total Volume</span>
                <div className="text-2xl font-bold font-serif text-[#1E1915]">84,200 Rows</div>
                <span className="text-[11px] text-emerald-600">✓ 100% In-Memory Clean</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8E4DF] space-y-1">
                <span className="text-xs text-[#736B63]">Data Quality Score</span>
                <div className="text-2xl font-bold font-serif text-[#1E1915]">98.4 / 100</div>
                <span className="text-[11px] text-emerald-600">0.8% missing values</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8E4DF] space-y-1">
                <span className="text-xs text-[#736B63]">Active Memory</span>
                <div className="text-2xl font-bold font-serif text-[#1E1915]">14.2 MB</div>
                <span className="text-[11px] text-[#0061FE]">Zero cloud egress</span>
              </div>
            </div>
          </div>
        )}

        {/* Charts View */}
        {viewMode === "charts" && (
          <div className="p-6 max-w-4xl space-y-4">
            <h3 className="font-serif text-lg font-bold text-[#1E1915]">Quick Visualizations</h3>
            <div className="p-6 rounded-2xl bg-white border border-[#E8E4DF] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1E1915]">Revenue by SKU Category</span>
                <span className="text-xs font-mono text-[#736B63]">SUM(revenue_usd)</span>
              </div>
              <div className="space-y-3 pt-2">
                {[
                  { name: "GPU Clusters", val: 7200, pct: 85 },
                  { name: "Cloud Compute", val: 4080, pct: 52 },
                  { name: "Edge Analytics", val: 3560, pct: 45 },
                  { name: "Storage Volume", val: 1456, pct: 20 },
                ].map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span>{item.name}</span>
                      <span className="font-bold">${item.val.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-[#FAF8F5] h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#0061FE] h-full rounded-full transition-all duration-500"
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Bottom Multi-Sheet Switcher Bar (For Excel & Workbooks) */}
      <div className="h-10 border-t border-[#E8E4DF] bg-[#FAF8F5] px-3 flex items-center justify-between select-none">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#8C827A] mr-2">
            Sheets:
          </span>
          {sheets.map((sheet) => (
            <button
              key={sheet}
              onClick={() => setActiveSheet(sheet)}
              className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
                activeSheet === sheet
                  ? "bg-white text-[#0061FE] font-bold shadow-2xs border border-[#E8E4DF]"
                  : "text-[#736B63] hover:text-[#1E1915]"
              }`}
            >
              {sheet}
            </button>
          ))}
          <button
            onClick={() => alert("Add Sheet dialog")}
            className="p-1 rounded hover:bg-[#EFECE6] text-[#736B63] ml-1"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-[11px] font-mono text-[#8C827A]">
          Cell selection: <span className="text-[#1E1915] font-bold">{selectedColumn}</span> · Press{" "}
          <kbd className="px-1 py-0.5 rounded bg-white border border-[#D6D0C7] text-[10px]">⌘I</kbd> for
          Inspector
        </div>
      </div>
    </div>
  );
}
