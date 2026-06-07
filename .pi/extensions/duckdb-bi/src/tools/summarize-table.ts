import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { TOOL_NAMES } from "../constants";
import type { ColumnInfo, ColumnProfile, DuckDbBiConfig, Finding } from "../types";
import { appendAuditEntry, createQueryId, trimSql } from "../lib/audit-log";
import { runDuckDbJson } from "../lib/duckdb-cli";
import { coerceNumber, isDateType, isNumericType, isTextType } from "../lib/result-parser";
import { quoteIdentifier, resolveTableSource } from "../lib/sql-safety";
import { ensureRuntimeDirs, withProjectRoot } from "../lib/paths";
import { computeColumnFindings } from "../lib/findings";
import { toolResponse } from "../lib/tool-result";

const Parameters = Type.Object({
  table: Type.String(),
  schema: Type.Optional(Type.String()),
  database: Type.Optional(Type.String()),
  max_top_values: Type.Optional(Type.Number({ default: 10, minimum: 1, maximum: 25 })),
  include_text_stats: Type.Optional(Type.Boolean({ default: true })),
  include_date_stats: Type.Optional(Type.Boolean({ default: true })),
});

export async function summarizeTable(config: DuckDbBiConfig, params: any, signal?: AbortSignal) {
  const source = await resolveTableSource(config, params.table, params.schema);
  const queryIds: string[] = [];
  const started = Date.now();
  const describeSql = `DESCRIBE SELECT * FROM ${source.sql}`;
  const describeId = createQueryId(describeSql);
  const describe = await runDuckDbJson(config, { sql: describeSql, database: params.database, readonly: true, signal });
  queryIds.push(describeId);
  await appendAuditEntry(config, {
    query_id: describeId,
    tool_name: TOOL_NAMES.summarizeTable,
    timestamp: new Date().toISOString(),
    sql: trimSql(describeSql),
    database: params.database,
    elapsed_ms: describe.elapsedMs,
    row_count: describe.rowCount,
    truncated: false,
    status: "ok",
  });
  const columns: ColumnInfo[] = describe.rows.map((row) => ({
    name: String(row.column_name ?? row.name ?? ""),
    type: String(row.column_type ?? row.type ?? ""),
  })).filter((col) => col.name);

  const rowCountSql = `SELECT COUNT(*) AS row_count FROM ${source.sql}`;
  const rowCountId = createQueryId(rowCountSql);
  const rowCountResult = await runDuckDbJson(config, { sql: rowCountSql, database: params.database, readonly: true, signal });
  queryIds.push(rowCountId);
  await appendAuditEntry(config, {
    query_id: rowCountId,
    tool_name: TOOL_NAMES.summarizeTable,
    timestamp: new Date().toISOString(),
    sql: trimSql(rowCountSql),
    database: params.database,
    elapsed_ms: rowCountResult.elapsedMs,
    row_count: rowCountResult.rowCount,
    truncated: false,
    status: "ok",
  });
  const rowCount = coerceNumber(rowCountResult.rows[0]?.row_count, 0);
  const profiles: ColumnProfile[] = [];
  const topN = Math.max(1, Math.min(Number(params.max_top_values ?? 10), 25));

  for (const column of columns) {
    const col = quoteIdentifier(column.name);
    const baseSelect = [
      `SUM(CASE WHEN ${col} IS NULL THEN 1 ELSE 0 END) AS null_count`,
      `COUNT(DISTINCT ${col}) AS distinct_count`,
    ];
    if (isNumericType(column.type)) {
      baseSelect.push(`MIN(${col}) AS min`, `MAX(${col}) AS max`, `AVG(${col}) AS avg`, `MEDIAN(${col}) AS median`, `STDDEV_SAMP(${col}) AS stddev`);
    } else if (isDateType(column.type) && params.include_date_stats !== false) {
      baseSelect.push(`MIN(${col}) AS min`, `MAX(${col}) AS max`);
    } else if (isTextType(column.type) && params.include_text_stats !== false) {
      baseSelect.push(`AVG(LENGTH(${col})) AS avg_length`, `MIN(LENGTH(${col})) AS min_length`, `MAX(LENGTH(${col})) AS max_length`);
    }
    const profileSql = `SELECT ${baseSelect.join(", ")} FROM ${source.sql}`;
    const profileId = createQueryId(profileSql);
    const result = await runDuckDbJson(config, { sql: profileSql, database: params.database, readonly: true, signal });
    queryIds.push(profileId);
    await appendAuditEntry(config, {
      query_id: profileId,
      tool_name: TOOL_NAMES.summarizeTable,
      timestamp: new Date().toISOString(),
      sql: trimSql(profileSql),
      database: params.database,
      elapsed_ms: result.elapsedMs,
      row_count: result.rowCount,
      truncated: false,
      status: "ok",
    });
    const r = result.rows[0] ?? {};
    const profile: ColumnProfile = {
      name: column.name,
      type: column.type ?? "",
      null_count: coerceNumber(r.null_count, 0),
      null_pct: rowCount ? Number((coerceNumber(r.null_count, 0) / rowCount).toFixed(4)) : 0,
      distinct_count: coerceNumber(r.distinct_count, 0),
      min: r.min,
      max: r.max,
      avg: r.avg === undefined || r.avg === null ? undefined : Number(r.avg),
      median: r.median === undefined || r.median === null ? undefined : Number(r.median),
      stddev: r.stddev === undefined || r.stddev === null ? undefined : Number(r.stddev),
      avg_length: r.avg_length === undefined || r.avg_length === null ? undefined : Number(r.avg_length),
      min_length: r.min_length === undefined || r.min_length === null ? undefined : Number(r.min_length),
      max_length: r.max_length === undefined || r.max_length === null ? undefined : Number(r.max_length),
    };
    const topSql = `SELECT ${col} AS value, COUNT(*) AS count, CASE WHEN ${rowCount} = 0 THEN 0 ELSE ROUND(COUNT(*) * 100.0 / ${rowCount}, 2) END AS pct FROM ${source.sql} GROUP BY ${col} ORDER BY count DESC LIMIT ${topN}`;
    const topId = createQueryId(topSql);
    try {
      const topResult = await runDuckDbJson(config, { sql: topSql, database: params.database, readonly: true, signal });
      queryIds.push(topId);
      profile.top_values = topResult.rows.map((row) => ({ value: row.value, count: coerceNumber(row.count, 0), pct: Number(row.pct ?? 0) }));
      await appendAuditEntry(config, {
        query_id: topId,
        tool_name: TOOL_NAMES.summarizeTable,
        timestamp: new Date().toISOString(),
        sql: trimSql(topSql),
        database: params.database,
        elapsed_ms: topResult.elapsedMs,
        row_count: topResult.rowCount,
        truncated: false,
        status: "ok",
      });
    } catch {
      // top values are useful but should not fail the whole summary
    }
    profiles.push(profile);
  }

  const findings: Finding[] = computeColumnFindings(profiles, rowCount);

  return {
    ok: true,
    table: source.displayName,
    row_count: rowCount,
    column_count: columns.length,
    columns: profiles,
    findings,
    elapsed_ms: Date.now() - started,
    query_ids: queryIds,
  };
}

