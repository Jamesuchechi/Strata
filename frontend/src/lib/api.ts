/**
 * API client for Strata FastAPI backend.
 */

import { PreviewData, QueryResult } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export async function uploadAndPreviewFile(file: File, sheet?: string): Promise<PreviewData> {
  const formData = new FormData();
  formData.append("file", file);

  const url = new URL(`${API_BASE}/preview`);
  if (sheet) {
    url.searchParams.append("sheet", sheet);
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || `Upload failed with status ${response.status}`);
  }

  return response.json();
}

export async function fetchDatasets(): Promise<import("./types").DatasetItem[]> {
  const response = await fetch(`${API_BASE}/datasets`);
  if (!response.ok) {
    throw new Error(`Failed to fetch datasets (${response.status})`);
  }
  return response.json();
}

export async function fetchDatasetPreview(datasetId: string, sheet?: string): Promise<PreviewData> {
  const url = new URL(`${API_BASE}/datasets/${datasetId}`);
  if (sheet) {
    url.searchParams.append("sheet", sheet);
  }
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch dataset preview (${response.status})`);
  }
  return response.json();
}

export async function deleteDataset(datasetId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/datasets/${datasetId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to delete dataset (${response.status})`);
  }
}

export async function fetchCommits(): Promise<any[]> {
  const response = await fetch(`${API_BASE}/diff/commits`);
  if (!response.ok) {
    throw new Error(`Failed to fetch commits (${response.status})`);
  }
  return response.json();
}

export async function createSnapshotCommit(payload: {
  dataset_name: string;
  message: string;
  version_tag?: string;
  author?: string;
  added_cols?: string[];
  modified_cols?: string[];
}): Promise<any> {
  const response = await fetch(`${API_BASE}/diff/commits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Failed to create snapshot (${response.status})`);
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

