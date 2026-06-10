export const TOOL_PREFIX = "duckdb";

export const TOOL_NAMES = {
  runSql: "duckdb_run_sql",
  listTables: "duckdb_list_tables",
  describeTable: "duckdb_describe_table",
  sampleRows: "duckdb_sample_rows",
  summarizeTable: "duckdb_summarize_table",
  qualityReport: "duckdb_quality_report",
  exportQuery: "duckdb_export_query",
  dataSources: "duckdb_data_sources",
  makeReport: "duckdb_make_report",
  queryAuditLog: "duckdb_query_audit_log",
  joinCoverage: "duckdb_join_coverage",
  validateEvidenceSql: "duckdb_validate_evidence_sql",
} as const;

export const DEFAULT_MAX_ROWS = 100;
export const HARD_MAX_ROWS = 1000;
export const DEFAULT_TIMEOUT_MS = 30_000;
export const MAX_TIMEOUT_MS = 120_000;
export const DEFAULT_MAX_OUTPUT_BYTES = 200_000;
export const EXPORT_MAX_OUTPUT_BYTES = 50 * 1024 * 1024;

export const RUNTIME_DIR = ".pi/duckdb";
export const EXPORTS_DIR = "exports";
export const REPORTS_DIR = "reports";
export const AUDIT_DIR = "audit";
export const TMP_DIR = "tmp";
export const AUDIT_LOG_FILE = "query-log.jsonl";

export const ALLOWED_EXPORT_FORMATS = ["csv", "json", "jsonl", "markdown"] as const;
export const DATA_FILE_EXTENSIONS = [".csv", ".tsv", ".parquet", ".json", ".jsonl", ".duckdb", ".db"];

export const ERROR_CODES = {
  duckdbNotFound: "DUCKDB_NOT_FOUND",
  sqlBlocked: "SQL_BLOCKED",
  invalidPath: "INVALID_PATH",
  invalidInput: "INVALID_INPUT",
  timeout: "TIMEOUT",
  duckdbError: "DUCKDB_ERROR",
  outputParseError: "OUTPUT_PARSE_ERROR",
  outputTooLarge: "OUTPUT_TOO_LARGE",
  exportFailed: "EXPORT_FAILED",
  reportFailed: "REPORT_FAILED",
  auditLogError: "AUDIT_LOG_ERROR",
} as const;
