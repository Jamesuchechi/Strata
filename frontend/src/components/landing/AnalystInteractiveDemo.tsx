"use client";

import React, { useState } from "react";
import { Sparkles, Terminal, CheckCircle2, Play, Code2, ArrowRight, Copy, Check } from "lucide-react";

interface PromptScenario {
  id: string;
  title: string;
  chipLabel: string;
  prompt: string;
  generatedSql: string;
  explanation: string;
  outputRows: Record<string, any>[];
  metricsSummary: { label: string; value: string }[];
}

const SCENARIOS: PromptScenario[] = [
  {
    id: "churn",
    title: "Root-Cause Churn Attribution",
    chipLabel: "Identify churn drivers",
    prompt: "Show me which subscription contract tier experienced the highest churn rate in Q3, along with average tenure and support ticket volume.",
    generatedSql: `SELECT 
    contract_plan,
    COUNT(*) AS total_accounts,
    ROUND(AVG(CAST(churned AS INT)) * 100, 1) AS churn_rate_pct,
    ROUND(AVG(tenure_months), 1) AS avg_tenure_months,
    ROUND(AVG(support_tickets), 1) AS avg_tickets
FROM read_parquet('s3://strata/customer_churn_q3.parquet')
GROUP BY contract_plan
ORDER BY churn_rate_pct DESC;`,
    explanation: "Month-to-month starter contracts experienced 42.8% churn, strongly correlated with high support tickets (>3.8 avg). Annual Pro accounts maintain sub-5% churn.",
    metricsSummary: [
      { label: "Highest Risk Segment", value: "Monthly Starter (42.8%)" },
      { label: "Safest Segment", value: "Enterprise Plus (1.2%)" },
      { label: "Key Correlate", value: "Support tickets > 3" },
    ],
    outputRows: [
      { contract_plan: "Monthly Starter", total_accounts: "6,420", churn_rate_pct: "42.8%", avg_tenure_months: "4.2", avg_tickets: "3.9" },
      { contract_plan: "Annual Pro", total_accounts: "5,800", churn_rate_pct: "4.7%", avg_tenure_months: "22.5", avg_tickets: "1.1" },
      { contract_plan: "Enterprise Plus", total_accounts: "3,200", churn_rate_pct: "1.2%", avg_tenure_months: "38.1", avg_tickets: "0.8" },
    ],
  },
  {
    id: "revenue",
    title: "Multi-Sheet Variance Analysis",
    chipLabel: "Quarterly MRR attainment",
    prompt: "Compare actual MRR versus target MRR across all operating departments from our Excel model and calculate attainment percentage.",
    generatedSql: `SELECT 
    department,
    SUM(actual_mrr) AS total_actual_mrr,
    SUM(target_mrr) AS total_target_mrr,
    ROUND((SUM(actual_mrr) / SUM(target_mrr)) * 100, 2) AS attainment_pct
FROM read_excel('financial_forecast_2026.xlsx', sheet='Q3_Revenue')
GROUP BY department
ORDER BY attainment_pct DESC;`,
    explanation: "Enterprise Sales and Growth Self-Serve both exceeded target (>107%), while EMEA expansion lagged at 94.6% due to currency headwinds.",
    metricsSummary: [
      { label: "Blended Attainment", value: "104.2%" },
      { label: "Top Performer", value: "Growth Self-Serve (108.5%)" },
      { label: "Net Variance", value: "+$46,100 MRR" },
    ],
    outputRows: [
      { department: "Growth / Self-Serve", total_actual_mrr: "$195,400", total_target_mrr: "$180,000", attainment_pct: "108.5%" },
      { department: "Enterprise Sales", total_actual_mrr: "$482,500", total_target_mrr: "$450,000", attainment_pct: "107.2%" },
      { department: "Mid-Market", total_actual_mrr: "$318,200", total_target_mrr: "$320,000", attainment_pct: "99.4%" },
      { department: "EMEA Expansion", total_actual_mrr: "$142,000", total_target_mrr: "$150,000", attainment_pct: "94.6%" },
    ],
  },
  {
    id: "drift",
    title: "Distribution Drift & Data Snooping",
    chipLabel: "Detect covariate shift",
    prompt: "Test whether monthly charge distributions drifted significantly between dataset version v1.0 and version v2.1.",
    generatedSql: `SELECT 
    'v1.0' AS version,
    ROUND(AVG(monthly_charges), 2) AS mean_charge,
    ROUND(STDDEV(monthly_charges), 2) AS std_charge,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY monthly_charges), 2) AS median_charge
FROM dataset_version('v1.0')
UNION ALL
SELECT 
    'v2.1' AS version,
    ROUND(AVG(monthly_charges), 2) AS mean_charge,
    ROUND(STDDEV(monthly_charges), 2) AS std_charge,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY monthly_charges), 2) AS median_charge
FROM dataset_version('v2.1');`,
    explanation: "Two-sample Kolmogorov-Smirnov test yielded p-value = 0.42. No statistically significant covariate shift detected between releases.",
    metricsSummary: [
      { label: "KS Test p-value", value: "0.42 (No Drift)" },
      { label: "Mean Charge Shift", value: "+$1.15 (+1.8%)" },
      { label: "Model Safety", value: "Verified for Production" },
    ],
    outputRows: [
      { version: "v1.0 (baseline)", mean_charge: "$64.80", std_charge: "$28.40", median_charge: "$62.50" },
      { version: "v2.1 (release)", mean_charge: "$65.95", std_charge: "$28.15", median_charge: "$63.10" },
    ],
  },
];

