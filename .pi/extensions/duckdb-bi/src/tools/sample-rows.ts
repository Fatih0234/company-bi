import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { TOOL_NAMES } from "../constants";
import type { DuckDbBiConfig } from "../types";
import { appendAuditEntry, createQueryId, trimSql } from "../lib/audit-log";
import { runDuckDbJson } from "../lib/duckdb-cli";
import { assertSafeWhere, resolveTableSource } from "../lib/sql-safety";
import { ensureRuntimeDirs, withProjectRoot } from "../lib/paths";
import { clampRows } from "../lib/truncation";
import { toolResponse } from "../lib/tool-result";

const Parameters = Type.Object({
  table: Type.String(),
  schema: Type.Optional(Type.String()),
  database: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number({ default: 20, minimum: 1, maximum: 200 })),
  method: Type.Optional(StringEnum(["first", "random"] as const)),
  where: Type.Optional(Type.String()),
});

export function registerSampleRowsTool(pi: ExtensionAPI, baseConfig: DuckDbBiConfig) {
  pi.registerTool(defineTool({
    name: TOOL_NAMES.sampleRows,
    label: "DuckDB: Sample Rows",
    description: "Return a bounded first or random sample of rows for semantic inspection.",
    parameters: Parameters,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = withProjectRoot(baseConfig, ctx.cwd ?? process.cwd());
      await ensureRuntimeDirs(config);
      assertSafeWhere(params.where);
      const source = await resolveTableSource(config, params.table, params.schema);
      const limit = Math.min(clampRows(params.limit ?? 20), 200);
      const whereClause = params.where?.trim() ? ` WHERE ${params.where.trim()}` : "";
      const orderClause = params.method === "random" ? " ORDER BY random()" : "";
      const sql = `SELECT * FROM ${source.sql}${whereClause}${orderClause} LIMIT ${limit}`;
      const queryId = createQueryId(sql);
      const result = await runDuckDbJson(config, { sql, database: params.database, readonly: true, signal });
      await appendAuditEntry(config, {
        query_id: queryId,
        tool_name: TOOL_NAMES.sampleRows,
        timestamp: new Date().toISOString(),
        sql: trimSql(sql),
        database: params.database,
        elapsed_ms: result.elapsedMs,
        row_count: result.rowCount,
        truncated: false,
        status: "ok",
      });
      return toolResponse({
        ok: true,
        table: source.displayName,
        columns: result.columns,
        rows: result.rows,
        row_count: result.rowCount,
        sampling_method: params.method ?? "first",
        elapsed_ms: result.elapsedMs,
        query_id: queryId,
      });
    },
  }));
}
