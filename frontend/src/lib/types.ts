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

