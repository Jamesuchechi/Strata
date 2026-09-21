"use client";

import React, { useState } from "react";
import {
  FileSpreadsheet,
  Database,
  Atom,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  GitBranch,
  ArrowRight,
  Filter,
  Sparkles,
  Zap,
  Lock,
} from "lucide-react";

interface SampleDataset {
  id: string;
  name: string;
  format: string;
  badge: string;
  icon: React.ElementType;
  sheetNames?: string[];
  stats: { rows: string; cols: string; quality: string; pii: string };
  schema: { name: string; type: string; nullPct: string }[];
  rows: Record<string, any>[];
  insight: string;
}

const SAMPLE_DATASETS: SampleDataset[] = [
  {
    id: "excel",
    name: "financial_forecast_2026.xlsx",
    format: "Excel (Multi-Sheet)",
    badge: "Spreadsheet",
    icon: FileSpreadsheet,
    sheetNames: ["Q3_Revenue", "Headcount_Plan", "SaaS_Metrics", "Assumptions"],
    stats: { rows: "4,820", cols: "8", quality: "98.5%", pii: "Clean (0 flags)" },
    schema: [
      { name: "department", type: "varchar", nullPct: "0%" },
      { name: "fiscal_quarter", type: "varchar", nullPct: "0%" },
      { name: "actual_mrr", type: "currency", nullPct: "0.2%" },
      { name: "target_mrr", type: "currency", nullPct: "0%" },
      { name: "attainment_pct", type: "percent", nullPct: "0%" },
      { name: "run_rate_arr", type: "currency", nullPct: "0.4%" },
    ],
    rows: [
      { department: "Enterprise Sales", fiscal_quarter: "2026-Q3", actual_mrr: "$482,500", target_mrr: "$450,000", attainment_pct: "107.2%", run_rate_arr: "$5,790,000" },
      { department: "Mid-Market", fiscal_quarter: "2026-Q3", actual_mrr: "$318,200", target_mrr: "$320,000", attainment_pct: "99.4%", run_rate_arr: "$3,818,400" },
      { department: "Growth / Self-Serve", fiscal_quarter: "2026-Q3", actual_mrr: "$195,400", target_mrr: "$180,000", attainment_pct: "108.5%", run_rate_arr: "$2,344,800" },
      { department: "EMEA Expansion", fiscal_quarter: "2026-Q3", actual_mrr: "$142,000", target_mrr: "$150,000", attainment_pct: "94.6%", run_rate_arr: "$1,704,000" },
    ],
    insight: "Q3 attainment is 104.2% blended. Self-serve and Enterprise outpaced forecast.",
  },
  {
    id: "parquet",
    name: "customer_churn_events.parquet",
    format: "Apache Parquet",
    badge: "Columnar 1M+",
    icon: Database,
    stats: { rows: "1,240,000", cols: "7", quality: "99.2%", pii: "1 Auto-Masked" },
    schema: [
      { name: "user_uuid", type: "uuid", nullPct: "0%" },
      { name: "tenure_months", type: "int32", nullPct: "0%" },
      { name: "contract_plan", type: "category", nullPct: "0%" },
      { name: "net_promoter", type: "int16", nullPct: "1.1%" },
      { name: "support_tickets", type: "int16", nullPct: "0%" },
      { name: "churn_probability", type: "float32", nullPct: "0%" },
    ],
    rows: [
      { user_uuid: "usr_9f81a4e2", tenure_months: 18, contract_plan: "Annual Pro", net_promoter: 9, support_tickets: 1, churn_probability: "0.04" },
      { user_uuid: "usr_2c48b71d", tenure_months: 3, contract_plan: "Monthly Starter", net_promoter: 4, support_tickets: 6, churn_probability: "0.82" },
      { user_uuid: "usr_7e33d09a", tenure_months: 36, contract_plan: "Enterprise Plus", net_promoter: 10, support_tickets: 0, churn_probability: "0.01" },
      { user_uuid: "usr_5a19f63c", tenure_months: 8, contract_plan: "Monthly Starter", net_promoter: 6, support_tickets: 3, churn_probability: "0.45" },
    ],
    insight: "Users with >4 support tickets within 90 days exhibit an 82% churn probability.",
  },
  {
    id: "pubchem",
    name: "aspirin_derivatives.sdf",
    format: "PubChem SDF / MOL",
    badge: "Bio & Chemistry",
    icon: Atom,
    stats: { rows: "350 Compounds", cols: "5 Properties", quality: "100%", pii: "Non-PII" },
    schema: [
      { name: "compound_cid", type: "int32", nullPct: "0%" },
      { name: "iupac_name", type: "string", nullPct: "0%" },
      { name: "molecular_weight", type: "float32", nullPct: "0%" },
      { name: "h_bond_donors", type: "int8", nullPct: "0%" },
      { name: "h_bond_acceptors", type: "int8", nullPct: "0%" },
      { name: "rotatable_bonds", type: "int8", nullPct: "0%" },
    ],
    rows: [
      { compound_cid: "2244", iupac_name: "2-acetyloxybenzoic acid", molecular_weight: "180.16 g/mol", h_bond_donors: 1, h_bond_acceptors: 4, rotatable_bonds: 3 },
      { compound_cid: "5467", iupac_name: "2-hydroxybenzoic acid", molecular_weight: "138.12 g/mol", h_bond_donors: 2, h_bond_acceptors: 3, rotatable_bonds: 1 },
      { compound_cid: "311", iupac_name: "4-acetamidophenol", molecular_weight: "151.16 g/mol", h_bond_donors: 2, h_bond_acceptors: 2, rotatable_bonds: 1 },
      { compound_cid: "60823", iupac_name: "methyl 2-hydroxybenzoate", molecular_weight: "152.15 g/mol", h_bond_donors: 1, h_bond_acceptors: 3, rotatable_bonds: 2 },
    ],
    insight: "SDF structure parsed into 2D aromatic ring projections with Lipinski rule verification.",
  },
  {
    id: "geojson",
    name: "metro_transit_zones.geojson",
    format: "GeoJSON Feature Collection",
    badge: "Geospatial",
    icon: MapPin,
    stats: { rows: "1,840 Polygons", cols: "6 Attributes", quality: "99.8%", pii: "Public Data" },
    schema: [
      { name: "zone_code", type: "string", nullPct: "0%" },
      { name: "borough", type: "string", nullPct: "0%" },
      { name: "geometry_type", type: "polygon", nullPct: "0%" },
      { name: "daily_ridership", type: "int32", nullPct: "0%" },
      { name: "bike_lane_km", type: "float32", nullPct: "0%" },
    ],
    rows: [
      { zone_code: "ZN-DT-01", borough: "Downtown Core", geometry_type: "MultiPolygon (14 pts)", daily_ridership: "84,200", bike_lane_km: "18.4 km" },
      { zone_code: "ZN-MD-04", borough: "Midtown West", geometry_type: "Polygon (8 pts)", daily_ridership: "62,150", bike_lane_km: "12.8 km" },
      { zone_code: "ZN-UP-12", borough: "Harbor District", geometry_type: "Polygon (11 pts)", daily_ridership: "39,400", bike_lane_km: "24.1 km" },
      { zone_code: "ZN-PK-08", borough: "Tech Corridor", geometry_type: "MultiPolygon (19 pts)", daily_ridership: "91,800", bike_lane_km: "31.5 km" },
    ],
    insight: "Coordinate boundaries validated against EPSG:4326 with automatic topology closure.",
  },
];

