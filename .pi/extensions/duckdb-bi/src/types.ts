export interface DuckDbBiConfig {
  projectRoot: string;
  runtimeDir: string;
  exportsDir: string;
  reportsDir: string;
  auditDir: string;
  tmpDir: string;
  auditLogPath: string;
}

export type DiscoveryMode = "business" | "all";

export interface DataDiscoveryOptions {
  mode?: DiscoveryMode;
  includeRoots?: string[];
  excludeRoots?: string[];
}

export interface EvidenceSourceInfo {
  source: string;
  name: string;
  qualifiedName: string;
  path: string;
  absolutePath: string;
}

export interface ToolErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ColumnInfo {
  name: string;
  type?: string;
  nullable?: boolean;
  default?: string | null;
  sample_values?: unknown[];
}

export interface DuckDbCliResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  elapsedMs: number;
  timedOut: boolean;
  outputTooLarge: boolean;
}

export interface QueryExecutionOptions {
  sql: string;
  database?: string;
  readonly?: boolean;
  timeoutMs?: number;
  maxOutputBytes?: number;
  signal?: AbortSignal;
}

export interface JsonQueryResult {
  rows: Array<Record<string, unknown>>;
  columns: Array<{ name: string; type?: string }>;
  rowCount: number;
  elapsedMs: number;
  stderr: string;
}

export interface AuditEntry {
  query_id: string;
  tool_name: string;
  timestamp: string;
  sql: string;
  database?: string;
  elapsed_ms?: number;
  row_count?: number;
  truncated?: boolean;
  status: "ok" | "error" | "blocked";
  artifact_paths?: string[];
  error_message?: string;
}

export interface DataFileInfo {
  path: string;
  absolutePath: string;
  type: "csv" | "parquet" | "json" | "duckdb" | "unknown";
  size_bytes?: number;
  alias: string;
}

export interface TableSource {
  sql: string;
  displayName: string;
  sourcePath?: string;
  isFileSource: boolean;
  sourceType?: "evidence_sql" | "file" | "duckdb_table";
}

export interface ColumnProfile {
  name: string;
  type: string;
  null_count: number;
  null_pct: number;
  distinct_count?: number;
  min?: unknown;
  max?: unknown;
  avg?: number;
  median?: number;
  stddev?: number;
  top_values?: Array<{ value: unknown; count: number; pct?: number }>;
  avg_length?: number;
  min_length?: number;
  max_length?: number;
}

export type FindingSeverity = "info" | "warning" | "error";

export interface Finding {
  severity: FindingSeverity;
  code: string;
  column?: string;
  message: string;
  evidence?: unknown;
}

export interface JoinCoverageResult {
  name: string;
  fact_table: string;
  fk_column: string;
  match_rule: string;
  fact_row_count: number;
  matched: number;
  null_fk: number;
  orphans: number;
  orphan_pct: number;
  coverage_pct: number;
  dim_row_count: number;
  used: number;
  unused: number;
  unused_pct: number;
  fk_type?: string;
  key_type?: string;
  type_compatible: boolean;
}

export interface JoinCandidateMatch {
  fact_table: string;
  fk_column: string;
  match_rule: string;
}
