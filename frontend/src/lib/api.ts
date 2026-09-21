/**
 * API client for Strata FastAPI backend.
 */

import { PreviewData, QueryResult } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export async function uploadAndPreviewFile(file: File): Promise<PreviewData> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/preview`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || `Upload failed with status ${response.status}`);
  }

  return response.json();
}

export async function executeQuery(
  viewName: string,
  sql?: string,
  naturalLanguageQuestion?: string
): Promise<QueryResult> {
  const response = await fetch(`${API_BASE}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      view_name: viewName,
      sql,
      natural_language_question: naturalLanguageQuestion,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Query failed" }));
    throw new Error(err.detail || `Query failed with status ${response.status}`);
  }

  return response.json();
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    return data.status === "healthy";
  } catch {
    return false;
  }
}

export * from "./api/auth";

