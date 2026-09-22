/**
 * TypeScript data models and interfaces for Strata Studio.
 */

export interface ColumnSchema {
  name: string;
  type: string;
}

export interface ColumnStat {
  name: string;
  type: string;
  null_count: number;
  null_pct: number;
  distinct_count: number;
  is_unique: boolean;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  distribution?: number[];
  sparkline?: number[];
}

export interface QualityScore {
  overall_score: number;
  completeness: number;
  pii_risk_score: number;
  flagged_pii_count: number;
  issues: string[];
}

export interface PreviewData {
  filename: string;
  format: string;
  content_hash: string;
  total_rows: number;
  total_columns: number;
  schema_fields: ColumnSchema[];
  preview_rows: Record<string, any>[];
  sheets?: string[];
  active_sheet?: string;
  view_name?: string;
  column_stats?: ColumnStat[];
  pii_flags?: Record<string, string>;
  quality_score?: QualityScore;
  is_duplicate?: boolean;
  existing_dataset_id?: string;
  existing_dataset_name?: string;
}

export interface DatasetItem {
  id: string;
  name: string;
  filename: string;
  description?: string;
  tags: string[];
  format: string;
  content_hash: string;
  view_name?: string;
  total_rows: number;
  total_columns: number;
  size_bytes: number;
  created_at?: string;
  quality_score?: number;
  latest_version?: string;
  version_count: number;
}

export interface QueryResult {
  success: boolean;
  executed_sql?: string;
  row_count: number;
  columns: string[];
  data: Record<string, any>[];
  explanation?: string;
  error?: string;
}

export interface TransformOperation {
  op: "drop_nulls" | "fill_null" | "trim_whitespace" | "drop_duplicates" | "cast_type" | "filter_rows";
  column?: string;
  columns?: string[];
  strategy?: "mean" | "median" | "mode" | "zero" | "forward" | "custom";
  value?: any;
  target_type?: "Int64" | "Float64" | "String" | "Boolean";
  operator?: ">" | "<" | "==" | "!=" | ">=" | "<=";
}

export interface TransformResult {
  success: boolean;
  new_version_tag: string;
  new_content_hash: string;
  row_delta: number;
  column_delta: number;
  generated_python_code: string;
  preview: PreviewData;
}

export interface ShareResult {
  share_token: string;
  share_url: string;
  created_at: string;
  dataset_name: string;
}

export interface CommitRecord {
  id: string;
  hash: string;
  full_hash?: string;
  version: string;
  semver?: {
    major: number;
    minor: number;
    patch: number;
    semver_str: string;
  };
  dataset_name?: string;
  message: string;
  author: string;
  date: string;
  deltaRows: string;
  deltaColumns: string;
  status: "verified" | "clean";
  tags?: string[];
  is_pinned?: boolean;
  access_level?: "public" | "workspace" | "private_draft";
  custom_metadata?: Record<string, any>;
  diffSummary: {
    addedCols: string[];
    removedCols: string[];
    modifiedCols: string[];
  };
}

export interface DistributionShiftItem {
  column: string;
  mean: { v1: number; v2: number; delta: number };
  median: { v1: number; v2: number; delta: number };
  variance: { v1: number; v2: number; delta: number };
  iqr: { v1: number; v2: number; delta: number };
  min: { v1: number; v2: number; delta: number };
  max: { v1: number; v2: number; delta: number };
  shift_severity: "high" | "normal";
}

export interface DetailedCompareResult {
  base_commit: CommitRecord;
  target_commit: CommitRecord;
  schema_diff: {
    added_columns: string[];
    removed_columns: string[];
    common_columns: string[];
    type_changes: { column: string; old_type: string; new_type: string }[];
    identical_schema: boolean;
  };
  distribution_shifts: Record<string, DistributionShiftItem>;
  missing_and_duplicates: {
    null_deltas: Record<string, { v1_null_pct: number; v2_null_pct: number; delta_pct: number }>;
    duplicate_rows: { v1: number; v2: number; delta: number };
  };
  smart_renames: {
    old_column: string;
    new_column: string;
    confidence: number;
    type: string;
    reason: string;
  }[];
  categorical_domain_shifts: Record<
    string,
    {
      column: string;
      added_categories: string[];
      dropped_categories: string[];
      v1_total_categories: number;
      v2_total_categories: number;
    }
  >;
  row_delta: {
    base_delta: string;
    target_delta: string;
  };
}

export interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  plan: string;
  created_at: string;
  owner_id: string;
}

export interface WorkspaceMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Editor" | "Analyst" | "Viewer";
  joined_at: string;
  avatar: string;
}

