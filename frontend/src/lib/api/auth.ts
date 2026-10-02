/**
 * Authentication API service for Strata.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface RegisterPayload {
  email: string;
  full_name: string;
  password: string;
  role?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface ResetPasswordPayload {
  token: string;
  new_password: string;
}

// Client-side Profile & Token Storage Helpers
const USER_KEY = "strata_user_profile";
const TOKEN_KEY = "strata_access_token";
const REFRESH_TOKEN_KEY = "strata_refresh_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setStoredRefreshToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// API Endpoints
export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: "Registration failed" }));
    throw new Error(errorData.detail || `Registration failed with status ${response.status}`);
  }

  const data: AuthResponse & { refresh_token?: string } = await response.json();
  setStoredUser(data.user);
  if (data.access_token) {
    setStoredToken(data.access_token);
  }
  if (data.refresh_token) {
    setStoredRefreshToken(data.refresh_token);
  }
  return data;
}

export async function loginUser(payload: LoginPayload): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(errorData.detail || `Login failed with status ${response.status}`);
  }

  const data: AuthResponse & { refresh_token?: string } = await response.json();
  setStoredUser(data.user);
  if (data.access_token) {
    setStoredToken(data.access_token);
  }
  if (data.refresh_token) {
    setStoredRefreshToken(data.refresh_token);
  }
  return data;
}

export async function logoutUser(): Promise<void> {
  try {
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers,
      credentials: "include",
    });
  } finally {
    clearStoredAuth();
  }
}

export async function refreshSession(): Promise<AuthResponse> {
  const refreshToken = getStoredRefreshToken();
  const token = getStoredToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const body = refreshToken ? JSON.stringify({ refresh_token: refreshToken }) : JSON.stringify({});
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers,
    credentials: "include",
    body,
  });

  if (!response.ok) {
    clearStoredAuth();
    throw new Error("Failed to refresh session");
  }

  const data: AuthResponse & { refresh_token?: string } = await response.json();
  setStoredUser(data.user);
  if (data.access_token) {
    setStoredToken(data.access_token);
  }
  if (data.refresh_token) {
    setStoredRefreshToken(data.refresh_token);
  }
  return data;
}


export async function requestMagicLink(email: string): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/auth/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: "Magic link request failed" }));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export async function verifyMagicLink(token: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/magic-link/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: "Magic link verification failed" }));
    throw new Error(errorData.detail || `Verification failed with status ${response.status}`);
  }

  const data: AuthResponse = await response.json();
  setStoredUser(data.user);
  if (data.access_token) {
    setStoredToken(data.access_token);
  }
  return data;
}

export async function requestPasswordReset(email: string): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: "Password reset request failed" }));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: "Password update failed" }));
    throw new Error(errorData.detail || `Update failed with status ${response.status}`);
  }

  return response.json();
}

export async function getCurrentUser(): Promise<User> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}/auth/me`, {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    clearStoredAuth();
    const errorData = await response.json().catch(() => ({ detail: "Session expired" }));
    throw new Error(errorData.detail || `Session check failed with status ${response.status}`);
  }

  const user: User = await response.json();
  setStoredUser(user);
  return user;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  workspace_id?: string | null;
  is_revoked: boolean;
  created_at: string;
  expires_at?: string | null;
  last_used_at?: string | null;
}

export interface ApiKeyCreateResponse {
  status: string;
  raw_key: string;
  key: ApiKeyItem;
}

export async function fetchApiKeys(): Promise<{ api_keys: ApiKeyItem[] }> {
  const token = getStoredToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/auth/api-keys`, {
    method: "GET",
    headers,
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to fetch API keys" }));
    throw new Error(err.detail || `Failed to fetch API keys (${res.status})`);
  }
  return res.json();
}

export async function createApiKey(payload: {
  name?: string;
  workspace_id?: string;
  expires_in_days?: number;
}): Promise<ApiKeyCreateResponse> {
  const token = getStoredToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/auth/api-keys`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to create API key" }));
    throw new Error(err.detail || `Failed to create API key (${res.status})`);
  }
  return res.json();
}

export async function revokeApiKey(keyId: string): Promise<{ status: string; message: string }> {
  const token = getStoredToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/auth/api-keys/${encodeURIComponent(keyId)}`, {
    method: "DELETE",
    headers,
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to revoke API key" }));
    throw new Error(err.detail || `Failed to revoke API key (${res.status})`);
  }
  return res.json();
}

