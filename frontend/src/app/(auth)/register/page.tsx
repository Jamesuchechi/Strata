"use client";

import React, { useState } from "react";
import Link from "next/link";
import OAuthButtons from "@/components/auth/OAuthButtons";
import PasswordStrengthMeter from "@/components/auth/PasswordStrengthMeter";
import { registerUser } from "@/lib/api";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("data_scientist");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await registerUser({
        email,
        full_name: fullName,
        password,
        role,
      });
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-md mx-auto py-8">
        <div className="rounded-2xl border border-[#0061FE]/20 bg-[#0061FE]/5 p-8 text-center backdrop-blur-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0061FE] text-white shadow-lg shadow-[#0061FE]/25 mb-5">
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>
          <h2 className="font-serif text-2xl text-[#1E1915] font-normal mb-2">
            Welcome aboard, {fullName.split(" ")[0] || "there"}!
          </h2>
          <p className="text-sm text-[#1E1915]/70 leading-relaxed mb-6">
            We sent a verification link to <span className="font-mono font-medium text-[#1E1915]">{email}</span>. Click it to activate your workspace with unlimited DuckDB compute.
          </p>
          <div className="space-y-3">
            <Link
              href="/dashboard"
              className="block w-full rounded-xl bg-[#0061FE] px-4 py-3 text-center text-sm font-semibold text-white shadow-md shadow-[#0061FE]/25 hover:bg-[#0052D4] transition-colors"
            >
              Enter Studio Dashboard
            </Link>
            <Link
              href="/login"
              className="block w-full rounded-xl bg-[#1E1915]/5 hover:bg-[#1E1915]/10 px-4 py-2 text-center text-xs font-semibold text-[#1E1915] transition-colors"
            >
              Sign In with different account
            </Link>
            <button
              onClick={() => setIsSuccess(false)}
              className="text-xs text-[#0061FE] hover:underline"
            >
              Didn't receive an email? Click here to retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto py-4">
      {/* Title & subtitle */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0061FE]/10 text-[#0061FE] text-xs font-semibold uppercase tracking-wider mb-2.5">
          14-day free trial • No CC required
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl text-[#1E1915] font-normal tracking-tight">
          Create your account
        </h1>
        <p className="mt-1.5 text-sm text-[#1E1915]/65">
          Join thousands of analysts querying gigabyte datasets with zero cloud wait.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-4 flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
          <div className="flex-1 leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {/* OAuth Buttons */}
      <OAuthButtons actionText="Sign up with" />

      {/* Or divider */}
      <div className="relative my-6 text-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#1E1915]/10" />
        </div>
        <span className="relative bg-[#F7F5F2] px-3 text-xs font-medium text-[#1E1915]/50 uppercase tracking-wider">
          Or register with email
        </span>
      </div>

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name */}
        <div>
          <label
            htmlFor="fullName"
            className="block text-xs font-semibold text-[#1E1915] uppercase tracking-wider mb-1.5"
          >
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ada Lovelace"
            className="w-full rounded-xl border border-[#1E1915]/15 bg-white/90 px-4 py-2.5 text-sm text-[#1E1915] placeholder:text-[#1E1915]/35 focus:border-[#0061FE] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 transition-all shadow-sm"
          />
        </div>

        {/* Work Email */}
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold text-[#1E1915] uppercase tracking-wider mb-1.5"
          >
            Work Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ada@acme-data.com"
            className="w-full rounded-xl border border-[#1E1915]/15 bg-white/90 px-4 py-2.5 text-sm text-[#1E1915] placeholder:text-[#1E1915]/35 focus:border-[#0061FE] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 transition-all shadow-sm"
          />
        </div>

        {/* Role Selector */}
        <div>
          <label
            htmlFor="role"
            className="block text-xs font-semibold text-[#1E1915] uppercase tracking-wider mb-1.5"
          >
            Primary Role
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "data_scientist", label: "Data Scientist / ML" },
              { id: "data_analyst", label: "Analytics Engineer" },
              { id: "researcher", label: "Academic / Chemist" },
              { id: "business", label: "Product / Strategy" },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id)}
                className={`rounded-xl px-3 py-2 text-left text-xs font-medium transition-all border ${
                  role === r.id
                    ? "border-[#0061FE] bg-[#0061FE]/10 text-[#0061FE] font-semibold"
                    : "border-[#1E1915]/10 bg-white/60 text-[#1E1915]/75 hover:bg-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold text-[#1E1915] uppercase tracking-wider mb-1.5"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a strong password"
              className="w-full rounded-xl border border-[#1E1915]/15 bg-white/90 px-4 py-2.5 pr-11 text-sm text-[#1E1915] placeholder:text-[#1E1915]/35 focus:border-[#0061FE] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 transition-all shadow-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#1E1915]/40 hover:text-[#1E1915]"
              tabIndex={-1}
            >
              {showPassword ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          {/* Password strength meter */}
          <PasswordStrengthMeter password={password} />
        </div>

        {/* Terms agreement checkbox */}
        <div className="pt-2">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              required
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#1E1915]/20 text-[#0061FE] focus:ring-[#0061FE]/30"
            />
            <span className="text-xs text-[#1E1915]/70 leading-normal">
              I agree to the{" "}
              <Link href="#" className="font-medium text-[#1E1915] underline hover:text-[#0061FE]">
                Terms of Service
              </Link>
              ,{" "}
              <Link href="#" className="font-medium text-[#1E1915] underline hover:text-[#0061FE]">
                Privacy Policy
              </Link>
              , and confirm data will remain client-isolated.
            </span>
          </label>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading || !agreedToTerms}
          className="relative w-full rounded-xl bg-[#0061FE] py-3 text-center text-sm font-semibold text-white shadow-md shadow-[#0061FE]/25 hover:bg-[#0052D4] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 mt-2"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating workspace...
            </span>
          ) : (
            "Create free account"
          )}
        </button>
      </form>

      {/* Switch to login */}
      <p className="mt-6 text-center text-sm text-[#1E1915]/70">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-[#0061FE] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