export function registerSummarizeTableTool(pi: ExtensionAPI, baseConfig: DuckDbBiConfig) {
  pi.registerTool(defineTool({
    name: TOOL_NAMES.summarizeTable,
    label: "DuckDB: Summarize Table",
    description: "Profile a table with row/column counts, nulls, distinct counts, numeric stats, text length stats, date ranges, top values, and a `findings` array of interpretation hints (duplicate names, edge-case sentinels, PK gaps, kind heuristics).",
    promptSnippet: "Profile a table: stats + a `findings` array flagging duplicates, sentinels, PK gaps, and table kind.",
    promptGuidelines: [
      "After duckdb_summarize_table, read the `findings` array before drawing conclusions. Each finding is a question, not noise — especially `DUPLICATE_NAME`, `EDGE_CASE_SENTINEL`, `NON_UNIQUE_PRIMARY_KEY`, and `POSSIBLE_DIMENSION` / `POSSIBLE_FACT`.",
      "For dimension/lookup tables (look for a `POSSIBLE_DIMENSION` finding), call duckdb_join_coverage against sibling fact files in `data/` to verify FK coverage in both directions.",
      "Surface edge-case sentinels (N/A, Unknown, Other, '') by name in the narrative — not just their counts — so the user can decide how to handle them.",
    ],
    parameters: Parameters,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = withProjectRoot(baseConfig, ctx.cwd ?? process.cwd());
      await ensureRuntimeDirs(config);
      return toolResponse(await summarizeTable(config, params, signal));
    },
  }));
}
