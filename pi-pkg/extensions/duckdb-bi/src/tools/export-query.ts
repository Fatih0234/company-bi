import { stat, writeFile } from "node:fs/promises";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { EXPORT_MAX_OUTPUT_BYTES, ERROR_CODES, TOOL_NAMES } from "../constants";
import type { DuckDbBiConfig } from "../types";
import { appendAuditEntry, auditBlocked, createQueryId, trimSql } from "../lib/audit-log";
import { runDuckDbJson } from "../lib/duckdb-cli";
import { rowsToCsv, rowsToJsonl, rowsToMarkdown } from "../lib/formatters";
import { assertSqlAllowed } from "../lib/sql-safety";
import { ensureRuntimeDirs, pathExists, resolveExportPath, safeOutputName, toProjectRelative, withProjectRoot } from "../lib/paths";
import { toolResponse } from "../lib/tool-result";

const Parameters = Type.Object({
  sql: Type.String(),
  format: StringEnum(["csv", "json", "jsonl", "markdown"] as const),
  output_name: Type.Optional(Type.String()),
  database: Type.Optional(Type.String()),
  readonly: Type.Optional(Type.Boolean({ default: true })),
  timeout_ms: Type.Optional(Type.Number({ default: 30000, minimum: 1000, maximum: 120000 })),
  overwrite: Type.Optional(Type.Boolean({ default: false })),
});

export function registerExportQueryTool(pi: ExtensionAPI, baseConfig: DuckDbBiConfig) {
  pi.registerTool(defineTool({
    name: TOOL_NAMES.exportQuery,
    label: "DuckDB: Export Query",
    description: "Run a readonly SQL query and save all returned rows to a CSV, JSON, JSONL, or Markdown artifact under .pi/duckdb/exports/.",
    parameters: Parameters,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = withProjectRoot(baseConfig, ctx.cwd ?? process.cwd());
      await ensureRuntimeDirs(config);
      const queryId = createQueryId(params.sql ?? "");
      const started = Date.now();
      try {
        assertSqlAllowed(params.sql, { readonly: params.readonly ?? true });
        const ext = params.format === "markdown" ? "md" : params.format;
        const filename = safeOutputName(params.output_name, queryId, ext);
        const outputPath = resolveExportPath(config, filename);
        if (!params.overwrite && await pathExists(outputPath)) throw Object.assign(new Error(`Export already exists: ${toProjectRelative(config, outputPath)}`), { code: ERROR_CODES.invalidPath });
        const result = await runDuckDbJson(config, { sql: params.sql, database: params.database, readonly: params.readonly ?? true, timeoutMs: params.timeout_ms, maxOutputBytes: EXPORT_MAX_OUTPUT_BYTES, signal });
        const serialized = serializeRows(result.rows, params.format);
        await writeFile(outputPath, serialized, "utf8");
        const s = await stat(outputPath);
        const rel = toProjectRelative(config, outputPath);
        await appendAuditEntry(config, {
          query_id: queryId,
          tool_name: TOOL_NAMES.exportQuery,
          timestamp: new Date().toISOString(),
          sql: trimSql(params.sql),
          database: params.database,
          elapsed_ms: result.elapsedMs,
          row_count: result.rowCount,
          truncated: false,
          status: "ok",
          artifact_paths: [rel],
        });
        return toolResponse({ ok: true, path: rel, format: params.format, rows: result.rowCount, bytes: s.size, elapsed_ms: result.elapsedMs, query_id: queryId });
      } catch (err) {
        const code = (err as any).code ?? ERROR_CODES.exportFailed;
        if (code === ERROR_CODES.sqlBlocked || /blocked|not allowed|Multiple SQL/i.test((err as Error).message)) {
          await auditBlocked(config, { queryId, toolName: TOOL_NAMES.exportQuery, sql: params.sql, database: params.database, errorMessage: (err as Error).message });
        } else {
          await appendAuditEntry(config, { query_id: queryId, tool_name: TOOL_NAMES.exportQuery, timestamp: new Date().toISOString(), sql: trimSql(params.sql ?? ""), database: params.database, elapsed_ms: Date.now() - started, status: "error", error_message: (err as Error).message });
        }
        return toolResponse({ ok: false, path: undefined, format: params.format, rows: 0, elapsed_ms: Date.now() - started, query_id: queryId, error: { code, message: (err as Error).message } });
      }
    },
  }));
}

function serializeRows(rows: Array<Record<string, unknown>>, format: string): string {
  if (format === "csv") return rowsToCsv(rows);
  if (format === "jsonl") return rowsToJsonl(rows);
  if (format === "markdown") return rowsToMarkdown(rows);
  return `${JSON.stringify(rows, null, 2)}\n`;
}
