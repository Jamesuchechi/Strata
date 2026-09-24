/**
 * API client for Strata FastAPI backend.
 */

import { PreviewData, QueryResult } from "./types";
import { getStoredToken } from "./api/auth";

export async function apiFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const token = getStoredToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials || "include",
  });
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export async function uploadAndPreviewFile(file: File, sheet?: string): Promise<PreviewData> {
  const formData = new FormData();
  formData.append("file", file);

  const url = new URL(`${API_BASE}/preview`);
  if (sheet) {
    url.searchParams.append("sheet", sheet);
  }

  const response = await apiFetch(url.toString(), {
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
  const response = await apiFetch(`${API_BASE}/datasets`);
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
  const response = await apiFetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch dataset preview (${response.status})`);
  }
  return response.json();
}

export async function deleteDataset(datasetId: string): Promise<void> {
  const response = await apiFetch(`${API_BASE}/datasets/${datasetId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to delete dataset (${response.status})`);
  }
}

export async function fetchCommits(): Promise<any[]> {
  const response = await apiFetch(`${API_BASE}/diff/commits`);
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
  const response = await apiFetch(`${API_BASE}/diff/commits`, {
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
  const response = await apiFetch(`${API_BASE}/diff/commits/${commitId}/rollback`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Failed to rollback (${response.status})`);
  }
  return response.json();
}

export async function compareCommits(baseId: string, targetId: string): Promise<any> {
  const response = await apiFetch(`${API_BASE}/diff/compare?base_id=${baseId}&target_id=${targetId}`);
  if (!response.ok) {
    throw new Error(`Failed to compare snapshots (${response.status})`);
  }
  return response.json();
}

export async function fetchLineageGraph(): Promise<any> {
  const response = await apiFetch(`${API_BASE}/diff/lineage`);
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
  const response = await apiFetch(`${API_BASE}/query`, {
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
  const response = await apiFetch(`${API_BASE}/datasets/${datasetId}/transform`, {
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
  const response = await apiFetch(`${API_BASE}/datasets/${datasetId}/share`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Failed to create share link (${response.status})`);
  }
  return response.json();
}

export async function fetchSharedDataset(token: string): Promise<any> {
  const response = await apiFetch(`${API_BASE}/shared/${token}`);
  if (!response.ok) {
    throw new Error(`Shared dataset not found or expired (${response.status})`);
  }
  return response.json();
}

export async function fetchDeepEDA(datasetId: string): Promise<any> {
  const response = await apiFetch(`${API_BASE}/eda/${datasetId}`);
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
  const response = await apiFetch(`${API_BASE}/eda/${datasetId}/hypothesis-test`, {
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
  const response = await apiFetch(`${API_BASE}/automl/train`, {
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
  const response = await apiFetch(`${API_BASE}/datasets/${datasetId}/convert?target_format=${targetFormat}`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Format conversion failed (${response.status})`);
  }
  return response.blob();
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_BASE}/health`);
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
  const res = await apiFetch(`${API_BASE}/diff/commits/${commitId}/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tag }),
  });
  if (!res.ok) throw new Error(`Failed to add tag (${res.status})`);
  return res.json();
}

export async function removeCommitTag(commitId: string, tag: string): Promise<any> {
  const res = await apiFetch(`${API_BASE}/diff/commits/${commitId}/tags/${encodeURIComponent(tag)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to remove tag (${res.status})`);
  return res.json();
}

