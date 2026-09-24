"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, Database, GitBranch, Sparkles, ArrowLeft } from "lucide-react";
import { StrataLogo } from "@/components/brand/StrataLogo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F5F2] text-[#1E1915] flex font-sans selection:bg-[#0061FE] selection:text-white">
      {/* Left Column: Form Canvas (Centered on mobile, 55% on lg screens) */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-12 lg:p-16 relative overflow-hidden">
        {/* Ambient Glow Underlay */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-[#0061FE]/10 via-[#60A5FA]/8 to-transparent rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse-glow" />

        {/* Top Header with Back to Home */}
        <div className="flex items-center justify-between w-full max-w-md mx-auto">
          <StrataLogo size="md" href="/" />

          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-medium text-[#736B63] hover:text-[#0061FE] transition-colors font-mono"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to home</span>
          </Link>
        </div>

        {/* Main Center Form Slot */}
        <div className="w-full max-w-md mx-auto my-auto py-8">
          {children}
        </div>

        {/* Bottom Trust & Compliance Footer */}
        <div className="w-full max-w-md mx-auto pt-6 border-t border-[#E8E4DF] flex items-center justify-between text-[11px] font-mono text-[#8C827A]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#057A55]" />
            <span>256-bit encryption</span>
          </div>
          <span>SOC 2 Type II Certified</span>
        </div>
      </div>

      {/* Right Column: High-Contrast Editorial Showcase (Desktop Only, 45%) */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-[#1E1915] text-white p-16 relative overflow-hidden border-l border-[#332F2B] bg-dots-dark">
        {/* Ambient Dark Glow */}
        <div className="absolute top-1/3 right-10 w-96 h-96 bg-gradient-to-bl from-[#0061FE]/25 via-[#3B82F6]/10 to-transparent rounded-full blur-[130px] pointer-events-none" />

        {/* Top Tagline */}
        <div className="relative z-10">
          <span className="inline-block text-xs font-mono uppercase tracking-widest text-[#76A9FA] font-bold px-3 py-1 rounded-full bg-[#0061FE]/20 border border-[#0061FE]/40">
            Strata Studio v1.0
          </span>
        </div>

        {/* Middle Editorial Content & Live Badges */}
        <div className="space-y-8 relative z-10 max-w-lg">
          <div className="space-y-4">
            <h2 className="text-3xl xl:text-4xl font-serif font-bold text-white leading-tight">
              &ldquo;The exact tool data science teams have needed for a decade.&rdquo;
            </h2>
            <p className="text-sm text-[#A89F95] leading-relaxed">
              No more folders of final_v2_ACTUALLY_final.csv. Treat datasets like code: versioned, diffable, and interrogated by an AI-native analyst that generates verified code.
            </p>
          </div>

          {/* Floating Pill Badges */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md shadow-lg hover:bg-white/[0.07] transition-all duration-200">
              <div className="w-8 h-8 rounded-xl bg-[#0061FE]/20 text-[#76A9FA] flex items-center justify-center shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="font-semibold text-white block">Universal Multi-Format Preview</span>
                <span className="text-[#A89F95] text-[11px] font-mono">Multi-sheet Excel, Parquet, PubChem & GeoJSON</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md shadow-lg hover:bg-white/[0.07] transition-all duration-200">
              <div className="w-8 h-8 rounded-xl bg-[#057A55]/20 text-[#31C48D] flex items-center justify-center shrink-0">
                <GitBranch className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="font-semibold text-white block">Git-Grade Dataset Lineage</span>
                <span className="text-[#A89F95] text-[11px] font-mono">Content-addressed hashes, commits & diffs</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md shadow-lg hover:bg-white/[0.07] transition-all duration-200">
              <div className="w-8 h-8 rounded-xl bg-[#8B5CF6]/20 text-[#C084FC] flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="font-semibold text-white block">Verified Conversational AI</span>
                <span className="text-[#A89F95] text-[11px] font-mono">Zero-hallucination DuckDB SQL execution</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Author Tag */}
        <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-[#A89F95]">
          <div>
            <p className="font-bold text-white">Dr. Elena Vance</p>
            <p className="text-[11px]">Lead Quantitative Scientist · BioMatrix</p>
          </div>
          <span className="font-mono text-[10px] text-[#76A9FA]">Verified Enterprise Customer</span>
        </div>
      </div>
    </div>
  );
}