export interface WorkspaceInvite {
  id: string;
  email: string;
  role: string;
  invite_token: string;
  invite_url?: string;
  created_at: string;
  status: "pending" | "accepted";
}

export interface ActivityFeedItem {
  id: string;
  workspace_id: string;
  dataset_name: string;
  actor_name: string;
  action: string;
  details: string;
  timestamp: string;
  badge_color: string;
}

export interface SearchFacetItem {
  formats: Record<string, number>;
  tags: Record<string, number>;
  total_indexed: number;
}

export interface SearchResponse {
  query?: string;
  column_filter?: string;
  total_results: number;
  results: (DatasetItem & { matched_reasons: string[]; matched_columns: string[] })[];
  facets: SearchFacetItem;
}

export interface BillingUsageResponse {
  current_plan: string;
  tier: "free" | "pro" | "team";
  price_per_month: number;
  storage_limit_bytes: number;
  storage_used_bytes: number;
  storage_used_mb: number;
  storage_limit_mb: number;
  storage_percentage: number;
  dataset_limit: number;
  datasets_count: number;
  datasets_percentage: number;
  ai_queries_limit: number;
  ai_queries_used: number;
  compute_hours_limit: number;
  compute_hours_used: number;
  auto_ml_models_limit: number;
  auto_ml_models_used: number;
  next_billing_date: string;
  tiers_available: {
    id: string;
    name: string;
    price: string;
    billing_period: string;
    features: string[];
    is_current: boolean;
  }[];
}

export interface BranchRecord {
  name: string;
  dataset_name: string;
  head_commit_id: string;
  head_hash: string;
  is_default: boolean;
  is_active: boolean;
  protected: boolean;
  created_at: string;
  created_by: string;
  description?: string;
  ahead_count?: number;
  behind_count?: number;
  head_commit_message?: string;
  head_commit_author?: string;
  head_commit_date?: string;
  head_commit_tag?: string;
}

export interface ThreeWayMergeComparison {
  status: string;
  has_conflicts: boolean;
  conflict_count: number;
  conflicts: Array<{
    type: string;
    column: string;
    message: string;
    ours_value?: string;
    theirs_value?: string;
  }>;
  schema_merge: Record<string, {
    action: string;
    status: string;
    source?: string;
    dtype?: string;
    ours_dtype?: string;
    theirs_dtype?: string;
  }>;
  base_commit: any;
  target_commit: any;
  source_commit: any;
  target_branch: string;
  source_branch: string;
}

export interface ColumnBlameRecord {
  column: string;
  introduced_commit_id: string;
  introduced_hash: string;
  introduced_version: string;
  introduced_author: string;
  introduced_date: string;
  introduced_message: string;
  mutation_count: number;
  history: Array<{
    commit_id: string;
    hash: string;
    author: string;
    date: string;
    message: string;
  }>;
}

export interface DatasetBlameResponse {
  dataset_name: string;
  total_columns: number;
  columns: ColumnBlameRecord[];
  sample_rows_blame: Array<{
    row_index: number;
    data: Record<string, any>;
    blame_commit_id: string;
    blame_hash: string;
    blame_author: string;
    blame_message: string;
    blame_date: string;
  }>;
}

export interface RegisteredModel {
  id: string;
  name: string;
  framework: string;
  algorithm: string;
  version: string;
  dataset_name: string;
  dataset_version_hash: string;
  experiment_tracker: string;
  run_id: string;
  metrics: Record<string, number>;
  hyperparameters: Record<string, any>;
  artifact_uri: string;
  created_at: string;
  author: string;
  status: "production" | "staging" | "archived";
}

export interface LineageGraphResponse {
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    category: string;
    badge?: string;
    details?: string;
    color?: string;
    commit_hash?: string;
    full_hash?: string;
    run_id?: string;
    artifact_uri?: string;
    created_at?: string;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
  }>;
  total_nodes: number;
  total_edges: number;
}

export interface DeletionProtectionCheck {
  version_hash: string;
  can_delete: boolean;
  deletion_blocked: boolean;
  blocking_models_count: number;
  reasons: string[];
  blocking_models: RegisteredModel[];
}

// ---------------------------------------------------------------------------
// Track 3.3: Semantic Search, Discovery & Public Showcase
// ---------------------------------------------------------------------------

export interface SemanticSearchResultItem {
  id: string;
  name: string;
  filename: string;
  description?: string;
  tags: string[];
  format: string;
  total_rows: number;
  total_columns: number;
  quality_score?: number;
  similarity_score: number;
  matched_reasons: string[];
  matched_columns: string[];
}