export async function toggleCommitPin(commitId: string, isPinned?: boolean): Promise<any> {
  const res = await apiFetch(`${API_BASE}/diff/commits/${commitId}/pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_pinned: isPinned }),
  });
  if (!res.ok) throw new Error(`Failed to toggle pin (${res.status})`);
  return res.json();
}

export async function updateCommitPermissions(commitId: string, accessLevel: string): Promise<any> {
  const res = await apiFetch(`${API_BASE}/diff/commits/${commitId}/permissions`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_level: accessLevel }),
  });
  if (!res.ok) throw new Error(`Failed to update permissions (${res.status})`);
  return res.json();
}

export async function updateCommitMetadata(commitId: string, metadata: Record<string, any>): Promise<any> {
  const res = await apiFetch(`${API_BASE}/diff/commits/${commitId}/metadata`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metadata }),
  });
  if (!res.ok) throw new Error(`Failed to update metadata (${res.status})`);
  return res.json();
}

export async function bumpCommitSemver(commitId: string, bumpType: "patch" | "minor" | "major"): Promise<any> {
  const res = await apiFetch(`${API_BASE}/diff/commits/${commitId}/bump-semver`, {
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
  const res = await apiFetch(`${API_BASE}/diff/detailed_compare?base_id=${baseId}&target_id=${targetId}`);
  if (!res.ok) throw new Error(`Failed to fetch detailed compare (${res.status})`);
  return res.json();
}

export async function fetchDiffReport(baseId: string, targetId: string, format: "markdown" | "json" = "markdown"): Promise<string | object> {
  const res = await apiFetch(`${API_BASE}/diff/export_report?base_id=${baseId}&target_id=${targetId}&format=${format}`);
  if (!res.ok) throw new Error(`Failed to export report (${res.status})`);
  if (format === "json") return res.json();
  return res.text();
}

// -------------------------------------------------------------
// Collaboration & Workspaces Client Methods
// -------------------------------------------------------------
export async function fetchWorkspaces(): Promise<import("./types").WorkspaceItem[]> {
  const res = await apiFetch(`${API_BASE}/workspaces`);
  if (!res.ok) throw new Error(`Failed to fetch workspaces (${res.status})`);
  return res.json();
}

export async function createWorkspace(name: string, description?: string): Promise<import("./types").WorkspaceItem> {
  const res = await apiFetch(`${API_BASE}/workspaces`, {
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
  const res = await apiFetch(`${API_BASE}/workspaces/${workspaceId}/members`);
  if (!res.ok) throw new Error(`Failed to fetch members (${res.status})`);
  return res.json();
}

export async function inviteWorkspaceMember(workspaceId: string, email: string, role: string): Promise<any> {
  const res = await apiFetch(`${API_BASE}/workspaces/${workspaceId}/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
  if (!res.ok) throw new Error(`Failed to send invite (${res.status})`);
  return res.json();
}

export async function removeWorkspaceMember(workspaceId: string, memberId: string): Promise<any> {
  const res = await apiFetch(`${API_BASE}/workspaces/${workspaceId}/members/${memberId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to remove member (${res.status})`);
  return res.json();
}

export async function updateWorkspaceMemberRole(workspaceId: string, memberId: string, role: string): Promise<any> {
  const res = await apiFetch(`${API_BASE}/workspaces/${workspaceId}/members/${memberId}/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error(`Failed to update role (${res.status})`);
  return res.json();
}

export async function fetchWorkspaceActivity(workspaceId: string = "all"): Promise<import("./types").ActivityFeedItem[]> {
  const res = await apiFetch(`${API_BASE}/workspaces/${workspaceId}/activity`);
  if (!res.ok) throw new Error(`Failed to fetch activity feed (${res.status})`);
  return res.json();
}

export async function fetchWorkspacePermissions(workspaceId: string): Promise<Record<string, string>> {
  const res = await apiFetch(`${API_BASE}/workspaces/${workspaceId}/permissions`);
  if (!res.ok) throw new Error(`Failed to fetch permissions (${res.status})`);
  return res.json();
}

export async function setDatasetPermission(workspaceId: string, datasetId: string, minRole: string): Promise<any> {
  const res = await apiFetch(`${API_BASE}/workspaces/${workspaceId}/permissions`, {
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

  const res = await apiFetch(url.toString());
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  return res.json();
}

// -------------------------------------------------------------
// Billing & Onboarding Client Methods
// -------------------------------------------------------------
export async function fetchBillingUsage(): Promise<import("./types").BillingUsageResponse> {
  const res = await apiFetch(`${API_BASE}/billing/usage`);
  if (!res.ok) throw new Error(`Failed to fetch billing usage (${res.status})`);
  return res.json();
}

export async function upgradePlan(tier: "free" | "pro"): Promise<any> {
  const res = await apiFetch(`${API_BASE}/billing/upgrade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tier }),
  });
  if (!res.ok) throw new Error(`Failed to change plan (${res.status})`);
  return res.json();
}

