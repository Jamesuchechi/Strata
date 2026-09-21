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

export async function rollbackToCommit(commitId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/diff/commits/${commitId}/rollback`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Failed to rollback (${response.status})`);
  }
  return response.json();
}

export async function compareCommits(baseId: string, targetId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/diff/compare?base_id=${baseId}&target_id=${targetId}`);
  if (!response.ok) {
    throw new Error(`Failed to compare snapshots (${response.status})`);
  }
  return response.json();
}

export async function fetchLineageGraph(): Promise<any> {
  const response = await fetch(`${API_BASE}/diff/lineage`);
  if (!response.ok) {
    throw new Error(`Failed to fetch lineage graph (${response.status})`);
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

export async function transformDataset(
  datasetId: string,
  operations: any[],
  commitMessage?: string
): Promise<any> {
  const response = await fetch(`${API_BASE}/datasets/${datasetId}/transform`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operations,
      commit_message: commitMessage,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Transform failed" }));
    throw new Error(err.detail || `Transform failed (${response.status})`);
  }
  return response.json();
}

export async function createShareLink(datasetId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/datasets/${datasetId}/share`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Failed to create share link (${response.status})`);
  }
  return response.json();
}

export async function fetchSharedDataset(token: string): Promise<any> {
  const response = await fetch(`${API_BASE}/shared/${token}`);
  if (!response.ok) {
    throw new Error(`Shared dataset not found or expired (${response.status})`);
  }
  return response.json();
}

export async function fetchDeepEDA(datasetId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/eda/${datasetId}`);
  if (!response.ok) {
    throw new Error(`Failed to generate EDA dossier (${response.status})`);
  }
  return response.json();
}

export async function runHypothesisTest(
  datasetId: string,
  testType: string,
  targetCol: string,
  groupCol?: string,
  col2?: string
): Promise<any> {
  const response = await fetch(`${API_BASE}/eda/${datasetId}/hypothesis-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      test_type: testType,
      target_col: targetCol,
      group_col: groupCol,
      col2: col2,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Hypothesis test failed" }));
    throw new Error(err.detail || `Hypothesis test failed (${response.status})`);
  }
  return response.json();
}

export async function trainAutoMLModel(payload: {
  dataset_id: string;
  target_column: string;
  task_type?: string;
  model_family?: string;
}): Promise<any> {
  const response = await fetch(`${API_BASE}/automl/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "AutoML training failed" }));
    throw new Error(err.detail || `AutoML training failed (${response.status})`);
  }
  return response.json();
}

export async function convertDatasetFormat(datasetId: string, targetFormat: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/datasets/${datasetId}/convert?target_format=${targetFormat}`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Format conversion failed (${response.status})`);
  }
  return response.blob();
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



