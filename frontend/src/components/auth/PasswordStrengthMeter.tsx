"use client";

import React from "react";
import { Check, X } from "lucide-react";

interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  if (!password) return null;

  const hasLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const hasUpperLower = /[a-z]/.test(password) && /[A-Z]/.test(password);

  const score = [hasLength, hasNumber, hasSpecial, hasUpperLower].filter(Boolean).length;

  const getLabel = () => {
    if (score <= 1) return { text: "Weak", color: "text-[#E02424]", bg: "bg-[#E02424]" };
    if (score <= 3) return { text: "Fair", color: "text-[#E3A008]", bg: "bg-[#E3A008]" };
    return { text: "Strong", color: "text-[#057A55]", bg: "bg-[#057A55]" };
  };

  const status = getLabel();

  return (
    <div className="space-y-2 pt-1">
      {/* Progress Bars */}
      <div className="flex gap-1.5 h-1.5 w-full">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`h-full flex-1 rounded-full transition-all duration-300 ${
              score >= step ? status.bg : "bg-[#E8E4DF]"
            }`}
          />
        ))}
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-[#736B63]">Password security:</span>
        <span className={`font-bold ${status.color}`}>{status.text}</span>
      </div>

      {/* Criteria Checklist */}
      <div className="grid grid-cols-2 gap-1 pt-1 text-[10px] font-mono text-[#736B63]">
        <div className="flex items-center gap-1">
          {hasLength ? <Check className="w-3 h-3 text-[#057A55]" /> : <span className="w-3 h-3 block" />}
          <span className={hasLength ? "text-[#057A55]" : ""}>At least 8 characters</span>
        </div>
        <div className="flex items-center gap-1">
          {hasNumber ? <Check className="w-3 h-3 text-[#057A55]" /> : <span className="w-3 h-3 block" />}
          <span className={hasNumber ? "text-[#057A55]" : ""}>Contains a number</span>
        </div>
        <div className="flex items-center gap-1">
          {hasUpperLower ? <Check className="w-3 h-3 text-[#057A55]" /> : <span className="w-3 h-3 block" />}
          <span className={hasUpperLower ? "text-[#057A55]" : ""}>Upper & lowercase</span>
        </div>
        <div className="flex items-center gap-1">
          {hasSpecial ? <Check className="w-3 h-3 text-[#057A55]" /> : <span className="w-3 h-3 block" />}
          <span className={hasSpecial ? "text-[#057A55]" : ""}>Special character</span>
        </div>
      </div>
    </div>
  );
}

export default PasswordStrengthMeter;