export async function seedDomainSamples(): Promise<any> {
  const res = await apiFetch(`${API_BASE}/billing/seed-samples`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to seed sample datasets (${res.status})`);
  return res.json();
}

// -------------------------------------------------------------
// Git-Style Branching, 3-Way Merge & Blame Methods
// -------------------------------------------------------------
export async function fetchBranches(datasetName: string): Promise<{
  dataset_name: string;
  active_branch: string;
  branches: import("./types").BranchRecord[];
  total_branches: number;
}> {
  const res = await apiFetch(`${API_BASE}/branches?dataset_name=${encodeURIComponent(datasetName)}`);
  if (!res.ok) throw new Error(`Failed to fetch branches (${res.status})`);
  return res.json();
}

export async function createBranch(req: {
  dataset_name: string;
  branch_name: string;
  from_commit_or_branch?: string;
  description?: string;
  author?: string;
}): Promise<any> {
  const res = await apiFetch(`${API_BASE}/branches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to create branch (${res.status})`);
  }
  return res.json();
}

export async function checkoutBranch(datasetName: string, branchName: string): Promise<any> {
  const res = await apiFetch(`${API_BASE}/branches/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataset_name: datasetName, branch_name: branchName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to checkout branch (${res.status})`);
  }
  return res.json();
}

export async function deleteBranch(datasetName: string, branchName: string): Promise<any> {
  const res = await apiFetch(`${API_BASE}/branches/${encodeURIComponent(branchName)}?dataset_name=${encodeURIComponent(datasetName)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to delete branch (${res.status})`);
  }
  return res.json();
}

export async function compareBranches(
  datasetName: string,
  targetBranch: string,
  sourceBranch: string,
): Promise<import("./types").ThreeWayMergeComparison> {
  const url = `${API_BASE}/branches/compare?dataset_name=${encodeURIComponent(datasetName)}&target_branch=${encodeURIComponent(targetBranch)}&source_branch=${encodeURIComponent(sourceBranch)}`;
  const res = await apiFetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Branch comparison failed (${res.status})`);
  }
  return res.json();
}

export async function mergeBranches(req: {
  dataset_name: string;
  target_branch: string;
  source_branch: string;
  strategy?: string;
  resolutions?: Record<string, string>;
  message?: string;
  author?: string;
}): Promise<any> {
  const res = await apiFetch(`${API_BASE}/branches/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Merge failed (${res.status})`);
  }
  return res.json();
}

export async function fetchDatasetBlame(datasetName: string, commitId?: string): Promise<import("./types").DatasetBlameResponse> {
  const url = new URL(`${API_BASE}/branches/blame`);
  url.searchParams.append("dataset_name", datasetName);
  if (commitId) url.searchParams.append("commit_id", commitId);
  const res = await apiFetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch blame data (${res.status})`);
  return res.json();
}

// -------------------------------------------------------------
// Lineage Ecosystem, Model Registry & Deletion Protection
// -------------------------------------------------------------
export async function fetchFullLineageGraph(): Promise<import("./types").LineageGraphResponse> {
  const res = await apiFetch(`${API_BASE}/lineage/graph`);
  if (!res.ok) throw new Error(`Failed to fetch lineage graph (${res.status})`);
  return res.json();
}

export async function traceBackwardLineage(assetId: string): Promise<any> {
  const res = await apiFetch(`${API_BASE}/lineage/trace/backward/${encodeURIComponent(assetId)}`);
  if (!res.ok) throw new Error(`Failed to trace backward lineage (${res.status})`);
  return res.json();
}

export async function traceForwardImpact(assetId: string): Promise<any> {
  const res = await apiFetch(`${API_BASE}/lineage/trace/forward/${encodeURIComponent(assetId)}`);
  if (!res.ok) throw new Error(`Failed to trace forward impact (${res.status})`);
  return res.json();
}

export async function fetchRegisteredModels(datasetName?: string): Promise<import("./types").RegisteredModel[]> {
  const url = datasetName
    ? `${API_BASE}/lineage/models?dataset_name=${encodeURIComponent(datasetName)}`
    : `${API_BASE}/lineage/models`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`Failed to fetch registered models (${res.status})`);
  return res.json();
}

export async function registerModel(req: {
  name: string;
  framework: string;
  algorithm?: string;
  version?: string;
  dataset_name: string;
  dataset_version_hash: string;
  experiment_tracker?: string;
  run_id?: string;
  metrics?: Record<string, number>;
  hyperparameters?: Record<string, any>;
  status?: string;
}): Promise<any> {
  const res = await apiFetch(`${API_BASE}/lineage/models`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to register model (${res.status})`);
  }
  return res.json();
}

export async function checkDeletionProtection(versionHash: string): Promise<import("./types").DeletionProtectionCheck> {
  const res = await apiFetch(`${API_BASE}/lineage/protection/check/${encodeURIComponent(versionHash)}`);
  if (!res.ok) throw new Error(`Failed to check deletion protection (${res.status})`);
  return res.json();
}