export interface SemanticSearchResponse {
  query?: string;
  total_matches: number;
  results: SemanticSearchResultItem[];
}

export interface RecommendationItem {
  id: string;
  name: string;
  description?: string;
  format: string;
  similarity_score: number;
  rationale: string;
  shared_columns: string[];
}

export interface ShowcaseDataset {
  id: string;
  title: string;
  slug: string;
  domain: string;
  description: string;
  author: string;
  author_avatar?: string;
  author_verified: boolean;
  format: string;
  license: string;
  doi?: string;
  tags: string[];
  total_rows: number;
  total_columns: number;
  size_bytes: number;
  quality_score: number;
  stars: number;
  downloads: number;
  forks: number;
  updated_at: string;
  is_starred?: boolean;
  schema_fields?: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
  sample_rows?: Array<Record<string, any>>;
  sample_query?: string;
}

export interface ShowcaseListResponse {
  total: number;
  domains: string[];
  datasets: ShowcaseDataset[];
}

export interface CitationResponse {
  doi: string;
  bibtex: string;
  apa: string;
  ieee: string;
  harvard: string;
  chicago: string;
}

export interface EmbedConfigResponse {
  embed_url: string;
  iframe: string;
  react: string;
  markdown: string;
}

export interface LicenseItem {
  id: string;
  name: string;
  type: string;
  url: string;
  description: string;
  commercial_use: boolean;
}

// ---------------------------------------------------------------------------
// Track 3.4: Pipelines, Compute Sandboxes, Integrations, Security & Admin
// ---------------------------------------------------------------------------

export interface PipelineItem {
  id: string;
  name: string;
  description: string;
  target_dataset_id: string;
  schedule: string;
  trigger: string;
  is_active: boolean;
  timeout_seconds: number;
  max_memory_mb: number;
  steps: Array<{
    step_id: string;
    name: string;
    type: string;
    condition?: string;
    expr?: string;
    output_col?: string;
    columns?: string[];
  }>;
  created_at: string;
  last_run_at?: string;
  last_status?: string;
}

export interface PipelineRun {
  run_id: string;
  pipeline_id: string;
  pipeline_name: string;
  status: "success" | "failed" | "running";
  started_at: string;
  completed_at: string;
  duration_ms: number;
  input_rows: number;
  output_rows: number;
  output_columns: number;
  columns?: string[];
  sample_preview?: Array<Record<string, any>>;
  logs: string[];
  error?: string;
}

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  target_dataset: string;
  steps: any[];
  schedule: string;
}

export interface DeadLetterItem {
  dlq_id: string;
  run_id: string;
  pipeline_id: string;
  error: string;
  timestamp: string;
  retry_count: number;
  resolved: boolean;
}

export interface IntegrationConnector {
  id: string;
  name: string;
  status: string;
  type: string;
}

export interface IntegrationStatusResponse {
  connectors: IntegrationConnector[];
  webhooks: Array<{
    id: string;
    service: string;
    name: string;
    url: string;
    events: string[];
    is_active: boolean;
  }>;
  recent_events: Array<{
    id: string;
    service: string;
    event_type: string;
    payload: any;
    status: string;
    timestamp: string;
  }>;
}

export interface AuditLogItem {
  id: string;
  actor: string;
  action: string;
  target: string;
  ip_address: string;
  timestamp: string;
  details?: Record<string, any>;
  prev_hash: string;
  hash: string;
}

export interface AdminOverview {
  cluster_name: string;
  version: string;
  uptime_hours: number;
  users_count: number;
  workspaces_count: number;
  datasets_count: number;
  total_storage_bytes: number;
  total_storage_mb: number;
  active_duckdb_pools: number;
  isolated_sandboxes_running: number;
  platform_status: string;
}

export interface PlatformHealth {
  timestamp: string;
  cpu_usage_pct: number;
  memory_used_mb: number;
  memory_total_mb: number;
  memory_usage_pct: number;
  disk_used_gb: number;
  disk_total_gb: number;
  disk_usage_pct: number;
  duckdb_latency_p95_ms: number;
  http_latency_p95_ms: number;
  api_availability_pct: number;
}

export interface DatasetComment {
  id: string;
  dataset_id: string;
  row_index?: number;
  column_name?: string;
  author_name: string;
  author_role: string;
  comment: string;
  resolved: boolean;
  created_at: string;
}

export interface ReviewRequest {
  id: string;
  dataset_name: string;
  source_branch: string;
  target_branch: string;
  title: string;
  author: string;
  status: "pending_review" | "approved" | "changes_requested" | "merged";
  approvals: string[];
  min_approvals_required: number;
  created_at: string;
}



