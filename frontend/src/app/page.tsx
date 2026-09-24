"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Layers,
  ArrowRight,
  Check,
  Sparkles,
  FileSpreadsheet,
  Database,
  GitBranch,
  ShieldCheck,
  Cpu,
  BarChart3,
  Clock,
  Code2,
  Atom,
  MapPin,
  ExternalLink,
  ChevronRight,
  Zap,
  Lock,
} from "lucide-react";
import { HeroInteractivePreview } from "@/components/landing/HeroInteractivePreview";
import { StrataLogo, StrataMark } from "@/components/brand/StrataLogo";
import { AnalystInteractiveDemo } from "@/components/landing/AnalystInteractiveDemo";
import { DiffInteractiveDemo } from "@/components/landing/DiffInteractiveDemo";

export default function LandingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    handleScroll(); // initialize
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F5F2] text-[#1E1915] font-sans selection:bg-[#0061FE] selection:text-white antialiased relative overflow-hidden">
      {/* Global Ambient Background Orbs (Underlays) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-[#0061FE]/12 via-[#93C5FD]/8 to-transparent rounded-full blur-[140px] pointer-events-none -z-10 animate-pulse-glow" />
      <div className="absolute top-[800px] -left-48 w-[600px] h-[600px] bg-gradient-to-tr from-[#8B5CF6]/10 via-[#C084FC]/5 to-transparent rounded-full blur-[130px] pointer-events-none -z-10 animate-float-slow" />
      <div className="absolute top-[1600px] -right-48 w-[650px] h-[650px] bg-gradient-to-bl from-[#0061FE]/10 via-[#38BDF8]/8 to-transparent rounded-full blur-[140px] pointer-events-none -z-10 animate-float-delayed" />

      {/* Top Navigation Bar - Fixed to viewport with dynamic glassmorphism on scroll */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#F7F5F2]/90 backdrop-blur-xl border-b border-[#E8E4DF] shadow-[0_8px_30px_rgba(30,25,21,0.06)]"
            : "bg-[#F7F5F2]/75 backdrop-blur-md border-b border-[#E8E4DF]/60 shadow-[0_2px_10px_rgba(30,25,21,0.02)]"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Brand Mark */}
          <div
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-3 group cursor-pointer"
          >
            <div className="relative group-hover:scale-105 transition-transform duration-200">
              <StrataMark size={36} />
            </div>
            <span className="text-2xl font-bold tracking-tight text-[#1E1915] font-serif">
              Strata
            </span>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#4A453E]">
            <a href="#previewer" className="hover:text-[#0061FE] transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#0061FE] hover:after:w-full after:transition-all">
              Universal Preview
            </a>
            <a href="#analyst" className="hover:text-[#0061FE] transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#0061FE] hover:after:w-full after:transition-all">
              AI Analyst
            </a>
            <a href="#versioning" className="hover:text-[#0061FE] transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#0061FE] hover:after:w-full after:transition-all">
              Git Versioning
            </a>
            <a href="#comparison" className="hover:text-[#0061FE] transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#0061FE] hover:after:w-full after:transition-all">
              Why Strata
            </a>
            <a href="#pricing" className="hover:text-[#0061FE] transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#0061FE] hover:after:w-full after:transition-all">
              Pricing
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Jamesuchechi/Strata"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-[#5C554D] hover:text-[#1E1915] px-3 py-2 transition-colors hidden sm:inline"
            >
              Docs
            </a>
            <Link
              href="/login"
              className="text-sm font-medium text-[#5C554D] hover:text-[#0061FE] px-3 py-2 transition-colors hidden sm:inline"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="bg-[#0061FE] hover:bg-[#0048D9] text-white text-sm font-semibold px-6 py-2.5 rounded-full transition-all duration-200 shadow-[0_3px_10px_rgba(0,97,254,0.3)] hover:shadow-[0_6px_20px_rgba(0,97,254,0.4)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section with Grid Underlay & Floating Micro-Chips */}
      <section className="relative pt-32 sm:pt-36 pb-24 px-6 max-w-7xl mx-auto bg-grid-subtle">
        {/* Radial mask for the subtle grid */}
        <div className="absolute inset-0 bg-radial-gradient from-transparent via-[#F7F5F2]/60 to-[#F7F5F2] pointer-events-none -z-10" />

        <div className="max-w-4xl mx-auto text-center space-y-6">
          {/* Frosted Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full glass-white shadow-[0_4px_16px_rgba(27,24,20,0.05)] border border-white/80 text-xs font-mono text-[#5C554D] transition-transform hover:scale-105 duration-200 cursor-default">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0061FE] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0061FE]" />
            </span>
            <span>Introducing Strata · The AI-Native Data Science Studio</span>
            <Sparkles className="w-3.5 h-3.5 text-[#0061FE]" />
          </div>

          {/* Giant Editorial Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#1E1915] font-serif leading-[1.08]">
            All your data work. <br className="hidden sm:inline" />
            In one place. <span className="text-[#0061FE] relative inline-block">
              Forever versioned.
              <span className="absolute -bottom-1.5 left-0 w-full h-1 bg-gradient-to-r from-[#0061FE] via-[#60A5FA] to-transparent rounded-full" />
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-[#5C554D] max-w-2xl mx-auto font-normal leading-relaxed">
            Strata combines the fluid exploration of modern data workspaces with Git-grade dataset version control and an AI-native conversational analyst. Preview any format instantly, run verified queries, and never lose track of a single row.
          </p>

          {/* Dual Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <Link
              href="/register"
              className="w-full sm:w-auto bg-[#0061FE] hover:bg-[#0048D9] text-white text-base font-semibold px-8 py-4 rounded-full transition-all duration-200 shadow-[0_4px_16px_rgba(0,97,254,0.28)] hover:shadow-[0_8px_25px_rgba(0,97,254,0.4)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] flex items-center justify-center gap-2 group"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#versioning"
              className="w-full sm:w-auto glass-white hover:bg-white text-[#1E1915] border border-[#D6D0C7] text-base font-semibold px-7 py-4 rounded-full transition-all duration-200 shadow-2xs hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
            >
              See How Versioning Works
            </a>
          </div>

          {/* Formats Strip */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-mono text-[#8C827A]">
            <span>Supports:</span>
            <span className="px-2 py-0.5 rounded-md bg-white/70 border border-[#E8E4DF] text-[#1E1915] font-semibold">Multi-Sheet Excel (.xlsx)</span>
            <span className="px-2 py-0.5 rounded-md bg-white/70 border border-[#E8E4DF] text-[#1E1915] font-semibold">Parquet & Arrow</span>
            <span className="px-2 py-0.5 rounded-md bg-white/70 border border-[#E8E4DF] text-[#1E1915] font-semibold">PubChem (.sdf)</span>
            <span className="px-2 py-0.5 rounded-md bg-white/70 border border-[#E8E4DF] text-[#1E1915] font-semibold">GeoJSON</span>
          </div>
        </div>

        {/* Live Interactive Hero Widget */}
        <div className="mt-14 max-w-5xl mx-auto">
          <HeroInteractivePreview />
        </div>
      </section>

      {/* Feature Block 1: Universal Previewer (Warm Sand Paper with Glass Cards) */}
      <section id="previewer" className="py-24 px-6 border-t border-[#E8E4DF] bg-[#F7F5F2] relative">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="max-w-2xl space-y-3">
            <span className="inline-block text-xs font-mono uppercase tracking-widest text-[#0061FE] font-bold px-3 py-1 rounded-full bg-[#0061FE]/10 border border-[#0061FE]/20">
              Pillar 01 — Universal Previewer
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#1E1915] font-serif">
              Open anything. <br />
              Wait for nothing.
            </h2>
            <p className="text-base text-[#5C554D] leading-relaxed">
              No more writing boilerplate python scripts just to see what is inside a file. Drop in 200MB multi-sheet Excel models, billion-row Parquet streams, or chemical compounds and inspect them in 60 FPS immediately.
            </p>
          </div>

          {/* 4 Cards Grid with Glassmorphic Hover Transitions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 */}
            <div className="glass-white-card p-8 rounded-2xl flex flex-col justify-between group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-[#0061FE]/10 text-[#0061FE] flex items-center justify-center transition-transform group-hover:scale-110 duration-200">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#1E1915] group-hover:text-[#0061FE] transition-colors">
                  Multi-Sheet Excel Workbooks
                </h3>
                <p className="text-xs text-[#5C554D] leading-relaxed">
                  Switch between workbook sheets with zero lag. View formula outputs, detect headers automatically, and export clean sheets to Parquet.
                </p>
              </div>
              <span className="text-xs font-mono text-[#0061FE] font-medium pt-6 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                <span>Supports .xlsx & .xls</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Card 2 */}
            <div className="glass-white-card p-8 rounded-2xl flex flex-col justify-between group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-[#DEF7EC] text-[#057A55] flex items-center justify-center transition-transform group-hover:scale-110 duration-200">
                  <Database className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#1E1915] group-hover:text-[#057A55] transition-colors">
                  1M+ Row Parquet & Arrow
                </h3>
                <p className="text-xs text-[#5C554D] leading-relaxed">
                  Vectorized in-browser queries powered by DuckDB-Wasm. Filter, sort, and aggregate gigabytes of data locally with zero server cost.
                </p>
              </div>
              <span className="text-xs font-mono text-[#057A55] font-medium pt-6 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                <span>Sub-second queries</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Card 3 */}
            <div className="glass-white-card p-8 rounded-2xl flex flex-col justify-between group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-[#FEF8E7] text-[#B45309] flex items-center justify-center transition-transform group-hover:scale-110 duration-200">
                  <Atom className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#1E1915] group-hover:text-[#B45309] transition-colors">
                  PubChem & Molecular Data
                </h3>
                <p className="text-xs text-[#5C554D] leading-relaxed">
                  Native parsing for chemical compounds (`.sdf`, `.mol`, FASTA). Inspect 2D aromatic structures, molecular weight, and chemical bond donors.
                </p>
              </div>
              <span className="text-xs font-mono text-[#B45309] font-medium pt-6 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                <span>Biotech & pharma ready</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Card 4 */}
            <div className="glass-white-card p-8 rounded-2xl flex flex-col justify-between group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-[#F0EEF8] text-[#7E3AF2] flex items-center justify-center transition-transform group-hover:scale-110 duration-200">
                  <MapPin className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#1E1915] group-hover:text-[#7E3AF2] transition-colors">
                  Geospatial Vectors
                </h3>
                <p className="text-xs text-[#5C554D] leading-relaxed">
                  Interactive vector tile rendering for GeoJSON, Shapefiles, and GeoParquet. Preview polygons, boundaries, and spatial coordinates.
                </p>
              </div>
              <span className="text-xs font-mono text-[#7E3AF2] font-medium pt-6 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                <span>Interactive map layers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Block 2: Conversational Analyst (Crisp White Canvas with Ambient Light) */}
      <section id="analyst" className="py-24 px-6 bg-[#FFFFFF] border-t border-[#E8E4DF] relative">
        <div className="absolute top-1/2 right-10 -translate-y-1/2 w-96 h-96 bg-gradient-to-l from-[#0061FE]/10 to-transparent rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto space-y-12">
          <div className="max-w-3xl space-y-3">
            <span className="inline-block text-xs font-mono uppercase tracking-widest text-[#0061FE] font-bold px-3 py-1 rounded-full bg-[#0061FE]/10 border border-[#0061FE]/20">
              Pillar 02 — Conversational Analyst
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#1E1915] font-serif">
              Ask in plain English. <br />
              Get verified, reproducible code.
            </h2>
            <p className="text-base text-[#5C554D] leading-relaxed">
              No hallucinated numbers or vague summaries. Strata translates your analytical questions into deterministic DuckDB SQL or Python code, executes it against real data, and verifies every result.
            </p>
          </div>

          {/* Interactive Analyst Simulation */}
          <AnalystInteractiveDemo />
        </div>
      </section>

      {/* Feature Block 3: Git-Grade Version Control (High-Contrast Deep Ink with Dot Grid Underlay) */}
      <section id="versioning" className="py-28 px-6 bg-[#1E1915] text-[#F7F5F2] border-t border-[#332F2B] relative">
        <div className="absolute inset-0 bg-dots-dark pointer-events-none opacity-40" />

        <div className="max-w-7xl mx-auto space-y-12 relative z-10">
          <div className="max-w-3xl space-y-3">
            <span className="inline-block text-xs font-mono uppercase tracking-widest text-[#76A9FA] font-bold px-3 py-1 rounded-full bg-[#0061FE]/20 border border-[#0061FE]/40">
              Pillar 03 — Time-Travel Version Control
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#FFFFFF] font-serif">
              Git was built for code. <br />
              Strata is built for data.
            </h2>
            <p className="text-base text-[#A89F95] leading-relaxed">
              Every upload, transformation, and imputation creates a content-addressed, cryptographic snapshot. Diff any two versions across schema, distributions, and cell-level primary key matches.
            </p>
          </div>

          {/* Interactive Diff Component */}
          <DiffInteractiveDemo />
        </div>
      </section>

      {/* Feature Comparison Matrix ("Why Teams Switch to Strata") */}
      <section id="comparison" className="py-24 px-6 bg-[#F7F5F2] border-t border-[#E8E4DF] relative">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="inline-block text-xs font-mono uppercase tracking-widest text-[#0061FE] font-bold px-3 py-1 rounded-full bg-[#0061FE]/10 border border-[#0061FE]/20">
              Comparative Advantage
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#1E1915] font-serif">
              Why data science teams switch to Strata
            </h2>
            <p className="text-base text-[#5C554D]">
              Stop stitching together four different tools that do not talk to each other.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#E8E4DF] bg-white/95 backdrop-blur-xl shadow-[0_12px_40px_rgba(27,24,20,0.06)]">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#E8E4DF]">
                  <th className="py-4 px-6 font-semibold text-[#1E1915]">Capability</th>
                  <th className="py-4 px-6 font-bold text-[#0061FE] bg-[#0061FE]/[0.06] border-x border-[#0061FE]/20">Strata Studio</th>
                  <th className="py-4 px-6 font-semibold text-[#736B63]">Cloud Drives (Dropbox/S3)</th>
                  <th className="py-4 px-6 font-semibold text-[#736B63]">Infra Tools (DVC/lakeFS)</th>
                  <th className="py-4 px-6 font-semibold text-[#736B63]">Jupyter / Excel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE6] text-xs">
                <tr className="hover:bg-[#F9F8F6] transition-colors">
                  <td className="py-4 px-6 font-semibold text-[#1E1915]">Universal Multi-Format Preview</td>
                  <td className="py-4 px-6 font-bold text-[#057A55] bg-[#0061FE]/[0.04] border-x border-[#0061FE]/20">Instant (Excel, Parquet, SDF, Geo)</td>
                  <td className="py-4 px-6 text-[#736B63]">Basic text/PDF preview only</td>
                  <td className="py-4 px-6 text-[#736B63]">None (CLI only)</td>
                  <td className="py-4 px-6 text-[#736B63]">Requires code & setup</td>
                </tr>
                <tr className="hover:bg-[#F9F8F6] transition-colors">
                  <td className="py-4 px-6 font-semibold text-[#1E1915]">Cell-Level & Distribution Diffs</td>
                  <td className="py-4 px-6 font-bold text-[#057A55] bg-[#0061FE]/[0.04] border-x border-[#0061FE]/20">Visual Git-Style Diffs</td>
                  <td className="py-4 px-6 text-[#736B63]">Binary file overwrite</td>
                  <td className="py-4 px-6 text-[#736B63]">Hash deltas only</td>
                  <td className="py-4 px-6 text-[#736B63]">Manual script comparison</td>
                </tr>
                <tr className="hover:bg-[#F9F8F6] transition-colors">
                  <td className="py-4 px-6 font-semibold text-[#1E1915]">Conversational AI Analyst</td>
                  <td className="py-4 px-6 font-bold text-[#057A55] bg-[#0061FE]/[0.04] border-x border-[#0061FE]/20">Deterministic DuckDB Code Execution</td>
                  <td className="py-4 px-6 text-[#736B63]">None</td>
                  <td className="py-4 px-6 text-[#736B63]">None</td>
                  <td className="py-4 px-6 text-[#736B63]">External plugin required</td>
                </tr>
                <tr className="hover:bg-[#F9F8F6] transition-colors">
                  <td className="py-4 px-6 font-semibold text-[#1E1915]">Automated PII & Quality Scoring</td>
                  <td className="py-4 px-6 font-bold text-[#057A55] bg-[#0061FE]/[0.04] border-x border-[#0061FE]/20">Instant on Ingest</td>
                  <td className="py-4 px-6 text-[#736B63]">None</td>
                  <td className="py-4 px-6 text-[#736B63]">Requires Great Expectations</td>
                  <td className="py-4 px-6 text-[#736B63]">Manual assertions</td>
                </tr>
                <tr className="hover:bg-[#F9F8F6] transition-colors">
                  <td className="py-4 px-6 font-semibold text-[#1E1915]">Python SDK Direct from Notebooks</td>
                  <td className="py-4 px-6 font-bold text-[#057A55] bg-[#0061FE]/[0.04] border-x border-[#0061FE]/20">`pip install strata`</td>
                  <td className="py-4 px-6 text-[#736B63]">boto3 / REST API</td>
                  <td className="py-4 px-6 text-[#736B63]">dvc CLI integration</td>
                  <td className="py-4 px-6 text-[#736B63]">N/A</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Editorial Quote Card with Frosted Specular Border */}
      <section className="py-24 px-6 bg-[#FFFFFF] border-t border-[#E8E4DF] relative">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <span className="text-5xl text-[#0061FE] font-serif block">&ldquo;</span>
          <blockquote className="text-2xl sm:text-3xl font-serif font-semibold text-[#1E1915] leading-snug">
            Before Strata, our data science team had 12 folders named <span className="font-mono text-[#0061FE] px-2 py-0.5 rounded-lg bg-[#0061FE]/10">final_v2_ACTUALLY_final.csv</span>, and nobody remembered which version trained the production model. Now, every change is diffable, verifiable, and traced in seconds.
          </blockquote>
          <div className="pt-3">
            <p className="font-bold text-sm text-[#1E1915]">Dr. Elena Vance</p>
            <p className="text-xs text-[#736B63]">Lead Quantitative Scientist · BioMatrix Therapeutics</p>
          </div>
        </div>
      </section>

      {/* Pricing & Plans (Dropbox-Style Tiers with Glass Cards) */}
      <section id="pricing" className="py-24 px-6 bg-[#F7F5F2] border-t border-[#E8E4DF] relative">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="inline-block text-xs font-mono uppercase tracking-widest text-[#0061FE] font-bold px-3 py-1 rounded-full bg-[#0061FE]/10 border border-[#0061FE]/20">
              Transparent Pricing
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#1E1915] font-serif">
              Simple plans that grow with your data
            </h2>
            <p className="text-base text-[#5C554D]">
              Start free on your local machine. Scale to collaborative team workspaces.
            </p>

            {/* Toggle Pill */}
            <div className="inline-flex items-center gap-2 p-1.5 rounded-full bg-[#EFECE6] border border-[#E8E4DF] text-xs font-semibold mt-2 shadow-inner">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-1.5 rounded-full transition-all duration-200 ${
                  billingCycle === "monthly" ? "bg-white text-[#1E1915] shadow-sm font-bold" : "text-[#736B63] hover:text-[#1E1915]"
                }`}
              >
                Monthly billing
              </button>
              <button
                onClick={() => setBillingCycle("annual")}
                className={`px-4 py-1.5 rounded-full transition-all duration-200 ${
                  billingCycle === "annual" ? "bg-white text-[#1E1915] shadow-sm font-bold" : "text-[#736B63] hover:text-[#1E1915]"
                }`}
              >
                Annual billing <span className="text-[#0061FE] font-mono font-bold">(Save 20%)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Free Tier */}
            <div className="glass-white-card p-8 rounded-3xl flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <span className="text-xs font-mono uppercase tracking-wider text-[#736B63] block">
                  Community
                </span>
                <h3 className="text-2xl font-bold text-[#1E1915]">Free</h3>
                <p className="text-xs text-[#5C554D]">
                  Perfect for solo researchers, students, and local exploration.
                </p>
                <div className="pt-2">
                  <span className="text-4xl font-bold text-[#1E1915] font-serif">$0</span>
                  <span className="text-xs text-[#736B63] ml-1">/ forever</span>
                </div>

                <div className="space-y-2.5 pt-4 border-t border-[#EFECE6] text-xs text-[#3D3730]">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0061FE]" />
                    <span>Universal Preview (CSV, Excel, Parquet, SDF)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0061FE]" />
                    <span>In-Browser DuckDB-Wasm queries</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0061FE]" />
                    <span>Up to 5 versioned datasets</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0061FE]" />
                    <span>Python SDK & CLI access</span>
                  </div>
                </div>
              </div>

              <Link
                href="/register"
                className="w-full bg-[#FAF8F5] hover:bg-[#EFECE6] text-[#1E1915] border border-[#D6D0C7] text-xs font-semibold py-3.5 rounded-full text-center transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 block shadow-2xs"
              >
                Get Started
              </Link>
            </div>

            {/* Pro Tier (Featured / High-Contrast Deep Ink Card with Electric Blue Border) */}
            <div className="bg-[#1E1915] text-[#FFFFFF] p-8 rounded-3xl border-2 border-[#0061FE] shadow-[0_12px_40px_rgba(0,97,254,0.25)] flex flex-col justify-between space-y-6 relative group transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_rgba(0,97,254,0.35)]">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#0061FE] to-[#3B82F6] text-white text-[11px] font-mono uppercase tracking-wider font-bold px-4 py-1 rounded-full shadow-md">
                Most Popular
              </div>

              <div className="space-y-4">
                <span className="text-xs font-mono uppercase tracking-wider text-[#A89F95] block">
                  Practitioner
                </span>
                <h3 className="text-2xl font-bold text-white">Pro</h3>
                <p className="text-xs text-[#A89F95]">
                  For professional data scientists and machine learning engineers.
                </p>
                <div className="pt-2">
                  <span className="text-4xl font-bold text-white font-serif">
                    {billingCycle === "annual" ? "$16" : "$20"}
                  </span>
                  <span className="text-xs text-[#A89F95] ml-1">/ month</span>
                </div>

                <div className="space-y-2.5 pt-4 border-t border-[#332F2B] text-xs text-[#E5E0D8]">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#76A9FA]" />
                    <span>Everything in Community</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#76A9FA]" />
                    <span>Unlimited versioned datasets</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#76A9FA]" />
                    <span>Conversational AI Analyst (Unlimited)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#76A9FA]" />
                    <span>Cloud Storage & 10GB+ file streaming</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#76A9FA]" />
                    <span>AutoML baseline model diagnostics</span>
                  </div>
                </div>
              </div>

              <Link
                href="/register"
                className="w-full bg-[#0061FE] hover:bg-[#0048D9] text-white text-xs font-semibold py-3.5 rounded-full text-center transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 block"
              >
                Start 14-Day Free Trial
              </Link>
            </div>

            {/* Team Tier */}
            <div className="glass-white-card p-8 rounded-3xl flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <span className="text-xs font-mono uppercase tracking-wider text-[#736B63] block">
                  Organization
                </span>
                <h3 className="text-2xl font-bold text-[#1E1915]">Team</h3>
                <p className="text-xs text-[#5C554D]">
                  For analytics departments and collaborative ML teams.
                </p>
                <div className="pt-2">
                  <span className="text-4xl font-bold text-[#1E1915] font-serif">
                    {billingCycle === "annual" ? "$36" : "$45"}
                  </span>
                  <span className="text-xs text-[#736B63] ml-1">/ user / mo</span>
                </div>

                <div className="space-y-2.5 pt-4 border-t border-[#EFECE6] text-xs text-[#3D3730]">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0061FE]" />
                    <span>Everything in Pro</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0061FE]" />
                    <span>Shared team workspaces & roles</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0061FE]" />
                    <span>Version approval & merge reviews</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0061FE]" />
                    <span>End-to-end lineage DAG tracking</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0061FE]" />
                    <span>SOC 2 Type II audit logging</span>
                  </div>
                </div>
              </div>

              <a
                href="#previewer"
                className="w-full bg-[#FAF8F5] hover:bg-[#EFECE6] text-[#1E1915] border border-[#D6D0C7] text-xs font-semibold py-3.5 rounded-full text-center transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 block shadow-2xs"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Bold Bottom CTA Banner with Ambient Radial Glow */}
      <section className="bg-gradient-to-br from-[#0061FE] via-[#0052D4] to-[#003EA8] text-white py-24 px-6 relative overflow-hidden">
        {/* Soft Ambient Light Glow Inside Banner */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-white/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
          <h2 className="text-4xl sm:text-6xl font-bold tracking-tight font-serif">
            Ready to stop saving <br />
            <span className="underline decoration-white/30 underline-offset-8 font-mono text-3xl sm:text-5xl">
              final_v2_ACTUALLY_final.csv
            </span>?
          </h2>
          <p className="text-lg text-white/90 max-w-xl mx-auto font-normal leading-relaxed">
            Join quantitative researchers, data scientists, and engineering teams using Strata to preview, analyze, and version datasets effortlessly.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href="/register"
              className="w-full sm:w-auto bg-white text-[#0061FE] hover:bg-white/95 text-base font-bold px-9 py-4 rounded-full transition-all duration-200 shadow-[0_8px_25px_rgba(0,0,0,0.22)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
            >
              Get Started with Strata
            </Link>
            <a
              href="https://github.com/Jamesuchechi/Strata"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto glass-pill bg-white/10 hover:bg-white/20 text-white border border-white/30 text-base font-semibold px-8 py-4 rounded-full transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>View Source on GitHub</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#FAF8F5] border-t border-[#E8E4DF] py-16 px-6 text-xs text-[#736B63]">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-8">
          <div className="col-span-2 space-y-3">
            <StrataLogo size="md" />
            <p className="text-xs text-[#736B63] max-w-xs leading-relaxed">
              Version control for data. The AI-native Data Science Studio &amp; GitHub for datasets.
            </p>
            <p className="text-[11px] text-[#A89F95] font-mono pt-2">
              &copy; {new Date().getFullYear()} Strata Technologies, Inc. Apache 2.0.
            </p>
          </div>

          <div className="space-y-2.5">
            <p className="font-semibold text-[#1E1915] text-xs uppercase tracking-wider font-mono">Product</p>
            <ul className="space-y-2">
              <li><a href="#previewer" className="hover:text-[#0061FE] transition-colors">Universal Previewer</a></li>
              <li><a href="#analyst" className="hover:text-[#0061FE] transition-colors">Conversational Analyst</a></li>
              <li><a href="#versioning" className="hover:text-[#0061FE] transition-colors">Git Versioning & Diffs</a></li>
              <li><a href="#pricing" className="hover:text-[#0061FE] transition-colors">Pricing Tiers</a></li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <p className="font-semibold text-[#1E1915] text-xs uppercase tracking-wider font-mono">Account</p>
            <ul className="space-y-2">
              <li><Link href="/login" className="hover:text-[#0061FE] transition-colors">Sign In</Link></li>
              <li><Link href="/register" className="hover:text-[#0061FE] transition-colors">Create Account</Link></li>
              <li><Link href="/forgot-password" className="hover:text-[#0061FE] transition-colors">Reset Password</Link></li>
              <li><a href="https://github.com/Jamesuchechi/Strata" target="_blank" rel="noreferrer" className="hover:text-[#0061FE] transition-colors">API Keys</a></li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <p className="font-semibold text-[#1E1915] text-xs uppercase tracking-wider font-mono">Resources</p>
            <ul className="space-y-2">
              <li><a href="https://github.com/Jamesuchechi/Strata" target="_blank" rel="noreferrer" className="hover:text-[#0061FE] transition-colors">Documentation</a></li>
              <li><a href="https://github.com/Jamesuchechi/Strata" target="_blank" rel="noreferrer" className="hover:text-[#0061FE] transition-colors">Python SDK (strata)</a></li>
              <li><a href="https://github.com/Jamesuchechi/Strata" target="_blank" rel="noreferrer" className="hover:text-[#0061FE] transition-colors">API Reference</a></li>
              <li><a href="https://github.com/Jamesuchechi/Strata" target="_blank" rel="noreferrer" className="hover:text-[#0061FE] transition-colors">GitHub Repository</a></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