export function AnalystInteractiveDemo() {
  const [activeScenario, setActiveScenario] = useState<PromptScenario>(SCENARIOS[0]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeScenario.generatedSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative w-full group">
      {/* Ambient Backdrop Glow Underlay */}
      <div className="absolute -inset-1.5 bg-gradient-to-r from-[#0061FE]/20 via-[#60A5FA]/15 to-[#A855F7]/15 rounded-3xl blur-2xl opacity-60 group-hover:opacity-85 transition duration-700 pointer-events-none" />

      {/* Main Glassmorphic Container */}
      <div className="relative w-full bg-white/90 backdrop-blur-2xl rounded-2xl border border-white/80 shadow-[0_25px_60px_-15px_rgba(27,24,20,0.08),0_0_0_1px_rgba(232,228,223,0.8)] overflow-hidden font-sans">
        {/* Header Bar */}
        <div className="bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#E8E4DF] px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0061FE] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(0,97,254,0.3)] transition-transform group-hover:scale-105">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1E1915]">Conversational Analyst & Code Engine</h4>
              <p className="text-xs text-[#736B63]">Natural language transformed to verified DuckDB SQL</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-[#057A55] bg-[#DEF7EC] border border-[#31C48D]/30 px-3 py-1 rounded-full font-medium shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5" /> Deterministic Output · Zero Hallucinations
            </span>
          </div>
        </div>

        {/* Interactive Prompt Chip Selector */}
        <div className="bg-white/80 border-b border-[#E8E4DF] px-6 py-3.5 flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-mono text-[#8C827A] uppercase tracking-wider mr-2 shrink-0">
            Select prompt:
          </span>
          {SCENARIOS.map((sc) => {
            const isActive = sc.id === activeScenario.id;
            return (
              <button
                key={sc.id}
                onClick={() => setActiveScenario(sc)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 shrink-0 ${
                  isActive
                    ? "bg-[#0061FE] text-white shadow-md shadow-[#0061FE]/25 font-semibold scale-[1.02]"
                    : "bg-[#F7F5F2] text-[#4A453E] hover:bg-[#EFECE6] hover:text-[#1E1915] hover:scale-[1.01]"
                }`}
              >
                <span>{sc.chipLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Body Grid: Prompt + SQL on Left, Results on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#E8E4DF]">
          {/* Left Column: Natural Language Prompt & Generated Executable Code */}
          <div className="p-6 space-y-4 bg-white/70">
            <div>
              <span className="text-[11px] font-mono text-[#736B63] uppercase tracking-wider block mb-2">
                Analyst Query (Natural Language)
              </span>
              <div className="p-4 rounded-xl bg-[#F7F5F2]/80 border border-[#E8E4DF] text-xs text-[#1E1915] font-medium leading-relaxed shadow-inner">
                &ldquo;{activeScenario.prompt}&rdquo;
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono text-[#736B63] uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-[#0061FE]" /> Generated Executable DuckDB SQL
                </span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[11px] font-mono text-[#736B63] hover:text-[#0061FE] bg-[#F7F5F2] px-2 py-1 rounded transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-[#057A55]" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <div className="relative rounded-xl overflow-hidden shadow-lg border border-[#332F2B]">
                <pre className="p-4 bg-[#1E1915] text-[#DEF7EC] text-xs font-mono overflow-x-auto leading-relaxed">
                  <code>{activeScenario.generatedSql}</code>
                </pre>
                <div className="absolute top-2 right-3 flex items-center gap-1 text-[10px] font-mono text-[#057A55] bg-[#DEF7EC]/10 border border-[#057A55]/30 px-2 py-0.5 rounded backdrop-blur-sm">
                  <CheckCircle2 className="w-3 h-3" /> Validated in 12ms
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Verified Statistical Evidence & Outputs */}
          <div className="p-6 space-y-5 bg-[#FAF8F5]/60 backdrop-blur-md">
            <div>
              <span className="text-[11px] font-mono text-[#736B63] uppercase tracking-wider block mb-2.5">
                Verified Key Metrics
              </span>
              <div className="grid grid-cols-3 gap-2.5">
                {activeScenario.metricsSummary.map((met, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-white/90 border border-[#E8E4DF] shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <span className="text-[10px] font-mono text-[#8C827A] block truncate">{met.label}</span>
                    <span className="text-xs font-bold text-[#1E1915] font-mono mt-1 block truncate">
                      {met.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[11px] font-mono text-[#736B63] uppercase tracking-wider block mb-2">
                Result Dataset Preview
              </span>
              <div className="overflow-x-auto rounded-xl border border-[#E8E4DF] bg-white shadow-2xs">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="bg-[#FAF8F5] border-b border-[#E8E4DF]">
                      {Object.keys(activeScenario.outputRows[0] || {}).map((header) => (
                        <th key={header} className="py-2.5 px-3 font-semibold text-[#1E1915] border-r border-[#E8E4DF] last:border-r-0">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFECE6] text-[11px] text-[#2B2621]">
                    {activeScenario.outputRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-[#F9F8F6] transition-colors">
                        {Object.values(row).map((val, cellIdx) => (
                          <td key={cellIdx} className="py-2.5 px-3 border-r border-[#E8E4DF] last:border-r-0">
                            {String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0061FE]/[0.06] border border-[#0061FE]/25 flex items-start gap-3 shadow-2xs">
              <div className="w-5 h-5 rounded-full bg-[#0061FE]/15 text-[#0061FE] flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="text-xs text-[#1E1915] leading-relaxed">
                <strong className="font-semibold text-[#0061FE]">AI Synthesis: </strong>
                {activeScenario.explanation}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