export async function exportOpenLineage(format: "openlineage" | "graphviz"): Promise<any> {
  const res = await apiFetch(`${API_BASE}/lineage/export?format=${format}`);
  if (!res.ok) throw new Error(`Failed to export lineage (${res.status})`);
  if (format === "graphviz") {
    return res.text();
  }
  return res.json();
}

// -------------------------------------------------------------
// Track 3.3: Semantic Vector Search, Discovery & Showcase
// -------------------------------------------------------------

export async function searchSemanticDatasets(params: {
  q?: string;
  column?: string;
  domain?: string;
  format?: string;
  min_quality?: number;
  min_rows?: number;
  max_rows?: number;
}): Promise<import("./types").SemanticSearchResponse> {
  const url = new URL(`${API_BASE}/discovery/semantic-search`);
  if (params.q) url.searchParams.set("q", params.q);
  if (params.column) url.searchParams.set("column", params.column);
  if (params.domain) url.searchParams.set("domain", params.domain);
  if (params.format && params.format !== "all") url.searchParams.set("format", params.format);
  if (params.min_quality !== undefined) url.searchParams.set("min_quality", params.min_quality.toString());
  if (params.min_rows !== undefined) url.searchParams.set("min_rows", params.min_rows.toString());
  if (params.max_rows !== undefined) url.searchParams.set("max_rows", params.max_rows.toString());

  const res = await apiFetch(url.toString());
  if (!res.ok) throw new Error(`Failed to execute semantic search (${res.status})`);
  return res.json();
}

export async function toggleDatasetFavorite(datasetId: string): Promise<{ dataset_id: string; is_favorite: boolean; total_favorites: number }> {
  const res = await apiFetch(`${API_BASE}/discovery/favorites/${encodeURIComponent(datasetId)}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to toggle favorite (${res.status})`);
  return res.json();
}

export async function fetchDatasetFavorites(): Promise<{ favorites: any[]; count: number }> {
  const res = await apiFetch(`${API_BASE}/discovery/favorites`);
  if (!res.ok) throw new Error(`Failed to fetch favorites (${res.status})`);
  return res.json();
}

export async function recordDatasetRecent(datasetId: string): Promise<any> {
  const res = await apiFetch(`${API_BASE}/discovery/recents/${encodeURIComponent(datasetId)}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to record recent visit (${res.status})`);
  return res.json();
}

export async function fetchDatasetRecents(): Promise<{ recents: any[]; count: number }> {
  const res = await apiFetch(`${API_BASE}/discovery/recents`);
  if (!res.ok) throw new Error(`Failed to fetch recents (${res.status})`);
  return res.json();
}

export async function fetchDatasetRecommendations(datasetId: string): Promise<import("./types").RecommendationItem[]> {
  const res = await apiFetch(`${API_BASE}/discovery/recommendations/${encodeURIComponent(datasetId)}`);
  if (!res.ok) throw new Error(`Failed to fetch recommendations (${res.status})`);
  return res.json();
}

export async function fetchShowcaseDatasets(params?: {
  domain?: string;
  tag?: string;
  q?: string;
  sort_by?: string;
}): Promise<import("./types").ShowcaseListResponse> {
  const url = new URL(`${API_BASE}/showcase`);
  if (params?.domain && params.domain !== "All") url.searchParams.set("domain", params.domain);
  if (params?.tag) url.searchParams.set("tag", params.tag);
  if (params?.q) url.searchParams.set("q", params.q);
  if (params?.sort_by) url.searchParams.set("sort_by", params.sort_by);

  const res = await apiFetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch showcase datasets (${res.status})`);
  return res.json();
}

export async function fetchShowcaseDataset(datasetId: string): Promise<{
  dataset: import("./types").ShowcaseDataset;
  citations: import("./types").CitationResponse;
  embeds: import("./types").EmbedConfigResponse;
}> {
  const res = await apiFetch(`${API_BASE}/showcase/${encodeURIComponent(datasetId)}`);
  if (!res.ok) throw new Error(`Failed to fetch showcase item (${res.status})`);
  return res.json();
}

export async function toggleShowcaseStar(datasetId: string): Promise<{ dataset_id: string; is_starred: boolean; total_stars: number }> {
  const res = await apiFetch(`${API_BASE}/showcase/${encodeURIComponent(datasetId)}/star`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to toggle star (${res.status})`);
  return res.json();
}

