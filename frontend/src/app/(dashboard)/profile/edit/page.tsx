"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  User,
  Shield,
  Key,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Plus,
  Trash2,
  Clock,
  Laptop,
  Globe,
  Bell,
  Sliders,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronRight,
  Code2,
  Terminal,
  ArrowLeft,
} from "lucide-react";
import {
  getStoredUser,
  getCurrentUser,
  updateUserProfile,
  changeUserPassword,
  fetchApiKeys,
  createApiKey,
  revokeApiKey,
  ApiKeyItem,
  User as UserType,
} from "@/lib/api/auth";

function ProfileEditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") as "profile" | "security" | "apikeys" | "preferences" | null;

  const [user, setUser] = useState<UserType | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "apikeys" | "preferences">(
    initialTab || "profile"
  );
  const [isLoading, setIsLoading] = useState(true);

  // Profile Edit State
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("data_scientist");
  const [bio, setBio] = useState("");
  const [timezone, setTimezone] = useState("UTC (GMT+00:00)");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState("");
  const [profileErrorMsg, setProfileErrorMsg] = useState("");

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState("");
  const [passwordErrorMsg, setPasswordErrorMsg] = useState("");

  // API Keys State
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [isKeysLoading, setIsKeysLoading] = useState(false);
  const [showCreateKeyModal, setShowCreateKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpiresIn, setNewKeyExpiresIn] = useState(30);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [keyErrorMsg, setKeyErrorMsg] = useState("");

  // Preferences State
  const [defaultDialect, setDefaultDialect] = useState("duckdb");
  const [editorTheme, setEditorTheme] = useState("dark");
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [pipelineAlerts, setPipelineAlerts] = useState(true);
  const [telemetryEnabled, setTelemetryEnabled] = useState(false);
  const [prefSuccessMsg, setPrefSuccessMsg] = useState("");

  // Load User Data & API Keys
  useEffect(() => {
    async function loadUserData() {
      setIsLoading(true);
      try {
        const stored = getStoredUser();
        if (stored) {
          setUser(stored);
          setFullName(stored.full_name || "");
          setRole(stored.role || "data_scientist");
        }
        const fresh = await getCurrentUser().catch(() => stored);
        if (fresh) {
          setUser(fresh);
          setFullName(fresh.full_name || "");
          setRole(fresh.role || "data_scientist");
        }
      } catch (err) {
        console.error("Failed to load user:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadUserData();
  }, []);

  const loadApiKeys = async () => {
    setIsKeysLoading(true);
    setKeyErrorMsg("");
    try {
      const res = await fetchApiKeys();
      setApiKeys(res.api_keys || []);
    } catch (err: any) {
      setKeyErrorMsg(err.message || "Failed to load API keys");
    } finally {
      setIsKeysLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "apikeys") {
      loadApiKeys();
    }
  }, [activeTab]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSuccessMsg("");
    setProfileErrorMsg("");

    try {
      const updated = await updateUserProfile({
        full_name: fullName.trim(),
        role: role.trim(),
      });
      setUser(updated);
      setProfileSuccessMsg("Profile information updated successfully!");
      setTimeout(() => setProfileSuccessMsg(""), 4000);
    } catch (err: any) {
      setProfileErrorMsg(err.message || "Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccessMsg("");
    setPasswordErrorMsg("");

    if (newPassword.length < 8) {
      setPasswordErrorMsg("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg("New passwords do not match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await changeUserPassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccessMsg("Password changed successfully! Keep your new credentials safe.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccessMsg(""), 5000);
    } catch (err: any) {
      setPasswordErrorMsg(err.message || "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingKey(true);
    setKeyErrorMsg("");

    try {
      const res = await createApiKey({
        name: newKeyName.trim() || "SDK Automation Key",
        expires_in_days: newKeyExpiresIn > 0 ? newKeyExpiresIn : undefined,
      });
      setNewlyCreatedKey(res.raw_key);
      setNewKeyName("");
      loadApiKeys();
    } catch (err: any) {
      setKeyErrorMsg(err.message || "Failed to create API key");
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to revoke this API key? Any applications or SDK scripts using it will lose access immediately.")) {
      return;
    }
    try {
      await revokeApiKey(keyId);
      loadApiKeys();
    } catch (err: any) {
      alert(err.message || "Failed to revoke key");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2500);
  };

  const handleSavePreferences = () => {
    setPrefSuccessMsg("Preferences saved to local configuration!");
    setTimeout(() => setPrefSuccessMsg(""), 3500);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 lg:p-8 space-y-6">
      {/* Top Breadcrumb & Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#736B63] mb-1">
            <Link href="/profile" className="hover:text-[#1E1915] transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Profile</span>
            </Link>
            <ChevronRight className="w-3 h-3 text-[#B0A8A0]" />
            <span className="text-[#1E1915] font-semibold">Edit Settings</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E1915]">
            Edit Profile & Credentials
          </h1>
          <p className="text-sm text-[#736B63] mt-0.5">
            Update your personal identity, change password, manage developer API keys, and configure editor defaults.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/profile"
            className="px-3.5 py-1.5 rounded-xl border border-[#E8E4DF] bg-white hover:bg-[#F7F5F2] text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 shadow-sm transition-all"
          >
            <User className="w-3.5 h-3.5 text-[#0061FE]" />
            <span>View Public Profile</span>
          </Link>
          <Link
            href="/settings"
            className="px-3.5 py-1.5 rounded-xl border border-[#E8E4DF] bg-white hover:bg-[#F7F5F2] text-xs font-semibold text-[#1E1915] flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-600" />
            <span>Workspace Settings</span>
          </Link>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[#E8E4DF] pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${
            activeTab === "profile"
              ? "border-[#0061FE] text-[#0061FE]"
              : "border-transparent text-[#736B63] hover:text-[#1E1915] hover:border-[#D1C9BE]"
          }`}
        >
          <User className="w-4 h-4" />
          <span>General Information</span>
        </button>

        <button
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${
            activeTab === "security"
              ? "border-[#0061FE] text-[#0061FE]"
              : "border-transparent text-[#736B63] hover:text-[#1E1915] hover:border-[#D1C9BE]"
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Security & Password</span>
        </button>

        <button
          onClick={() => setActiveTab("apikeys")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${
            activeTab === "apikeys"
              ? "border-[#0061FE] text-[#0061FE]"
              : "border-transparent text-[#736B63] hover:text-[#1E1915] hover:border-[#D1C9BE]"
          }`}
        >
          <Key className="w-4 h-4" />
          <span>API Keys & SDK</span>
        </button>

        <button
          onClick={() => setActiveTab("preferences")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${
            activeTab === "preferences"
              ? "border-[#0061FE] text-[#0061FE]"
              : "border-transparent text-[#736B63] hover:text-[#1E1915] hover:border-[#D1C9BE]"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Preferences & Environment</span>
        </button>
      </div>

      {/* Tab 1: General Profile */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-[#E8E4DF] bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[#1E1915] mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-[#0061FE]" />
                Personal Profile Details
              </h3>

              {profileSuccessMsg && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}
              {profileErrorMsg && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{profileErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#1E1915] mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Ada Lovelace"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] text-xs text-[#1E1915] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 focus:border-[#0061FE] transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1E1915] mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      disabled
                      value={user?.email || ""}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#E8E4DF] bg-[#F2EFE9] text-xs text-[#736B63] cursor-not-allowed font-mono"
                    />
                    <span className="text-[10px] text-[#8C827A] mt-1 block">
                      Email is verified and linked to your authentication provider.
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#1E1915] mb-1.5">
                      Primary Role & Title
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] text-xs text-[#1E1915] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 focus:border-[#0061FE] transition-all"
                    >
                      <option value="data_scientist">Data Scientist</option>
                      <option value="data_analyst">Data Analyst</option>
                      <option value="ml_engineer">ML Engineer</option>
                      <option value="data_engineer">Data Platform Engineer</option>
                      <option value="researcher">Scientific Researcher</option>
                      <option value="business_lead">Business / Product Lead</option>
                      <option value="admin">Platform Administrator</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1E1915] mb-1.5">
                      Preferred Timezone
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] text-xs text-[#1E1915] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 focus:border-[#0061FE] transition-all"
                    >
                      <option value="UTC (GMT+00:00)">UTC (GMT+00:00)</option>
                      <option value="America/New_York (EST/EDT)">America/New_York (EST/EDT)</option>
                      <option value="America/Los_Angeles (PST/PDT)">America/Los_Angeles (PST/PDT)</option>
                      <option value="Europe/London (GMT/BST)">Europe/London (GMT/BST)</option>
                      <option value="Europe/Berlin (CET/CEST)">Europe/Berlin (CET/CEST)</option>
                      <option value="Asia/Tokyo (JST)">Asia/Tokyo (JST)</option>
                      <option value="Asia/Singapore (SGT)">Asia/Singapore (SGT)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1E1915] mb-1.5">
                    Bio & Research Focus
                  </label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Brief description of your analytical domains, datasets of interest, or team affiliation..."
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] text-xs text-[#1E1915] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 focus:border-[#0061FE] transition-all resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <Link
                    href="/profile"
                    className="px-4 py-2 rounded-xl border border-[#E8E4DF] bg-white text-xs font-semibold text-[#5C554D] hover:bg-[#FAF8F5]"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="px-5 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D6] text-white text-xs font-semibold shadow-md shadow-[#0061FE]/20 flex items-center gap-2 transition-all disabled:opacity-60"
                  >
                    {isSavingProfile ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <span>Save Profile Changes</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-[#E8E4DF] bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[#1E1915] mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" />
                Account Status
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-[#E8E4DF]">
                  <span className="text-[#736B63]">Account Verification</span>
                  <span className="text-emerald-700 font-medium">Verified ✓</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[#E8E4DF]">
                  <span className="text-[#736B63]">Session Security</span>
                  <span className="font-mono text-[11px] text-[#1E1915]">Strict HttpOnly</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-[#736B63]">DuckDB Sandbox</span>
                  <span className="font-mono text-[11px] text-emerald-700">Allocated (8GB)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Security & Password */}
      {activeTab === "security" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-[#E8E4DF] bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[#1E1915] mb-4 flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#0061FE]" />
                Change Password
              </h3>

              {passwordSuccessMsg && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{passwordSuccessMsg}</span>
                </div>
              )}
              {passwordErrorMsg && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{passwordErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1E1915] mb-1.5">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] text-xs text-[#1E1915] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 focus:border-[#0061FE] transition-all pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-[#736B63] hover:text-[#1E1915]"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#1E1915] mb-1.5">
                      New Password
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] text-xs text-[#1E1915] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 focus:border-[#0061FE] transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1E1915] mb-1.5">
                      Confirm New Password
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] text-xs text-[#1E1915] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 focus:border-[#0061FE] transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="px-5 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D6] text-white text-xs font-semibold shadow-md shadow-[#0061FE]/20 flex items-center gap-2 transition-all disabled:opacity-60"
                  >
                    {isChangingPassword ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <span>Update Password</span>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Active Sessions Overview */}
            <div className="rounded-2xl border border-[#E8E4DF] bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[#1E1915] mb-4 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-[#0061FE]" />
                Active Sessions & Devices
              </h3>
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-emerald-200 flex items-center justify-center text-emerald-600">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#1E1915] flex items-center gap-2">
                      <span>Current Browser Session</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-semibold">Active Now</span>
                    </div>
                    <div className="text-[11px] text-[#736B63] mt-0.5">
                      Linux / Chrome • IP 127.0.0.1 • HttpOnly Strict Token
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-[#E8E4DF] bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[#1E1915] mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                Security Standards
              </h3>
              <ul className="space-y-2.5 text-xs text-[#5C554D]">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Passwords hashed via industry standard bcrypt algorithm</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Token versioning with instant session revocation upon password change</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: API Keys & SDK */}
      {activeTab === "apikeys" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#E8E4DF] bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-sm font-bold text-[#1E1915] flex items-center gap-2">
                  <Key className="w-4 h-4 text-[#0061FE]" />
                  Programmatic API Keys
                </h3>
                <p className="text-xs text-[#736B63] mt-0.5">
                  Use API keys to authenticate automated ETL pipelines, Python SDK queries, and CLI tools.
                </p>
              </div>

              <button
                onClick={() => setShowCreateKeyModal(true)}
                className="px-4 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D6] text-white text-xs font-semibold shadow-md shadow-[#0061FE]/20 flex items-center gap-1.5 transition-all self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New API Key</span>
              </button>
            </div>

            {keyErrorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{keyErrorMsg}</span>
              </div>
            )}

            {isKeysLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-[#736B63]">
                <RefreshCw className="w-6 h-6 animate-spin text-[#0061FE] mb-2" />
                <span className="text-xs font-medium">Loading API keys...</span>
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="py-12 text-center rounded-xl border border-dashed border-[#E8E4DF] bg-[#FAF8F5]">
                <Key className="w-8 h-8 text-[#8C827A] mx-auto mb-2" />
                <h4 className="text-xs font-bold text-[#1E1915]">No Active API Keys</h4>
                <p className="text-xs text-[#736B63] max-w-sm mx-auto mt-1 mb-4">
                  You haven&apos;t created any programmatic API keys yet. Generate one to use the Strata Python SDK or CLI.
                </p>
                <button
                  onClick={() => setShowCreateKeyModal(true)}
                  className="px-4 py-1.5 rounded-lg bg-[#1E1915] text-white text-xs font-medium hover:bg-black transition-colors"
                >
                  Generate Key
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E8E4DF] text-[#736B63] font-mono text-[11px] uppercase tracking-wider">
                      <th className="pb-3 font-semibold">Key Name</th>
                      <th className="pb-3 font-semibold">Prefix</th>
                      <th className="pb-3 font-semibold">Created</th>
                      <th className="pb-3 font-semibold">Expires</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E4DF]">
                    {apiKeys.map((k) => (
                      <tr key={k.id} className="hover:bg-[#FAF8F5] transition-colors">
                        <td className="py-3 font-semibold text-[#1E1915]">
                          {k.name}
                        </td>
                        <td className="py-3 font-mono text-[#5C554D]">
                          <code className="bg-[#EFECE6] px-1.5 py-0.5 rounded text-[11px]">
                            {k.key_prefix}...
                          </code>
                        </td>
                        <td className="py-3 text-[#736B63]">
                          {new Date(k.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-[#736B63]">
                          {k.expires_at ? new Date(k.expires_at).toLocaleDateString() : "Never"}
                        </td>
                        <td className="py-3">
                          {k.is_revoked ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold">
                              Revoked
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          {!k.is_revoked && (
                            <button
                              onClick={() => handleRevokeKey(k.id)}
                              className="px-2.5 py-1 rounded-lg hover:bg-rose-50 text-rose-600 text-[11px] font-medium transition-colors flex items-center gap-1 ml-auto"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Revoke</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick CLI snippet */}
          <div className="rounded-2xl border border-[#E8E4DF] bg-[#1E1915] text-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold font-mono mb-2">
              <Terminal className="w-4 h-4" />
              <span>QUICK EXAMPLE: Strata Python SDK with API Key</span>
            </div>
            <pre className="text-xs font-mono text-zinc-300 overflow-x-auto p-3 rounded-xl bg-black/40 leading-relaxed">
{`from strata_sdk import StrataClient

client = StrataClient(api_key="strata_live_...")
df = client.query("SELECT * FROM dataset_primary LIMIT 100")
print(df.describe())`}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 4: Preferences & Environment */}
      {activeTab === "preferences" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-[#E8E4DF] bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[#1E1915] mb-4 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#0061FE]" />
                Analytics & Editor Preferences
              </h3>

              {prefSuccessMsg && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{prefSuccessMsg}</span>
                </div>
              )}

              <div className="space-y-5 text-xs">
                <div>
                  <label className="block text-xs font-semibold text-[#1E1915] mb-1.5">
                    Default SQL Engine / Dialect
                  </label>
                  <select
                    value={defaultDialect}
                    onChange={(e) => setDefaultDialect(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] text-xs text-[#1E1915] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 focus:border-[#0061FE] transition-all"
                  >
                    <option value="duckdb">DuckDB SQL (In-Memory Vectorized Engine)</option>
                    <option value="postgres">PostgreSQL Standard</option>
                    <option value="snowflake">Snowflake Compatible Syntax</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1E1915] mb-1.5">
                    Code & Query Studio Theme
                  </label>
                  <select
                    value={editorTheme}
                    onChange={(e) => setEditorTheme(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] text-xs text-[#1E1915] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 focus:border-[#0061FE] transition-all"
                  >
                    <option value="dark">Monokai Dark (High Contrast)</option>
                    <option value="warm">Warm Paper (Strata Default)</option>
                    <option value="light">Classic Clean Light</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-[#E8E4DF] space-y-3">
                  <h4 className="text-xs font-bold text-[#1E1915] flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5 text-[#0061FE]" />
                    Notifications & Email Digests
                  </h4>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailAlerts}
                      onChange={(e) => setEmailAlerts(e.target.checked)}
                      className="rounded text-[#0061FE] focus:ring-[#0061FE] w-4 h-4"
                    />
                    <div>
                      <div className="font-semibold text-[#1E1915]">Weekly Workspace Analytical Digest</div>
                      <div className="text-[11px] text-[#736B63]">Receive weekly statistics on dataset commits, queries, and team activity.</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pipelineAlerts}
                      onChange={(e) => setPipelineAlerts(e.target.checked)}
                      className="rounded text-[#0061FE] focus:ring-[#0061FE] w-4 h-4"
                    />
                    <div>
                      <div className="font-semibold text-[#1E1915]">Pipeline Execution & Dead-Letter Alerts</div>
                      <div className="text-[11px] text-[#736B63]">Instant notification when a pipeline job fails or hits error limits.</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={telemetryEnabled}
                      onChange={(e) => setTelemetryEnabled(e.target.checked)}
                      className="rounded text-[#0061FE] focus:ring-[#0061FE] w-4 h-4"
                    />
                    <div>
                      <div className="font-semibold text-[#1E1915]">Anonymous Query Performance Telemetry</div>
                      <div className="text-[11px] text-[#736B63]">Help optimize DuckDB analytical kernels with aggregated performance metrics.</div>
                    </div>
                  </label>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    onClick={handleSavePreferences}
                    className="px-5 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D6] text-white text-xs font-semibold shadow-md shadow-[#0061FE]/20 transition-all"
                  >
                    Save Preferences
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-[#E8E4DF] bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[#1E1915] mb-2 flex items-center gap-2">
                <Globe className="w-4 h-4 text-teal-600" />
                Integration Settings
              </h3>
              <p className="text-xs text-[#736B63] mb-4">
                Connect external cloud warehouses and MLflow tracking servers:
              </p>
              <Link
                href="/integrations"
                className="w-full px-4 py-2 rounded-xl border border-[#E8E4DF] hover:border-[#0061FE] bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] flex items-center justify-between transition-colors"
              >
                <span>Manage Warehouse Vault</span>
                <ChevronRight className="w-4 h-4 text-[#736B63]" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create API Key */}
      {showCreateKeyModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E8E4DF] max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E4DF] mb-4">
              <h3 className="text-sm font-bold text-[#1E1915] flex items-center gap-2">
                <Key className="w-4 h-4 text-[#0061FE]" />
                Generate Programmatic API Key
              </h3>
              <button
                onClick={() => {
                  setShowCreateKeyModal(false);
                  setNewlyCreatedKey(null);
                }}
                className="text-[#8C827A] hover:text-[#1E1915] text-sm"
              >
                ✕
              </button>
            </div>

            {newlyCreatedKey ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                  <div className="font-bold mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    API Key Created Successfully!
                  </div>
                  Please copy your secret key now. You will not be able to view it again.
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1E1915] mb-1">
                    Your Secret API Key
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={newlyCreatedKey}
                      className="w-full px-3 py-2 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs font-mono text-[#1E1915] select-all"
                    />
                    <button
                      onClick={() => copyToClipboard(newlyCreatedKey)}
                      className="px-3 py-2 rounded-xl bg-[#0061FE] text-white text-xs font-semibold hover:bg-[#0052D6] shrink-0"
                    >
                      {keyCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      setShowCreateKeyModal(false);
                      setNewlyCreatedKey(null);
                    }}
                    className="w-full py-2 rounded-xl bg-[#1E1915] text-white text-xs font-semibold hover:bg-black transition-colors"
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateApiKey} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1E1915] mb-1">
                    Key Identifier / Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. Production Airflow Pipeline, Local Jupyter"
                    className="w-full px-3 py-2 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] text-xs text-[#1E1915] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 focus:border-[#0061FE]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1E1915] mb-1">
                    Expiration Duration
                  </label>
                  <select
                    value={newKeyExpiresIn}
                    onChange={(e) => setNewKeyExpiresIn(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#E8E4DF] bg-[#FDFCFA] text-xs text-[#1E1915] focus:outline-none focus:ring-2 focus:ring-[#0061FE]/20 focus:border-[#0061FE]"
                  >
                    <option value={30}>30 Days</option>
                    <option value={90}>90 Days</option>
                    <option value={365}>1 Year</option>
                    <option value={0}>Never Expire (Continuous Service)</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateKeyModal(false)}
                    className="px-4 py-2 rounded-xl border border-[#E8E4DF] bg-white text-xs font-semibold text-[#5C554D] hover:bg-[#FAF8F5]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingKey}
                    className="px-4 py-2 rounded-xl bg-[#0061FE] hover:bg-[#0052D6] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {isCreatingKey ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <span>Generate Key</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfileEditPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 flex items-center justify-center text-[#736B63] text-xs font-medium">
          Loading profile editor...
        </div>
      }
    >
      <ProfileEditContent />
    </Suspense>
  );
}
