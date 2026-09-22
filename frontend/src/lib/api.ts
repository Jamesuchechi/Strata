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

// -------------------------------------------------------------
// Versioning Enhancements Client Methods
// -------------------------------------------------------------
export async function addCommitTag(commitId: string, tag: string): Promise<any> {
  const res = await fetch(`${API_BASE}/diff/commits/${commitId}/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tag }),
  });
  if (!res.ok) throw new Error(`Failed to add tag (${res.status})`);
  return res.json();
}

export async function removeCommitTag(commitId: string, tag: string): Promise<any> {
  const res = await fetch(`${API_BASE}/diff/commits/${commitId}/tags/${encodeURIComponent(tag)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to remove tag (${res.status})`);
  return res.json();
}

export async function toggleCommitPin(commitId: string, isPinned?: boolean): Promise<any> {
  const res = await fetch(`${API_BASE}/diff/commits/${commitId}/pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_pinned: isPinned }),
  });
  if (!res.ok) throw new Error(`Failed to toggle pin (${res.status})`);
  return res.json();
}

export async function updateCommitPermissions(commitId: string, accessLevel: string): Promise<any> {
  const res = await fetch(`${API_BASE}/diff/commits/${commitId}/permissions`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_level: accessLevel }),
  });
  if (!res.ok) throw new Error(`Failed to update permissions (${res.status})`);
  return res.json();
}

export async function updateCommitMetadata(commitId: string, metadata: Record<string, any>): Promise<any> {
  const res = await fetch(`${API_BASE}/diff/commits/${commitId}/metadata`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metadata }),
  });
  if (!res.ok) throw new Error(`Failed to update metadata (${res.status})`);
  return res.json();
}

export async function bumpCommitSemver(commitId: string, bumpType: "patch" | "minor" | "major"): Promise<any> {
  const res = await fetch(`${API_BASE}/diff/commits/${commitId}/bump-semver`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bump_type: bumpType }),
  });
  if (!res.ok) throw new Error(`Failed to bump semver (${res.status})`);
  return res.json();
}

// -------------------------------------------------------------
// Enhanced Diffing & Reports Client Methods
// -------------------------------------------------------------
export async function fetchDetailedCompare(baseId: string, targetId: string): Promise<import("./types").DetailedCompareResult> {
  const res = await fetch(`${API_BASE}/diff/detailed_compare?base_id=${baseId}&target_id=${targetId}`);
  if (!res.ok) throw new Error(`Failed to fetch detailed compare (${res.status})`);
  return res.json();
}

export async function fetchDiffReport(baseId: string, targetId: string, format: "markdown" | "json" = "markdown"): Promise<string | object> {
  const res = await fetch(`${API_BASE}/diff/export_report?base_id=${baseId}&target_id=${targetId}&format=${format}`);
  if (!res.ok) throw new Error(`Failed to export report (${res.status})`);
  if (format === "json") return res.json();
  return res.text();
}

// -------------------------------------------------------------
// Collaboration & Workspaces Client Methods
// -------------------------------------------------------------
export async function fetchWorkspaces(): Promise<import("./types").WorkspaceItem[]> {
  const res = await fetch(`${API_BASE}/workspaces`);
  if (!res.ok) throw new Error(`Failed to fetch workspaces (${res.status})`);
  return res.json();
}

export async function createWorkspace(name: string, description?: string): Promise<import("./types").WorkspaceItem> {
  const res = await fetch(`${API_BASE}/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) throw new Error(`Failed to create workspace (${res.status})`);
  return res.json();
}

export async function fetchWorkspaceMembers(workspaceId: string): Promise<{
  members: import("./types").WorkspaceMember[];
  pending_invites: import("./types").WorkspaceInvite[];
}> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/members`);
  if (!res.ok) throw new Error(`Failed to fetch members (${res.status})`);
  return res.json();
}

export async function inviteWorkspaceMember(workspaceId: string, email: string, role: string): Promise<any> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
  if (!res.ok) throw new Error(`Failed to send invite (${res.status})`);
  return res.json();
}

export async function removeWorkspaceMember(workspaceId: string, memberId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/members/${memberId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to remove member (${res.status})`);
  return res.json();
}

export async function updateWorkspaceMemberRole(workspaceId: string, memberId: string, role: string): Promise<any> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/members/${memberId}/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error(`Failed to update role (${res.status})`);
  return res.json();
}

export async function fetchWorkspaceActivity(workspaceId: string = "all"): Promise<import("./types").ActivityFeedItem[]> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/activity`);
  if (!res.ok) throw new Error(`Failed to fetch activity feed (${res.status})`);
  return res.json();
}

export async function fetchWorkspacePermissions(workspaceId: string): Promise<Record<string, string>> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/permissions`);
  if (!res.ok) throw new Error(`Failed to fetch permissions (${res.status})`);
  return res.json();
}

export async function setDatasetPermission(workspaceId: string, datasetId: string, minRole: string): Promise<any> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/permissions`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataset_id: datasetId, min_role: minRole }),
  });
  if (!res.ok) throw new Error(`Failed to update dataset permission (${res.status})`);
  return res.json();
}

// -------------------------------------------------------------
// Global Search & Facets Client Methods
// -------------------------------------------------------------
export async function searchDatasets(params: {
  q?: string;
  column?: string;
  format?: string;
  tag?: string;
  min_quality?: number;
  min_rows?: number;
  max_rows?: number;
  sort_by?: string;
}): Promise<import("./types").SearchResponse> {
  const url = new URL(`${API_BASE}/datasets/search`);
  if (params.q) url.searchParams.append("q", params.q);
  if (params.column) url.searchParams.append("column", params.column);
  if (params.format && params.format !== "all") url.searchParams.append("format", params.format);
  if (params.tag) url.searchParams.append("tag", params.tag);
  if (params.min_quality !== undefined) url.searchParams.append("min_quality", params.min_quality.toString());
  if (params.min_rows !== undefined) url.searchParams.append("min_rows", params.min_rows.toString());
  if (params.max_rows !== undefined) url.searchParams.append("max_rows", params.max_rows.toString());
  if (params.sort_by) url.searchParams.append("sort_by", params.sort_by);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  return res.json();
}

// -------------------------------------------------------------
// Billing & Onboarding Client Methods
// -------------------------------------------------------------
export async function fetchBillingUsage(): Promise<import("./types").BillingUsageResponse> {
  const res = await fetch(`${API_BASE}/billing/usage`);
  if (!res.ok) throw new Error(`Failed to fetch billing usage (${res.status})`);
  return res.json();
}

export async function upgradePlan(tier: "free" | "pro"): Promise<any> {
  const res = await fetch(`${API_BASE}/billing/upgrade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tier }),
  });
  if (!res.ok) throw new Error(`Failed to change plan (${res.status})`);
  return res.json();
}

export async function seedDomainSamples(): Promise<any> {
  const res = await fetch(`${API_BASE}/billing/seed-samples`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to seed sample datasets (${res.status})`);
  return res.json();
}

export * from "./api/auth";



