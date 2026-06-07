import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { TOOL_NAMES } from "../constants";
import type { ColumnInfo, DuckDbBiConfig } from "../types";
import { appendAuditEntry, createQueryId, trimSql } from "../lib/audit-log";
import { runDuckDbJson } from "../lib/duckdb-cli";
import { quoteIdentifier, resolveTableSource } from "../lib/sql-safety";
import { ensureRuntimeDirs, withProjectRoot } from "../lib/paths";
import { toolResponse } from "../lib/tool-result";

const Parameters = Type.Object({
  table: Type.String(),
  schema: Type.Optional(Type.String()),
  database: Type.Optional(Type.String()),
  include_sample_values: Type.Optional(Type.Boolean({ default: true })),
  sample_limit: Type.Optional(Type.Number({ default: 5, minimum: 1, maximum: 25 })),
});

export function registerDescribeTableTool(pi: ExtensionAPI, baseConfig: DuckDbBiConfig) {
  pi.registerTool(defineTool({
    name: TOOL_NAMES.describeTable,
    label: "DuckDB: Describe Table",
    description: "Describe columns, DuckDB types, nullability/defaults, and optional sample values for a table or project data-file alias.",
    promptSnippet: "Describe columns and types for a table or data file (with optional sample values).",
    promptGuidelines: [
      "After duckdb_describe_table, pair it with duckdb_summarize_table before drawing conclusions — types alone do not show null %, distinct counts, or top values.",
      "Note any text column whose name looks like an ID (e.g. `id`, `*_id`); it may need explicit casting to join against numeric keys.",
    ],
    parameters: Parameters,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = withProjectRoot(baseConfig, ctx.cwd ?? process.cwd());
      await ensureRuntimeDirs(config);
      const source = await resolveTableSource(config, params.table, params.schema);
      const sql = `DESCRIBE SELECT * FROM ${source.sql}`;
      const queryId = createQueryId(sql);
      const result = await runDuckDbJson(config, { sql, database: params.database, readonly: true, signal });
      const columns: ColumnInfo[] = result.rows.map((row) => ({
        name: String(row.column_name ?? row.name ?? ""),
        type: String(row.column_type ?? row.type ?? ""),
        nullable: row.null === "YES" || row.null === true || row.nullable === true,
        default: (row.default as string | null | undefined) ?? null,
      })).filter((col) => col.name);

      if (params.include_sample_values !== false && columns.length) {
        const sampleLimit = Math.max(1, Math.min(Number(params.sample_limit ?? 5), 25));
        for (const col of columns) {
          const sampleSql = `SELECT DISTINCT ${quoteIdentifier(col.name)} AS value FROM ${source.sql} WHERE ${quoteIdentifier(col.name)} IS NOT NULL LIMIT ${sampleLimit}`;
          try {
            const sampleResult = await runDuckDbJson(config, { sql: sampleSql, database: params.database, readonly: true, signal });
            col.sample_values = sampleResult.rows.map((row) => row.value);
          } catch {
            col.sample_values = [];
          }
        }
      }

      await appendAuditEntry(config, {
        query_id: queryId,
        tool_name: TOOL_NAMES.describeTable,
        timestamp: new Date().toISOString(),
        sql: trimSql(sql),
        database: params.database,
        elapsed_ms: result.elapsedMs,
        row_count: columns.length,
        truncated: false,
        status: "ok",
      });
      return toolResponse({ ok: true, table: source.displayName, columns, elapsed_ms: result.elapsedMs, query_id: queryId });
    },
  }));
}
