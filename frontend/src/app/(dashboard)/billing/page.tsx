"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  HardDrive,
  Database,
  Cpu,
  Sparkles,
  Check,
  ArrowRight,
  Shield,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { fetchBillingUsage, upgradePlan, seedDomainSamples } from "@/lib/api";
import { BillingUsageResponse } from "@/lib/types";

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingUsageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadBilling = async () => {
    setIsLoading(true);
    try {
      const data = await fetchBillingUsage();
      setBilling(data);
    } catch (err) {
      console.error("Failed to load billing details:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBilling();
  }, []);

  const handlePlanChange = async (targetTier: "free" | "pro") => {
    setIsUpdating(true);
    try {
      const res = await upgradePlan(targetTier);
      setActionSuccess(res.message);
      await loadBilling();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(`Plan update failed: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSeedSamples = async () => {
    setIsSeeding(true);
    try {
      const res = await seedDomainSamples();
      setActionSuccess(`Domain benchmark datasets loaded: ${res.seeded_datasets?.join(", ")}`);
      await loadBilling();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      alert(`Failed to load domain samples: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F5F2] overflow-y-auto">
      {/* Top Header */}
      <div className="border-b border-[#E8E4DF] bg-white px-6 py-4 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-[#0061FE]/10 text-[#0061FE]">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-[#1E1915]">
              Billing, Quotas & Resource Allocation
            </h1>
            <p className="text-xs text-[#8C827A]">
              Transparent storage limits, compute hours, dataset caps & plan management (Pillar 15).
            </p>
          </div>
        </div>

        <button
          onClick={handleSeedSamples}
          disabled={isSeeding}
          className="px-3.5 py-1.5 rounded-xl border border-[#E8E4DF] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
        >
          <Sparkles className={`w-3.5 h-3.5 text-[#0061FE] ${isSeeding ? "animate-spin" : ""}`} />
          <span>{isSeeding ? "Seeding Datasets..." : "Load Domain Benchmarks (18.2)"}</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="max-w-6xl w-full mx-auto px-6 pt-4">
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        </div>
      )}

      <div className="p-6 max-w-6xl w-full mx-auto space-y-6">
        {/* Resource Usage Gauge Cards */}
        {billing && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Storage Meter */}
            <div className="p-5 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1E1915]">
                  <HardDrive className="w-4 h-4 text-[#0061FE]" />
                  <span>NVMe Storage Quota</span>
                </div>
                <span className="text-xs font-mono text-[#8C827A]">
                  {billing.storage_used_mb} MB / {billing.storage_limit_mb} MB
                </span>
              </div>
              <div className="w-full h-2.5 bg-[#FAF8F5] border border-[#E8E4DF] rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    billing.storage_percentage > 80 ? "bg-rose-500" : "bg-[#0061FE]"
                  }`}
                  style={{ width: `${Math.max(2, billing.storage_percentage)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-[#8C827A] font-mono">
                <span>{billing.storage_percentage}% utilized</span>
                <span>{billing.tier === "pro" ? "100 GB Cap" : "5 GB Community Cap"}</span>
              </div>
            </div>

            {/* Datasets Count Meter */}
            <div className="p-5 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1E1915]">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>Registered Datasets</span>
                </div>
                <span className="text-xs font-mono text-[#8C827A]">
                  {billing.datasets_count} / {billing.dataset_limit}
                </span>
              </div>
              <div className="w-full h-2.5 bg-[#FAF8F5] border border-[#E8E4DF] rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                  style={{ width: `${Math.max(2, billing.datasets_percentage)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-[#8C827A] font-mono">
                <span>{billing.datasets_percentage}% used</span>
                <span>{billing.tier === "pro" ? "Unlimited" : "Max 10 Tables"}</span>
              </div>
            </div>

            {/* Compute & AI Queries */}
            <div className="p-5 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1E1915]">
                  <Cpu className="w-4 h-4 text-purple-600" />
                  <span>AutoML & AI Analyst Runs</span>
                </div>
                <span className="text-xs font-mono text-[#8C827A]">
                  {billing.ai_queries_used} / {billing.ai_queries_limit} queries
                </span>
              </div>
              <div className="w-full h-2.5 bg-[#FAF8F5] border border-[#E8E4DF] rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-500 rounded-full"
                  style={{ width: `${Math.round((billing.ai_queries_used / billing.ai_queries_limit) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-[#8C827A] font-mono">
                <span>{billing.compute_hours_used}h compute used</span>
                <span>Resets {billing.next_billing_date}</span>
              </div>
            </div>
          </div>
        )}

        {/* Plan Tiers Matrix */}
        <div className="space-y-4">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <h2 className="text-lg font-bold text-[#1E1915]">Available Strata Studio Tiers</h2>
            <p className="text-xs text-[#8C827A]">
              Choose the tier that matches your data science, AutoML, and team collaboration needs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {billing?.tiers_available.map((tier) => {
              const isCurrent = tier.is_current;
              const isPro = tier.id === "pro";

              return (
                <div
                  key={tier.id}
                  className={`rounded-2xl p-6 flex flex-col justify-between border transition-all ${
                    isPro
                      ? "bg-white border-[#0061FE] shadow-lg shadow-[#0061FE]/10 ring-2 ring-[#0061FE]/20"
                      : "bg-white border-[#E8E4DF] shadow-2xs hover:border-[#D6D0C7]"
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-[#1E1915]">{tier.name}</h3>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                          Current Plan
                        </span>
                      )}
                      {isPro && !isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-[#0061FE]/10 text-[#0061FE] text-[10px] font-bold uppercase">
                          Popular
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-3xl font-extrabold text-[#1E1915] font-mono">
                        {tier.price}
                      </span>
                      <span className="text-xs text-[#8C827A] ml-1">/{tier.billing_period}</span>
                    </div>

                    <div className="border-t border-[#E8E4DF] pt-4 space-y-2.5">
                      {tier.features.map((feat, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-[#5C554D]">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6">
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full py-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] text-xs font-bold text-[#8C827A] cursor-default"
                      >
                        Active Subscription
                      </button>
                    ) : tier.id === "pro" ? (
                      <button
                        onClick={() => handlePlanChange("pro")}
                        disabled={isUpdating}
                        className="w-full py-2.5 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white text-xs font-bold shadow-sm shadow-[#0061FE]/25 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      >
                        <span>Upgrade to Pro</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : tier.id === "free" ? (
                      <button
                        onClick={() => handlePlanChange("free")}
                        disabled={isUpdating}
                        className="w-full py-2.5 rounded-xl border border-[#E8E4DF] hover:bg-[#FAF8F5] text-xs font-bold text-[#1E1915] cursor-pointer transition-colors"
                      >
                        Downgrade to Free
                      </button>
                    ) : (
                      <button
                        onClick={() => alert("Enterprise sales contact: enterprise@strata.ai")}
                        className="w-full py-2.5 rounded-xl border border-[#E8E4DF] hover:bg-[#FAF8F5] text-xs font-bold text-[#1E1915] cursor-pointer transition-colors"
                      >
                        Contact Sales
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