export async function trackShowcaseDownload(datasetId: string): Promise<any> {
  const res = await apiFetch(`${API_BASE}/showcase/${encodeURIComponent(datasetId)}/download`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to track download (${res.status})`);
  return res.json();
}

export async function fetchShowcaseCitation(datasetId: string): Promise<import("./types").CitationResponse> {
  const res = await apiFetch(`${API_BASE}/showcase/${encodeURIComponent(datasetId)}/citation`);
  if (!res.ok) throw new Error(`Failed to fetch citation (${res.status})`);
  return res.json();
}

export async function fetchShowcaseEmbedConfig(datasetId: string, theme: "light" | "dark" = "light", showSchema: boolean = true): Promise<import("./types").EmbedConfigResponse> {
  const res = await apiFetch(`${API_BASE}/showcase/${encodeURIComponent(datasetId)}/embed-config?theme=${theme}&show_schema=${showSchema}`);
  if (!res.ok) throw new Error(`Failed to fetch embed config (${res.status})`);
  return res.json();
}

export async function fetchLicensesCatalog(): Promise<{ licenses: import("./types").LicenseItem[] }> {
  const res = await apiFetch(`${API_BASE}/showcase/licenses`);
  if (!res.ok) throw new Error(`Failed to fetch licenses (${res.status})`);
  return res.json();
}

export async function forkShowcaseDataset(datasetId: string): Promise<{
  status: string;
  message: string;
  new_dataset_id: string;
  fork_count: number;
  dataset: any;
}> {
  const res = await apiFetch(`${API_BASE}/showcase/${encodeURIComponent(datasetId)}/fork`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fork showcase dataset (${res.status})`);
  }
  return res.json();
}

// -------------------------------------------------------------
// Track 3.4: Pipelines, Compute Sandboxes, Integrations, Security & Admin
// -------------------------------------------------------------

export async function fetchPipelines(): Promise<{ pipelines: import("./types").PipelineItem[]; total: number }> {
  const res = await apiFetch(`${API_BASE}/pipelines`);
  if (!res.ok) throw new Error(`Failed to fetch pipelines (${res.status})`);
  return res.json();
}

export async function fetchPipelineTemplates(): Promise<{ templates: import("./types").PipelineTemplate[] }> {
  const res = await apiFetch(`${API_BASE}/pipelines/templates`);
  if (!res.ok) throw new Error(`Failed to fetch pipeline templates (${res.status})`);
  return res.json();
}

export async function createPipeline(req: any): Promise<any> {
  const res = await apiFetch(`${API_BASE}/pipelines`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Failed to create pipeline (${res.status})`);
  return res.json();
}

export async function pipelineDryRun(req: { dataset_id: string; steps: any[]; sample_rows_limit?: number }): Promise<any> {
  const res = await apiFetch(`${API_BASE}/pipelines/dry-run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Dry-run failed (${res.status})`);
  }
  return res.json();
}

export async function runPipeline(pipelineId: string): Promise<{ status: string; run: import("./types").PipelineRun }> {
  const res = await apiFetch(`${API_BASE}/pipelines/${encodeURIComponent(pipelineId)}/run`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Pipeline execution failed (${res.status})`);
  }
  return res.json();
}

export async function fetchPipelineRuns(pipelineId?: string): Promise<{ runs: import("./types").PipelineRun[]; total: number }> {
  const url = pipelineId ? `${API_BASE}/pipelines/runs?pipeline_id=${encodeURIComponent(pipelineId)}` : `${API_BASE}/pipelines/runs`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`Failed to fetch pipeline runs (${res.status})`);
  return res.json();
}

export async function fetchDeadLetterQueue(): Promise<{ dlq: import("./types").DeadLetterItem[]; total_failed: number }> {
  const res = await apiFetch(`${API_BASE}/pipelines/dlq`);
  if (!res.ok) throw new Error(`Failed to fetch DLQ (${res.status})`);
  return res.json();
}

export async function retryDeadLetterJob(dlqId: string): Promise<any> {
  const res = await apiFetch(`${API_BASE}/pipelines/dlq/${encodeURIComponent(dlqId)}/retry`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to retry DLQ job (${res.status})`);
  return res.json();
}

export async function fetchIntegrationsStatus(): Promise<import("./types").IntegrationStatusResponse> {
  const res = await apiFetch(`${API_BASE}/integrations/status`);
  if (!res.ok) throw new Error(`Failed to fetch integrations status (${res.status})`);
  return res.json();
}

export async function fetchIntegrationCodeTemplates(datasetName?: string, version?: string): Promise<{ dataset_name: string; version: string; templates: Record<string, string> }> {
  const url = `${API_BASE}/integrations/code-templates?dataset_name=${encodeURIComponent(datasetName || "my_dataset.csv")}&version=${encodeURIComponent(version || "main")}`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`Failed to fetch integration code templates (${res.status})`);
  return res.json();
}

export async function testWebhookAlert(service: string, message: string): Promise<any> {
  const res = await apiFetch(`${API_BASE}/integrations/webhooks/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service, message }),
  });
  if (!res.ok) throw new Error(`Failed to send test webhook alert (${res.status})`);
  return res.json();
}

