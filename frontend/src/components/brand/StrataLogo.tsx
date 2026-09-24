"use client";

import React from "react";
import Link from "next/link";

interface StrataMarkProps {
  size?: number;
  className?: string;
}

export function StrataMark({ size = 32, className = "" }: StrataMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-200 ${className}`}
      aria-label="Strata brand mark"
    >
      <defs>
        <linearGradient id="sm-top-surface" x1="16" y1="16" x2="84" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#0061FE" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        <linearGradient id="sm-top-inner" x1="30" y1="23" x2="70" y2="41" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#BAE6FD" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.1" />
        </linearGradient>

        <linearGradient id="sm-mid-surface" x1="16" y1="36" x2="84" y2="68" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="60%" stopColor="#0052D4" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>

        <linearGradient id="sm-bot-surface" x1="16" y1="56" x2="84" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0369A1" />
          <stop offset="70%" stopColor="#1E40AF" />
          <stop offset="100%" stopColor="#172554" />
        </linearGradient>

        <linearGradient id="sm-glow" x1="50" y1="10" x2="50" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#0061FE" stopOpacity="0.05" />
        </linearGradient>

        <filter id="sm-shadow" x="-10%" y="-10%" width="120%" height="130%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#0061FE" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Subtle ambient backglow */}
      <circle cx="50" cy="50" r="38" fill="url(#sm-glow)" />

      <g filter="url(#sm-shadow)">
        {/* Layer 3 - Bottom Stratum */}
        <path d="M 16 72 L 50 88 L 50 94 L 16 78 Z" fill="#0C4A6E" />
        <path d="M 50 88 L 84 72 L 84 78 L 50 94 Z" fill="#082F49" />
        <path d="M 50 56 L 84 72 L 50 88 L 16 72 Z" fill="url(#sm-bot-surface)" stroke="#38BDF8" strokeOpacity="0.3" strokeWidth="0.75" />

        {/* Layer 2 - Middle Stratum */}
        <path d="M 16 52 L 50 68 L 50 74 L 16 58 Z" fill="#075985" />
        <path d="M 50 68 L 84 52 L 84 58 L 50 74 Z" fill="#0369A1" />
        <path d="M 50 36 L 84 52 L 50 68 L 16 52 Z" fill="url(#sm-mid-surface)" stroke="#7DD3FC" strokeOpacity="0.4" strokeWidth="0.75" />

        {/* Layer 1 - Top Stratum */}
        <path d="M 16 32 L 50 48 L 50 54 L 16 38 Z" fill="#0284C7" />
        <path d="M 50 48 L 84 32 L 84 38 L 50 54 Z" fill="#0052D4" />
        <path d="M 50 16 L 84 32 L 50 48 L 16 32 Z" fill="url(#sm-top-surface)" stroke="#BAE6FD" strokeOpacity="0.75" strokeWidth="1" />
        {/* Inner crystal facet */}
        <path d="M 50 22 L 74 32 L 50 42 L 26 32 Z" fill="url(#sm-top-inner)" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="0.75" />
      </g>
    </svg>
  );
}

interface StrataLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  markSize?: number;
  showWordmark?: boolean;
  showTagline?: boolean;
  href?: string;
  className?: string;
  theme?: "light" | "dark";
}

export function StrataLogo({
  size = "md",
  markSize,
  showWordmark = true,
  showTagline = false,
  href,
  className = "",
  theme = "light",
}: StrataLogoProps) {
  const sizeMap = {
    sm: { mark: 24, text: "text-lg", tag: "text-[10px]" },
    md: { mark: 32, text: "text-xl", tag: "text-xs" },
    lg: { mark: 40, text: "text-2xl", tag: "text-xs" },
    xl: { mark: 52, text: "text-3xl", tag: "text-sm" },
  };

  const currentSize = sizeMap[size];
  const actualMarkSize = markSize || currentSize.mark;

  const content = (
    <div className={`flex items-center gap-2.5 group select-none ${className}`}>
      <div className="relative flex items-center justify-center">
        <StrataMark size={actualMarkSize} className="group-hover:scale-105 transition-transform duration-200" />
      </div>

      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span
            className={`font-serif font-bold tracking-tight transition-colors ${
              theme === "dark" ? "text-white" : "text-[#1E1915]"
            } ${currentSize.text}`}
          >
            Strata
          </span>
          {showTagline && (
            <span
              className={`font-mono uppercase tracking-wider mt-0.5 ${
                theme === "dark" ? "text-slate-400" : "text-[#736B63]"
              } ${currentSize.tag}`}
            >
              AI Data Studio
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center">
        {content}
      </Link>
    );
  }

  return content;
}