export function HeroInteractivePreview() {
  const [selectedDataset, setSelectedDataset] = useState<SampleDataset>(SAMPLE_DATASETS[0]);
  const [activeSheet, setActiveSheet] = useState<string>("Q3_Revenue");
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  return (
    <div className="relative w-full group">
      {/* Decorative Ambient Underlay Glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-[#0061FE]/25 via-[#60A5FA]/20 to-[#A855F7]/20 rounded-3xl blur-2xl opacity-70 group-hover:opacity-90 transition duration-700 pointer-events-none" />

      {/* Floating Badges Overlays (Top Left & Top Right) */}
      <div className="hidden lg:flex items-center gap-2 absolute -top-5 -left-4 z-20 glass-white px-3.5 py-1.5 rounded-full text-xs font-mono shadow-md border border-white/80 animate-float-slow">
        <Zap className="w-3.5 h-3.5 text-[#0061FE]" />
        <span className="font-semibold text-[#1E1915]">DuckDB-Wasm Engine</span>
        <span className="text-[10px] text-[#057A55] bg-[#DEF7EC] px-1.5 py-0.5 rounded font-bold">60 FPS</span>
      </div>

      <div className="hidden lg:flex items-center gap-2 absolute -top-5 -right-4 z-20 glass-white px-3.5 py-1.5 rounded-full text-xs font-mono shadow-md border border-white/80 animate-float-delayed">
        <ShieldCheck className="w-3.5 h-3.5 text-[#057A55]" />
        <span className="font-semibold text-[#1E1915]">Zero-PII Leak Guard</span>
        <span className="text-[10px] text-[#0061FE] bg-[#0061FE]/10 px-1.5 py-0.5 rounded font-bold">Active</span>
      </div>

      {/* Main Glassmorphic Window */}
      <div className="relative w-full bg-white/90 backdrop-blur-2xl rounded-2xl border border-white/90 shadow-[0_25px_70px_-15px_rgba(27,24,20,0.12),0_0_0_1px_rgba(232,228,223,0.8)] overflow-hidden font-sans">
        {/* Top Window Chrome */}
        <div className="bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#E8E4DF] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#E5E0D8] transition-transform hover:scale-110" />
              <span className="w-3 h-3 rounded-full bg-[#E5E0D8] transition-transform hover:scale-110" />
              <span className="w-3 h-3 rounded-full bg-[#E5E0D8] transition-transform hover:scale-110" />
            </div>
            <span className="text-xs font-mono text-[#736B63] ml-2 hidden sm:inline">
              strata://datasets/{selectedDataset.name}
            </span>
          </div>

          {/* Live Delta / Version Pill */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="flex items-center gap-1 text-[#0061FE] bg-[#0061FE]/10 px-3 py-1 rounded-full font-semibold border border-[#0061FE]/20 shadow-2xs">
              <GitBranch className="w-3 h-3" /> v2.4 (clean)
            </span>
            <span className="text-[#057A55] bg-[#DEF7EC] px-3 py-1 rounded-full font-medium border border-[#31C48D]/30 hidden md:inline">
              +3,410 rows diffed
            </span>
          </div>
        </div>

        {/* Format Selector Tabs */}
        <div className="bg-white/80 border-b border-[#E8E4DF] px-4 py-2.5 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-mono text-[#8C827A] uppercase tracking-wider mr-1 shrink-0">
            Formats:
          </span>
          {SAMPLE_DATASETS.map((ds) => {
            const Icon = ds.icon;
            const isActive = ds.id === selectedDataset.id;
            return (
              <button
                key={ds.id}
                onClick={() => {
                  setSelectedDataset(ds);
                  if (ds.sheetNames) setActiveSheet(ds.sheetNames[0]);
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 shrink-0 ${
                  isActive
                    ? "bg-[#1E1915] text-white shadow-md scale-[1.02]"
                    : "bg-[#F7F5F2] text-[#4A453E] hover:bg-[#EFECE6] hover:text-[#1E1915] hover:scale-[1.01]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{ds.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isActive ? "bg-white/25 text-white" : "bg-black/5 text-[#736B63]"
                  }`}
                >
                  {ds.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Multi-Sheet Bar (when Excel is selected) */}
        {selectedDataset.sheetNames && (
          <div className="bg-[#FAF8F5]/80 border-b border-[#E8E4DF] px-4 py-2 flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-mono text-[#736B63] flex items-center gap-1 shrink-0">
              <FileSpreadsheet className="w-3 h-3 text-[#0061FE]" /> Sheets:
            </span>
            {selectedDataset.sheetNames.map((sheet) => (
              <button
                key={sheet}
                onClick={() => setActiveSheet(sheet)}
                className={`text-xs px-3 py-1 rounded-lg font-medium transition-all shrink-0 ${
                  activeSheet === sheet
                    ? "bg-[#0061FE] text-white shadow-sm font-semibold scale-[1.02]"
                    : "text-[#5C554D] hover:bg-[#EFECE6] hover:text-[#1E1915]"
                }`}
              >
                {sheet}
              </button>
            ))}
          </div>
        )}

        {/* Stats Ribbon */}
        <div className="bg-[#F7F5F2]/70 backdrop-blur-md px-5 py-3 border-b border-[#E8E4DF] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="group/stat cursor-default">
            <span className="text-[10px] font-mono uppercase text-[#8C827A] block">Virtual Rows</span>
            <span className="font-semibold font-mono text-[#1E1915] text-sm group-hover/stat:text-[#0061FE] transition-colors">
              {selectedDataset.stats.rows}
            </span>
          </div>
          <div className="group/stat cursor-default">
            <span className="text-[10px] font-mono uppercase text-[#8C827A] block">Columns</span>
            <span className="font-semibold font-mono text-[#1E1915] text-sm group-hover/stat:text-[#0061FE] transition-colors">
              {selectedDataset.stats.cols}
            </span>
          </div>
          <div className="group/stat cursor-default">
            <span className="text-[10px] font-mono uppercase text-[#8C827A] block">Quality Score</span>
            <span className="font-semibold font-mono text-[#057A55] text-sm flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 inline" /> {selectedDataset.stats.quality}
            </span>
          </div>
          <div className="group/stat cursor-default">
            <span className="text-[10px] font-mono uppercase text-[#8C827A] block">PII Guard</span>
            <span className="font-semibold font-mono text-[#0061FE] text-sm flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 inline" /> {selectedDataset.stats.pii}
            </span>
          </div>
        </div>

        {/* Table View Canvas */}
        <div className="overflow-x-auto max-h-[300px] bg-white">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="bg-[#FAF8F5]/90 border-b border-[#E8E4DF] sticky top-0 z-10 backdrop-blur-md">
                <th className="py-2.5 px-3 font-mono text-[#8C827A] border-r border-[#E8E4DF] w-10 text-center">#</th>
                {selectedDataset.schema.map((col) => (
                  <th
                    key={col.name}
                    className="py-2 px-3 font-semibold text-[#1E1915] border-r border-[#E8E4DF] min-w-[135px] hover:bg-[#F2EFEB] transition-colors cursor-pointer group/col"
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate group-hover/col:text-[#0061FE] transition-colors">{col.name}</span>
                      <Filter className="w-2.5 h-2.5 text-[#B0A79E] group-hover/col:text-[#0061FE]" />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#8C827A] mt-0.5">
                      <span>{col.type}</span>
                      <span>{col.nullPct} null</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE6] font-mono text-[11px] text-[#2B2621]">
              {selectedDataset.rows.map((row, idx) => {
                const isHovered = hoveredRow === idx;
                return (
                  <tr
                    key={idx}
                    onMouseEnter={() => setHoveredRow(idx)}
                    onMouseLeave={() => setHoveredRow(null)}
                    className={`transition-colors duration-150 ${isHovered ? "bg-[#0061FE]/[0.04]" : "hover:bg-[#F9F8F6]"}`}
                  >
                    <td className={`py-2.5 px-3 text-center border-r border-[#E8E4DF] select-none ${isHovered ? "bg-[#0061FE]/10 text-[#0061FE] font-bold" : "bg-[#FCFBF9] text-[#A89F95]"}`}>
                      {idx + 1}
                    </td>
                    {selectedDataset.schema.map((col) => {
                      const val = row[col.name];
                      return (
                        <td key={col.name} className="py-2.5 px-3 border-r border-[#E8E4DF] truncate max-w-[200px]">
                          {val !== undefined && val !== null ? String(val) : <span className="text-[#B0A79E] italic">null</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Embedded AI Insight Pill */}
        <div className="bg-[#FAF8F5]/90 border-t border-[#E8E4DF] px-5 py-3 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-[#2B2621]">
            <span className="w-6 h-6 rounded-full bg-[#0061FE]/10 text-[#0061FE] flex items-center justify-center shrink-0 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <span className="text-[#3D3730] font-sans">
              <strong className="font-semibold text-[#1E1915]">AI Copilot:</strong> {selectedDataset.insight}
            </span>
          </div>
          <span className="text-[11px] font-mono text-[#0061FE] font-medium hover:underline cursor-pointer shrink-0 hidden sm:flex items-center gap-1 group/link">
            <span>Explore DuckDB view</span>
            <ArrowRight className="w-3 h-3 group-hover/link:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>
    </div>
  );
}
