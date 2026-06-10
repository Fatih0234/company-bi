import { writeFile } from "node:fs/promises";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { DEFAULT_MAX_OUTPUT_BYTES, DEFAULT_TIMEOUT_MS, ERROR_CODES, TOOL_NAMES } from "../constants";
import type { DuckDbBiConfig, EvidenceSourceInfo } from "../types";
import { appendAuditEntry, auditBlocked, createQueryId, trimSql } from "../lib/audit-log";
import { runDuckDbJson } from "../lib/duckdb-cli";
import { discoverEvidenceSources, readEvidenceSourceSql } from "../lib/evidence-sources";
import { assertSqlAllowed } from "../lib/sql-safety";
import { clampRows, truncateRows } from "../lib/truncation";
import { ensureRuntimeDirs, resolveExportPath, safeOutputName, toProjectRelative, withProjectRoot } from "../lib/paths";
import { toolResponse } from "../lib/tool-result";

const Parameters = Type.Object({
  sql: Type.String({ description: "Evidence page SQL block to validate." }),
  query_name: Type.Optional(Type.String()),
  component_type: Type.Optional(Type.String({ description: "Optional Evidence component the query will feed, e.g. BarChart, LineChart, BigValue, DataTable." })),
  expected_columns: Type.Optional(Type.Array(Type.String())),
  database: Type.Optional(Type.String()),
  max_rows_preview: Type.Optional(Type.Number({ default: 25, minimum: 1, maximum: 200 })),
  timeout_ms: Type.Optional(Type.Number({ default: DEFAULT_TIMEOUT_MS, minimum: 1000, maximum: 120000 })),
  save_full_result: Type.Optional(Type.Boolean({ default: false })),
  evidence_mode: Type.Optional(Type.Boolean({ default: true })),
});

type Issue = {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  fix_hint?: string;
  evidence?: unknown;
};

const RAW_FILE_RE = /\bread_(?:csv|csv_auto|parquet|json|json_auto)\s*\(/i;
const TABLE_REF_RE = /\b(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_.]*)\b/gi;

