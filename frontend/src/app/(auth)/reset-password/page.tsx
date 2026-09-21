"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PasswordStrengthMeter from "@/components/auth/PasswordStrengthMeter";
import { resetPassword } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordsMatch || password.length < 8) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await resetPassword({
        email: initialEmail || undefined,
        token: token || undefined,
        new_password: password,
      });
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update password. Please check your link or try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-md mx-auto py-8">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/60 p-8 text-center backdrop-blur-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 mb-5">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="font-serif text-2xl text-[#1E1915] font-normal mb-2">
            Password updated!
          </h2>
          <p className="text-sm text-[#1E1915]/70 leading-relaxed mb-6">
            Your new password has been saved securely. All existing active sessions have been invalidated for your safety.
          </p>
          <Link
            href="/login"
            className="block w-full rounded-xl bg-[#0061FE] px-4 py-3 text-center text-sm font-semibold text-white shadow-md shadow-[#0061FE]/25 hover:bg-[#0052D4] transition-colors"
          >
            Sign in with new password
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-3xl sm:text-4xl text-[#1E1915] font-normal tracking-tight">
          Create new password
        </h1>
        <p className="mt-2 text-sm text-[#1E1915]/65 leading-relaxed">
          {initialEmail ? (
            <>
              Resetting credentials for <span className="font-mono font-medium text-[#1E1915]">{initialEmail}</span>.
            </>
          ) : (
            "Choose a strong, unique password to secure your Strata datasets and pipelines."
          )}
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-4 flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
          <div className="flex-1 leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* New Password */}
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold text-[#1E1915] uppercase tracking-wider mb-1.5"
          >
            New Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
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

          <PasswordStrengthMeter password={password} />
        </div>

        {/* Confirm Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="confirmPassword"
              className="block text-xs font-semibold text-[#1E1915] uppercase tracking-wider"
            >
              Confirm Password
            </label>
            {confirmPassword.length > 0 && (
              <span className={`text-xs font-medium ${passwordsMatch ? "text-emerald-600" : "text-amber-600"}`}>
                {passwordsMatch ? "✓ Passwords match" : "Passwords do not match"}
              </span>
            )}
          </div>
          <input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your new password"
            className={`w-full rounded-xl border bg-white/90 px-4 py-2.5 text-sm text-[#1E1915] placeholder:text-[#1E1915]/35 focus:outline-none focus:ring-2 transition-all shadow-sm ${
              confirmPassword.length > 0 && !passwordsMatch
                ? "border-amber-400 focus:border-amber-500 focus:ring-amber-500/20"
                : "border-[#1E1915]/15 focus:border-[#0061FE] focus:ring-[#0061FE]/20"
            }`}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading || !passwordsMatch || password.length < 8}
          className="w-full rounded-xl bg-[#0061FE] py-3 text-center text-sm font-semibold text-white shadow-md shadow-[#0061FE]/25 hover:bg-[#0052D4] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 mt-2"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Updating password...
            </span>
          ) : (
            "Set new password"
          )}
        </button>
      </form>

      {/* Back to sign in */}
      <p className="mt-6 text-center text-sm text-[#1E1915]/70">
        Remembered your password?{" "}
        <Link href="/login" className="font-semibold text-[#0061FE] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md mx-auto py-16 text-center text-sm text-[#1E1915]/50">
          Loading password reset form...
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
