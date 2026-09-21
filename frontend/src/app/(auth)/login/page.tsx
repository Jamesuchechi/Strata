"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, ArrowRight, Mail, Lock, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { loginUser, requestMagicLink } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [authMethod, setAuthMethod] = useState<"password" | "magic-link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      if (authMethod === "magic-link") {
        await requestMagicLink(email);
        setMagicLinkSent(true);
      } else {
        await loginUser({
          email,
          password,
          remember_me: rememberMe,
        });
        // Success redirect to studio dashboard
        router.push("/dashboard");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to authenticate. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Title & Subtitle */}
      <div className="space-y-1.5 text-center sm:text-left">
        <h1 className="text-3xl font-bold font-serif tracking-tight text-[#1E1915]">
          Sign in to Strata
        </h1>
        <p className="text-xs text-[#5C554D]">
          Access your versioned datasets, AI notebooks, and team workspaces.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
          <div className="flex-1 leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {/* Social OAuth */}
      <OAuthButtons />

      {/* Divider */}
      <div className="relative flex items-center justify-center">
        <div className="border-t border-[#E8E4DF] w-full" />
        <span className="bg-[#F7F5F2] px-3 text-[11px] font-mono uppercase tracking-wider text-[#8C827A] absolute">
          or continue with email
        </span>
      </div>

      {/* Method Tabs Toggle (Password vs Magic Link) */}
      <div className="flex p-1 rounded-full bg-[#EFECE6] border border-[#E8E4DF] text-xs font-semibold">
        <button
          type="button"
          onClick={() => {
            setAuthMethod("password");
            setMagicLinkSent(false);
          }}
          className={`flex-1 py-1.5 rounded-full transition-all duration-200 ${
            authMethod === "password"
              ? "bg-white text-[#1E1915] shadow-xs font-bold"
              : "text-[#736B63] hover:text-[#1E1915]"
          }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthMethod("magic-link");
            setMagicLinkSent(false);
          }}
          className={`flex-1 py-1.5 rounded-full transition-all duration-200 ${
            authMethod === "magic-link"
              ? "bg-white text-[#1E1915] shadow-xs font-bold"
              : "text-[#736B63] hover:text-[#1E1915]"
          }`}
        >
          Passwordless Magic Link
        </button>
      </div>

      {magicLinkSent ? (
        <div className="p-6 rounded-2xl bg-white border border-[#E8E4DF] shadow-sm text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#DEF7EC] text-[#057A55] flex items-center justify-center mx-auto">
            <Mail className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#1E1915]">Check your inbox</h3>
          <p className="text-xs text-[#5C554D] leading-relaxed">
            We sent a secure magic link to <strong className="font-mono text-[#1E1915]">{email}</strong>. Click the link in your email to sign in instantly.
          </p>
          <button
            type="button"
            onClick={() => setMagicLinkSent(false)}
            className="text-xs text-[#0061FE] font-medium hover:underline pt-2 inline-block"
          >
            Use a different email or sign in with password
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#1E1915] block">
              Work Email
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full bg-white border border-[#D6D0C7] focus:border-[#0061FE] rounded-xl px-4 py-3 text-xs text-[#1E1915] placeholder-[#A89F95] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 transition-all"
              />
              <Mail className="w-4 h-4 text-[#A89F95] absolute right-3.5 top-3.5" />
            </div>
          </div>

          {/* Password Input (only if password method) */}
          {authMethod === "password" && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#1E1915]">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-[#0061FE] hover:underline font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-white border border-[#D6D0C7] focus:border-[#0061FE] rounded-xl px-4 py-3 text-xs text-[#1E1915] placeholder-[#A89F95] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-[#A89F95] hover:text-[#1E1915] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Remember Me */}
          {authMethod === "password" && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-[#D6D0C7] text-[#0061FE] focus:ring-[#0061FE] accent-[#0061FE]"
              />
              <label htmlFor="remember" className="text-xs text-[#5C554D] cursor-pointer">
                Remember this device for 30 days
              </label>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0061FE] hover:bg-[#0048D9] text-white text-xs font-semibold py-3.5 rounded-full transition-all duration-200 shadow-[0_3px_10px_rgba(0,97,254,0.3)] hover:shadow-[0_6px_20px_rgba(0,97,254,0.4)] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 pt-3"
          >
            <span>{loading ? "Verifying..." : authMethod === "magic-link" ? "Send Magic Link" : "Sign In"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* Link to Register */}
      <p className="text-center text-xs text-[#5C554D] pt-2">
        Don&apos;t have a Strata account?{" "}
        <Link href="/register" className="text-[#0061FE] font-semibold hover:underline">
          Create account free
        </Link>
      </p>
    </div>
  );
}