export async function fetchEncryptionStatus(): Promise<any> {
  const res = await apiFetch(`${API_BASE}/security/encryption-status`);
  if (!res.ok) throw new Error(`Failed to fetch encryption status (${res.status})`);
  return res.json();
}

export async function fetchAuditLogs(actor?: string, action?: string): Promise<{ chain_integrity_verified: boolean; total_records: number; audit_logs: import("./types").AuditLogItem[] }> {
  const url = new URL(`${API_BASE}/security/audit-logs`);
  if (actor) url.searchParams.set("actor", actor);
  if (action) url.searchParams.set("action", action);
  const res = await apiFetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch audit logs (${res.status})`);
  return res.json();
}

export async function maskDatasetExport(datasetId: string, maskRules: string[]): Promise<any> {
  const res = await apiFetch(`${API_BASE}/security/mask-export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataset_id: datasetId, mask_rules: maskRules }),
  });
  if (!res.ok) throw new Error(`Failed to mask dataset export (${res.status})`);
  return res.json();
}

export async function gdprRedactCustomer(customerId: string, datasetIds?: string[]): Promise<any> {
  const res = await apiFetch(`${API_BASE}/security/gdpr-redact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_identifier_value: customerId, dataset_ids: datasetIds }),
  });
  if (!res.ok) throw new Error(`Failed to execute GDPR redaction (${res.status})`);
  return res.json();
}

export async function fetchAdminOverview(): Promise<import("./types").AdminOverview> {
  const res = await apiFetch(`${API_BASE}/security/admin/overview`);
  if (!res.ok) throw new Error(`Failed to fetch admin overview (${res.status})`);
  return res.json();
}

export async function fetchPlatformHealth(): Promise<import("./types").PlatformHealth> {
  const res = await apiFetch(`${API_BASE}/security/admin/health-metrics`);
  if (!res.ok) throw new Error(`Failed to fetch platform health metrics (${res.status})`);
  return res.json();
}

export async function fetchRateLimits(): Promise<any> {
  const res = await apiFetch(`${API_BASE}/security/admin/rate-limits`);
  if (!res.ok) throw new Error(`Failed to fetch rate limits (${res.status})`);
  return res.json();
}

export async function fetchWorkerQueues(): Promise<any> {
  const res = await apiFetch(`${API_BASE}/security/admin/queues`);
  if (!res.ok) throw new Error(`Failed to fetch worker queues (${res.status})`);
  return res.json();
}

export async function fetchDatasetComments(datasetId: string): Promise<{ comments: import("./types").DatasetComment[] }> {
  const res = await apiFetch(`${API_BASE}/workspaces/comments/${encodeURIComponent(datasetId)}`);
  if (!res.ok) throw new Error(`Failed to fetch dataset comments (${res.status})`);
  return res.json();
}

export async function addDatasetComment(datasetId: string, req: { row_index?: number; column_name?: string; comment: string }): Promise<any> {
  const res = await apiFetch(`${API_BASE}/workspaces/comments/${encodeURIComponent(datasetId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Failed to add comment (${res.status})`);
  return res.json();
}

export async function resolveDatasetComment(datasetId: string, commentId: string): Promise<any> {
  const res = await apiFetch(`${API_BASE}/workspaces/comments/${encodeURIComponent(datasetId)}/${encodeURIComponent(commentId)}/resolve`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to resolve comment (${res.status})`);
  return res.json();
}

export async function fetchReviewRequests(datasetName?: string): Promise<{ reviews: import("./types").ReviewRequest[]; total: number }> {
  const url = datasetName ? `${API_BASE}/workspaces/reviews?dataset_name=${encodeURIComponent(datasetName)}` : `${API_BASE}/workspaces/reviews`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`Failed to fetch review requests (${res.status})`);
  return res.json();
}

export async function approveReviewRequest(reviewId: string): Promise<any> {
  const res = await apiFetch(`${API_BASE}/workspaces/reviews/${encodeURIComponent(reviewId)}/approve`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to approve review (${res.status})`);
  return res.json();
}

export * from "./api/auth";