export function registerValidateEvidenceSqlTool(pi: ExtensionAPI, baseConfig: DuckDbBiConfig) {
  pi.registerTool(defineTool({
    name: TOOL_NAMES.validateEvidenceSql,
    label: "DuckDB: Validate Evidence SQL",
    description: "Validate SQL intended for Evidence pages: readonly safety, registered source usage, non-empty result, expected columns, and component-specific handoff warnings.",
    promptSnippet: "Validate an Evidence page SQL block before writing it: source names, non-empty result, expected columns, and chart-readiness warnings.",
    promptGuidelines: [
      "Use duckdb_validate_evidence_sql immediately before moving a query from exploration into pages/report.md.",
      "Evidence page SQL should use registered source names such as files.orders, not raw read_csv_auto/read_parquet file paths.",
      "Treat evidence_ready=false as a blocker for polished report pages unless the user explicitly accepts the risk.",
    ],
    parameters: Parameters,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = withProjectRoot(baseConfig, ctx.cwd ?? process.cwd());
      await ensureRuntimeDirs(config);
      const started = Date.now();
      const queryId = createQueryId(params.sql ?? "");
      const issues: Issue[] = [];

      let resolvedSql = params.sql;
      let referencedSources: string[] = [];
      try {
        const sources = await discoverEvidenceSources(config);
        referencedSources = sourceRefsForSql(params.sql, sources);
        resolvedSql = await resolveEvidenceSourceRefs(config, params.sql, sources);
      } catch (err) {
        issues.push({
          severity: "warning",
          code: "SOURCE_RESOLUTION_WARNING",
          message: `Could not fully resolve Evidence source references: ${(err as Error).message}`,
          fix_hint: "Run duckdb_data_sources and use the exact registered source name.",
        });
      }

      if (params.evidence_mode !== false && RAW_FILE_RE.test(params.sql)) {
        issues.push({
          severity: "error",
          code: "RAW_FILE_READ_IN_EVIDENCE_SQL",
          message: "Evidence page SQL should not call read_csv/read_parquet/read_json directly.",
          fix_hint: "Run cmux-evidence data refresh, then query the registered source name such as files.orders.",
        });
      }

      try {
        assertSqlAllowed(resolvedSql, { readonly: true });
      } catch (err) {
        await auditBlocked(config, {
          queryId,
          toolName: TOOL_NAMES.validateEvidenceSql,
          sql: params.sql,
          database: params.database,
          errorMessage: (err as Error).message,
        });
        issues.push({
          severity: "error",
          code: ERROR_CODES.sqlBlocked,
          message: (err as Error).message,
          fix_hint: "Use a single readonly SELECT query for Evidence page SQL.",
        });
        return toolResponse(resultPayload({
          ok: false,
          evidenceReady: false,
          queryId,
          elapsedMs: Date.now() - started,
          issues,
          referencedSources,
        }));
      }

      try {
        const result = await runDuckDbJson(config, {
          sql: resolvedSql,
          database: params.database,
          readonly: true,
          timeoutMs: params.timeout_ms,
          maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
          signal,
        });
        const maxRows = Math.min(clampRows(params.max_rows_preview ?? 25), 200);
        const preview = truncateRows(result.rows, maxRows);
        const actualColumns = result.columns.map((c) => c.name);
        const missingColumns = (params.expected_columns ?? []).filter((name: string) => !actualColumns.includes(name));
        if (result.rowCount === 0) {
          issues.push({
            severity: "error",
            code: "EMPTY_RESULT",
            message: "The SQL returned zero rows. Evidence components fed by this query will render empty.",
            fix_hint: "Relax filters, verify join coverage, or confirm that an empty state is intentional.",
          });
        }
        if (missingColumns.length) {
          issues.push({
            severity: "error",
            code: "MISSING_EXPECTED_COLUMNS",
            message: `The result is missing expected column(s): ${missingColumns.join(", ")}.`,
            fix_hint: "Rename/select the columns required by the planned Evidence component.",
            evidence: { expected_columns: params.expected_columns, actual_columns: actualColumns },
          });
        }
        for (const issue of componentIssues(params.component_type, actualColumns, result.rowCount)) issues.push(issue);

        let resultPath: string | undefined;
        if (params.save_full_result || preview.truncated) {
          const outputPath = resolveExportPath(config, safeOutputName(undefined, queryId, "json"));
          await writeFile(outputPath, JSON.stringify(result.rows, null, 2), "utf8");
          resultPath = toProjectRelative(config, outputPath);
        }

        await appendAuditEntry(config, {
          query_id: queryId,
          tool_name: TOOL_NAMES.validateEvidenceSql,
          timestamp: new Date().toISOString(),
          sql: trimSql(params.sql),
          database: params.database,
          elapsed_ms: result.elapsedMs,
          row_count: result.rowCount,
          truncated: preview.truncated,
          status: "ok",
          artifact_paths: resultPath ? [resultPath] : undefined,
        });

        return toolResponse(resultPayload({
          ok: true,
          evidenceReady: !issues.some((i) => i.severity === "error"),
          queryId,
          elapsedMs: result.elapsedMs,
          issues,
          referencedSources,
          columns: actualColumns,
          rows: preview.rows,
          rowCount: result.rowCount,
          truncated: preview.truncated,
          resultPath,
        }));
      } catch (err) {
        await appendAuditEntry(config, {
          query_id: queryId,
          tool_name: TOOL_NAMES.validateEvidenceSql,
          timestamp: new Date().toISOString(),
          sql: trimSql(params.sql),
          database: params.database,
          elapsed_ms: Date.now() - started,
          row_count: 0,
          truncated: false,
          status: "error",
          error_message: (err as Error).message,
        });
        issues.push({
          severity: "error",
          code: (err as any).code ?? ERROR_CODES.duckdbError,
          message: (err as Error).message,
          fix_hint: "Run duckdb_data_sources to verify source names, then validate a smaller SELECT query.",
        });
        return toolResponse(resultPayload({
          ok: false,
          evidenceReady: false,
          queryId,
          elapsedMs: Date.now() - started,
          issues,
          referencedSources,
        }));
      }
    },
  }));
}

