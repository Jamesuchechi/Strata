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
  email?: string;
  token?: string;
  new_password: string;
}

// Client-side Token Storage Helpers
const TOKEN_KEY = "strata_access_token";
const USER_KEY = "strata_user_profile";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
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
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// API Endpoints
export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: "Registration failed" }));
    throw new Error(errorData.detail || `Registration failed with status ${response.status}`);
  }

  const data: AuthResponse = await response.json();
  setStoredToken(data.access_token);
  setStoredUser(data.user);
  return data;
}

export async function loginUser(payload: LoginPayload): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(errorData.detail || `Login failed with status ${response.status}`);
  }

  const data: AuthResponse = await response.json();
  setStoredToken(data.access_token);
  setStoredUser(data.user);
  return data;
}

export async function requestMagicLink(email: string): Promise<{ status: string; message: string; demo_link?: string }> {
  const response = await fetch(`${API_BASE}/auth/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: "Magic link request failed" }));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export async function requestPasswordReset(email: string): Promise<{ status: string; message: string; demo_token?: string }> {
  const response = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  if (!token) {
    throw new Error("No active session token found");
  }

  const response = await fetch(`${API_BASE}/auth/me`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
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
