import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { TOOL_NAMES } from "../constants";
import type { DuckDbBiConfig } from "../types";
import { appendAuditEntry, createQueryId, trimSql } from "../lib/audit-log";
import { runDuckDbJson } from "../lib/duckdb-cli";
import { discoverDataFiles, ensureRuntimeDirs, withProjectRoot } from "../lib/paths";
import { discoverEvidenceSources } from "../lib/evidence-sources";
import { toolResponse } from "../lib/tool-result";

const Parameters = Type.Object({
  database: Type.Optional(Type.String()),
  include_views: Type.Optional(Type.Boolean({ default: true })),
  include_system: Type.Optional(Type.Boolean({ default: false })),
  include_counts: Type.Optional(Type.Boolean({ default: false })),
});

export function registerListTablesTool(pi: ExtensionAPI, baseConfig: DuckDbBiConfig) {
  pi.registerTool(defineTool({
    name: TOOL_NAMES.listTables,
    label: "DuckDB: List Tables",
    description: "Discover tables/views in a DuckDB database and project data files exposed as file-backed table aliases.",
    parameters: Parameters,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = withProjectRoot(baseConfig, ctx.cwd ?? process.cwd());
      await ensureRuntimeDirs(config);
      const includeSystem = params.include_system === true;
      const includeViews = params.include_views !== false;
      const where = includeSystem ? "1=1" : "table_schema NOT IN ('pg_catalog', 'information_schema')";
      const viewClause = includeViews ? "" : "AND table_type <> 'VIEW'";
      const sql = `SELECT table_catalog AS database, table_schema AS schema, table_name AS name, table_type AS type FROM information_schema.tables WHERE ${where} ${viewClause} ORDER BY table_schema, table_name`;
      const queryId = createQueryId(sql);
      let databaseSchemas: any[] = [];
      let elapsedMs = 0;
      try {
        const result = await runDuckDbJson(config, { sql, database: params.database, readonly: true, signal });
        elapsedMs = result.elapsedMs;
        databaseSchemas = groupRows(result.rows);
        await appendAuditEntry(config, {
          query_id: queryId,
          tool_name: TOOL_NAMES.listTables,
          timestamp: new Date().toISOString(),
          sql: trimSql(sql),
          database: params.database,
          elapsed_ms: result.elapsedMs,
          row_count: result.rowCount,
          truncated: false,
          status: "ok",
        });
      } catch (err) {
        await appendAuditEntry(config, {
          query_id: queryId,
          tool_name: TOOL_NAMES.listTables,
          timestamp: new Date().toISOString(),
          sql: trimSql(sql),
          database: params.database,
          elapsed_ms: elapsedMs,
          status: "error",
          error_message: (err as Error).message,
        });
        databaseSchemas = [];
      }
      const evidenceTables = (await discoverEvidenceSources(config)).map((source) => ({
        name: source.qualifiedName,
        type: "view" as const,
        source_type: "evidence_sql" as const,
        source_path: source.path,
        recommended_for_dashboard: true,
      }));
      const fileTables = (await discoverDataFiles(config)).filter((file) => file.type !== "duckdb").map((file) => ({
        name: file.alias,
        type: "view" as const,
        source_type: "file" as const,
        source_path: file.path,
        recommended_for_dashboard: false,
        row_count: params.include_counts ? undefined : undefined,
      }));
      const schemas = [...databaseSchemas];
      if (evidenceTables.length) schemas.push({ database: "project", schema: "evidence_sources", tables: evidenceTables });
      if (fileTables.length) schemas.push({ database: "project", schema: "files", tables: fileTables });
      return toolResponse({ ok: true, schemas, elapsed_ms: elapsedMs, query_id: queryId });
    },
  }));
}

function groupRows(rows: Array<Record<string, unknown>>) {
  const bySchema = new Map<string, { database?: string; schema: string; tables: any[] }>();
  for (const row of rows) {
    const schema = String(row.schema ?? "main");
    const key = `${row.database ?? ""}.${schema}`;
    if (!bySchema.has(key)) bySchema.set(key, { database: row.database as string | undefined, schema, tables: [] });
    bySchema.get(key)!.tables.push({ name: row.name, type: normalizeType(String(row.type ?? "unknown")) });
  }
  return [...bySchema.values()];
}

function normalizeType(type: string): "table" | "view" | "temporary" | "unknown" {
  const upper = type.toUpperCase();
  if (upper.includes("VIEW")) return "view";
  if (upper.includes("TEMP")) return "temporary";
  if (upper.includes("BASE") || upper.includes("TABLE")) return "table";
  return "unknown";
}