function resultPayload(input: {
  ok: boolean;
  evidenceReady: boolean;
  queryId: string;
  elapsedMs: number;
  issues: Issue[];
  referencedSources: string[];
  columns?: string[];
  rows?: Array<Record<string, unknown>>;
  rowCount?: number;
  truncated?: boolean;
  resultPath?: string;
}) {
  return {
    ok: input.ok,
    evidence_ready: input.evidenceReady,
    summary: input.evidenceReady
      ? "SQL is ready for Evidence page use."
      : "SQL needs fixes before polished Evidence page use.",
    query_id: input.queryId,
    elapsed_ms: input.elapsedMs,
    row_count: input.rowCount ?? 0,
    columns: input.columns ?? [],
    rows: input.rows ?? [],
    truncated: input.truncated ?? false,
    result_path: input.resultPath,
    referenced_sources: input.referencedSources,
    issues: input.issues,
    warnings: input.issues.filter((i) => i.severity !== "error").map((i) => i.message),
    next_actions: nextActions(input.issues),
  };
}

function nextActions(issues: Issue[]): string[] {
  if (!issues.length) return ["Write this SQL into the Evidence page, then validate the rendered preview."];
  return issues.map((issue) => issue.fix_hint).filter((hint): hint is string => !!hint);
}

function sourceRefsForSql(sql: string, sources: EvidenceSourceInfo[]): string[] {
  const sourceNames = new Set(sources.map((s) => s.qualifiedName));
  const refs = new Set<string>();
  for (const match of sql.matchAll(TABLE_REF_RE)) {
    if (sourceNames.has(match[1])) refs.add(match[1]);
  }
  return [...refs];
}

async function resolveEvidenceSourceRefs(config: DuckDbBiConfig, sql: string, sources: EvidenceSourceInfo[]): Promise<string> {
  const refs = sourceRefsForSql(sql, sources);
  if (!refs.length) return sql;
  let resolvedSql = sql;
  const ctes: string[] = [];
  for (const ref of refs) {
    const source = sources.find((s) => s.qualifiedName === ref);
    if (!source) continue;
    const sourceSql = await readEvidenceSourceSql(config, source);
    ctes.push(`${quoteIdentifier(ref)} AS ${sourceSql}`);
    const refRe = new RegExp(`\\b(FROM|JOIN)\\s+${escapeRegExp(ref)}\\b`, "g");
    resolvedSql = resolvedSql.replace(refRe, (_full, keyword) => `${keyword} ${quoteIdentifier(ref)}`);
  }
  if (!ctes.length) return sql;
  if (/^\s*WITH\s+/i.test(resolvedSql)) return resolvedSql.replace(/^\s*WITH\s+/i, `WITH ${ctes.join(",\n")}, `);
  return `WITH ${ctes.join(",\n")}\n${resolvedSql}`;
}

function componentIssues(componentType: string | undefined, columns: string[], rowCount: number): Issue[] {
  const component = (componentType ?? "").toLowerCase();
  const issues: Issue[] = [];
  if (!component) return issues;
  if (component.includes("bigvalue") && columns.length > 2) {
    issues.push({
      severity: "warning",
      code: "BIGVALUE_WIDE_RESULT",
      message: "BigValue queries should usually return one row and one primary metric column.",
      fix_hint: "Aggregate to a single metric row before feeding BigValue.",
    });
  }
  if ((component.includes("linechart") || component.includes("areachart")) && !columns.some((c) => /date|time|month|week|year|day/i.test(c))) {
    issues.push({
      severity: "warning",
      code: "NO_TIME_COLUMN_FOR_TIME_CHART",
      message: "The result has no obvious time column for a time-series chart.",
      fix_hint: "Select a date/time grain column or choose a non-time chart.",
    });
  }
  if ((component.includes("barchart") || component.includes("linechart") || component.includes("areachart")) && rowCount > 500) {
    issues.push({
      severity: "warning",
      code: "CHART_RESULT_TOO_LARGE",
      message: "The result has many rows for a chart and may render poorly.",
      fix_hint: "Aggregate, filter, or limit the query before using it in a chart.",
    });
  }
  return issues;
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
