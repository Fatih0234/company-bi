/**
 * Evidence Quality Guard - Types
 *
 * Core type definitions for the unified quality validation system.
 */

// ── Query Validation Types ───────────────────────────────────────────

export interface ValidatedQuery {
  /** Normalized query hash (whitespace collapsed, lowercased) */
  queryHash: string;
  /** Original SQL (trimmed) */
  sql: string;
  /** Number of rows returned */
  rowCount: number;
  /** Column names from the result */
  columns: string[];
  /** Timestamp when validated */
  validatedAt: number;
  /** Query ID from duckdb_run_sql */
  queryId?: string;
}

export interface QueryCache {
  /** Map of query hash to validated query */
  queries: Map<string, ValidatedQuery>;
  /** Timestamp of last update */
  lastUpdated: number;
}

// ── SQL Block Types ─────────────────────────────────────────────────

export interface SqlBlock {
  /** Block name (from ```sql block_name) */
  name: string;
  /** SQL content */
  content: string;
  /** Line number where block starts (1-indexed) */
  line: number;
  /** Normalized hash of the SQL content */
  hash: string;
}

// ── Validation Result Types ─────────────────────────────────────────

export type ValidationErrorType =
  | 'query_not_validated'
  | 'query_empty'
  | 'query_error'
  | 'static_analysis'
  | 'missing_data_reference';

export interface ValidationError {
  type: ValidationErrorType;
  message: string;
  fixHint: string;
  line?: number;
  blockName?: string;
}

export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** List of errors (empty if valid) */
  errors: ValidationError[];
  /** List of warnings (non-blocking) */
  warnings: string[];
  /** SQL blocks found in the page */
  sqlBlocks: SqlBlock[];
  /** Which blocks are validated */
  validatedBlocks: string[];
  /** Which blocks are not validated */
  unvalidatedBlocks: string[];
  /** Which blocks have empty results */
  emptyBlocks: string[];
}

// ── Static Analysis Types ───────────────────────────────────────────

export interface RenderingIssue {
  line: number;
  message: string;
  fixHint: string;
  severity: 'error' | 'warning';
}

// ── Extension State Types ───────────────────────────────────────────

export interface ExtensionState {
  /** Query validation cache */
  queryCache: Map<string, ValidatedQuery>;
  /** Whether duckdb_run_sql is available */
  duckdbAvailable: boolean;
  /** Pages directory path */
  pagesDir: string;
}

// ── duckdb_run_sql Response Types ───────────────────────────────────

export interface DuckDbRunSqlResponse {
  ok: boolean;
  columns: string[];
  rows: any[];
  row_count: number;
  elapsed_ms: number;
  truncated: boolean;
  query_id: string;
  error?: {
    code: string;
    message: string;
  };
}

// ── Tool Event Types ────────────────────────────────────────────────

export interface ToolResultEvent {
  toolName: string;
  toolCallId: string;
  input: Record<string, any>;
  content: string;
  details?: any;
  isError?: boolean;
}

// ── Constants ───────────────────────────────────────────────────────

export const TOOL_NAMES = {
  duckdbRunSql: 'duckdb_run_sql',
  write: 'write',
  edit: 'edit',
} as const;

export const VALIDATION_CACHE_KEY = 'evidence-query-cache';
export const VALIDATION_STATE_KEY = 'evidence-quality-guard-state';

export const MAX_QUERY_HASH_LENGTH = 1000;
export const MAX_CACHED_QUERIES = 500;
export const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
