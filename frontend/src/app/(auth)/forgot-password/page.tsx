"use client";

import React, { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await requestPasswordReset(email);
      setIsSubmitted(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit reset request.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto py-8">
      {!isSubmitted ? (
        <>
          {/* Header */}
          <div className="mb-6">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E1915]/60 hover:text-[#0061FE] mb-4 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to sign in
            </Link>
            <h1 className="font-serif text-3xl sm:text-4xl text-[#1E1915] font-normal tracking-tight">
              Reset password
            </h1>
            <p className="mt-2 text-sm text-[#1E1915]/65 leading-relaxed">
              Enter the email address tied to your Strata workspace. We'll send a one-time link to create a new password.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-[#1E1915] uppercase tracking-wider mb-1.5"
              >
                Account Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-xl border border-[#1E1915]/15 bg-white/90 px-4 py-2.5 text-sm text-[#1E1915] placeholder:text-[#1E1915]/35 focus:border-[#0061FE] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 transition-all shadow-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-[#0061FE] py-3 text-center text-sm font-semibold text-white shadow-md shadow-[#0061FE]/25 hover:bg-[#0052D4] disabled:opacity-50 transition-all duration-200"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending link...
                </span>
              ) : (
                "Send reset link"
              )}
            </button>
          </form>

          {/* Help box */}
          <div className="mt-8 rounded-xl border border-[#1E1915]/10 bg-white/60 p-4 text-xs text-[#1E1915]/70">
            <p className="font-semibold text-[#1E1915] mb-1">Using Single Sign-On (SSO)?</p>
            <p>
              If your organization logs in with Google Workspace or GitHub Enterprise, you do not need to reset a password. Simply{" "}
              <Link href="/login" className="text-[#0061FE] underline hover:text-[#0052D4]">
                sign in with your provider
              </Link>
              .
            </p>
          </div>
        </>
      ) : (
        /* Success State */
        <div className="rounded-2xl border border-[#0061FE]/20 bg-white/80 p-8 text-center backdrop-blur-md shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0061FE]/10 text-[#0061FE] mb-5">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <h2 className="font-serif text-2xl text-[#1E1915] font-normal mb-2">
            Check your inbox
          </h2>
          <p className="text-sm text-[#1E1915]/70 leading-relaxed mb-6">
            We've sent a password reset link to <span className="font-mono font-medium text-[#1E1915]">{email}</span>. The link will expire in 30 minutes for security reasons.
          </p>

          <div className="space-y-3">
            <Link
              href="/login"
              className="block w-full rounded-xl bg-[#1E1915] px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-black transition-colors"
            >
              Return to sign in
            </Link>

            <button
              onClick={() => setIsSubmitted(false)}
              className="text-xs text-[#0061FE] hover:underline"
            >
              Didn't receive email? Check spam or click to retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
