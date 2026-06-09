import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { TOOL_NAMES } from "../constants";
import type { DuckDbBiConfig } from "../types";
import { appendAuditEntry, createQueryId, trimSql } from "../lib/audit-log";
import { runDuckDbJson } from "../lib/duckdb-cli";
import { coerceNumber, isDateType, isNumericType, isTextType } from "../lib/result-parser";
import { quoteIdentifier, resolveTableSource } from "../lib/sql-safety";
import { ensureRuntimeDirs, withProjectRoot } from "../lib/paths";
import { toolResponse } from "../lib/tool-result";
import { summarizeTable } from "./summarize-table";

const Parameters = Type.Object({
  table: Type.String(),
  schema: Type.Optional(Type.String()),
  database: Type.Optional(Type.String()),
  key_columns: Type.Optional(Type.Array(Type.String())),
  date_columns: Type.Optional(Type.Array(Type.String())),
  max_top_values: Type.Optional(Type.Number({ default: 10, minimum: 1, maximum: 25 })),
});

type Issue = { severity: "info" | "warning" | "error"; code: string; column?: string; message: string; evidence?: unknown };

export function registerQualityReportTool(pi: ExtensionAPI, baseConfig: DuckDbBiConfig) {
  pi.registerTool(defineTool({
    name: TOOL_NAMES.qualityReport,
    label: "DuckDB: Quality Report",
    description: "Detect null-heavy columns, duplicate rows/keys, blanks, cardinality risks, date ranges, and suspicious negative values.",
    parameters: Parameters,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = withProjectRoot(baseConfig, ctx.cwd ?? process.cwd());
      await ensureRuntimeDirs(config);
      const started = Date.now();
      const source = await resolveTableSource(config, params.table, params.schema);
      const summary = await summarizeTable(config, params, signal);
      const issues: Issue[] = [];
      const recommendations: string[] = [];
      const queryIds: string[] = [...summary.query_ids];

      for (const col of summary.columns) {
        if (col.null_count === summary.row_count && summary.row_count > 0) {
          issues.push({ severity: "error", code: "ALL_NULL_COLUMN", column: col.name, message: `${col.name} is all NULL.`, evidence: { null_count: col.null_count, row_count: summary.row_count } });
        } else if (col.null_pct >= 0.3) {
          issues.push({ severity: "warning", code: "NULL_HEAVY_COLUMN", column: col.name, message: `${col.name} has ${Math.round(col.null_pct * 100)}% NULL values.`, evidence: { null_pct: col.null_pct, null_count: col.null_count } });
        } else if (col.null_count > 0) {
          issues.push({ severity: "info", code: "NULL_VALUES", column: col.name, message: `${col.name} contains NULL values.`, evidence: { null_count: col.null_count } });
        }
        if (summary.row_count > 0 && col.distinct_count === 1) {
          issues.push({ severity: "info", code: "LOW_CARDINALITY", column: col.name, message: `${col.name} has only one distinct value.`, evidence: { distinct_count: col.distinct_count } });
        }
        if (summary.row_count > 50 && col.distinct_count && col.distinct_count / summary.row_count > 0.95 && !/id|key|uuid|email/i.test(col.name)) {
          issues.push({ severity: "info", code: "HIGH_CARDINALITY", column: col.name, message: `${col.name} is high-cardinality and may not be a good grouping dimension.`, evidence: { distinct_count: col.distinct_count, row_count: summary.row_count } });
        }
      }

      const duplicateSql = `SELECT COUNT(*) AS duplicate_groups, COALESCE(SUM(count - 1), 0) AS duplicate_rows FROM (SELECT COUNT(*) AS count FROM ${source.sql} GROUP BY ALL HAVING COUNT(*) > 1)`;
      const duplicateId = createQueryId(duplicateSql);
      try {
        const duplicate = await runDuckDbJson(config, { sql: duplicateSql, database: params.database, readonly: true, signal });
        queryIds.push(duplicateId);
        const duplicateRows = coerceNumber(duplicate.rows[0]?.duplicate_rows, 0);
        if (duplicateRows > 0) issues.push({ severity: "warning", code: "DUPLICATE_ROWS", message: `Detected ${duplicateRows} duplicate row(s).`, evidence: duplicate.rows[0] });
        await auditOk(config, duplicateId, duplicateSql, params.database, duplicate.elapsedMs, duplicate.rowCount);
      } catch (err) {
        await auditError(config, duplicateId, duplicateSql, params.database, err);
      }

      if (params.key_columns?.length) {
        const keyCols = params.key_columns.map(quoteIdentifier);
        const keySql = `SELECT ${keyCols.join(", ")}, COUNT(*) AS count FROM ${source.sql} GROUP BY ${keyCols.join(", ")} HAVING COUNT(*) > 1 ORDER BY count DESC LIMIT 20`;
        const keyId = createQueryId(keySql);
        try {
          const dupKeys = await runDuckDbJson(config, { sql: keySql, database: params.database, readonly: true, signal });
          queryIds.push(keyId);
          if (dupKeys.rowCount > 0) issues.push({ severity: "error", code: "DUPLICATE_KEY", message: `Key columns are not unique: ${params.key_columns.join(", ")}.`, evidence: dupKeys.rows });
          await auditOk(config, keyId, keySql, params.database, dupKeys.elapsedMs, dupKeys.rowCount);
        } catch (err) {
          await auditError(config, keyId, keySql, params.database, err);
        }
      }

      for (const col of summary.columns) {
        const q = quoteIdentifier(col.name);
        if (isTextType(col.type)) {
          const blankSql = `SELECT COUNT(*) AS blank_count FROM ${source.sql} WHERE TRIM(${q}) = ''`;
          const blankId = createQueryId(blankSql);
          try {
            const blank = await runDuckDbJson(config, { sql: blankSql, database: params.database, readonly: true, signal });
            queryIds.push(blankId);
            const blankCount = coerceNumber(blank.rows[0]?.blank_count, 0);
            if (blankCount > 0) issues.push({ severity: "warning", code: "BLANK_STRINGS", column: col.name, message: `${col.name} contains blank strings.`, evidence: { blank_count: blankCount } });
            await auditOk(config, blankId, blankSql, params.database, blank.elapsedMs, blank.rowCount);
          } catch (err) {
            await auditError(config, blankId, blankSql, params.database, err);
          }
        }
        if (isNumericType(col.type) && /revenue|quantity|count|price|amount|total/i.test(col.name)) {
          const negativeSql = `SELECT COUNT(*) AS negative_count, MIN(${q}) AS min_value FROM ${source.sql} WHERE ${q} < 0`;
          const negativeId = createQueryId(negativeSql);
          try {
            const negative = await runDuckDbJson(config, { sql: negativeSql, database: params.database, readonly: true, signal });
            queryIds.push(negativeId);
            const negativeCount = coerceNumber(negative.rows[0]?.negative_count, 0);
            if (negativeCount > 0) issues.push({ severity: "warning", code: "NEGATIVE_BUSINESS_VALUE", column: col.name, message: `${col.name} has negative values.`, evidence: negative.rows[0] });
            await auditOk(config, negativeId, negativeSql, params.database, negative.elapsedMs, negative.rowCount);
          } catch (err) {
            await auditError(config, negativeId, negativeSql, params.database, err);
          }
        }
        const namedAsDate = params.date_columns?.includes(col.name) || /date|time|timestamp/i.test(col.name) || isDateType(col.type);
        if (namedAsDate) {
          const dateExpr = isDateType(col.type) ? q : `TRY_CAST(${q} AS TIMESTAMP)`;
          const dateSql = `SELECT MIN(${dateExpr}) AS min_date, MAX(${dateExpr}) AS max_date, COUNT(*) FILTER (WHERE ${q} IS NOT NULL AND ${dateExpr} IS NULL) AS invalid_count, COUNT(*) FILTER (WHERE ${dateExpr} > NOW() + INTERVAL '1 year') AS future_count FROM ${source.sql}`;
          const dateId = createQueryId(dateSql);
          try {
            const dateResult = await runDuckDbJson(config, { sql: dateSql, database: params.database, readonly: true, signal });
            queryIds.push(dateId);
            const r = dateResult.rows[0] ?? {};
            if (coerceNumber(r.invalid_count, 0) > 0) issues.push({ severity: "warning", code: "INVALID_DATE_VALUES", column: col.name, message: `${col.name} has values that cannot be cast to timestamps.`, evidence: r });
            if (coerceNumber(r.future_count, 0) > 0) issues.push({ severity: "warning", code: "FUTURE_DATE_VALUES", column: col.name, message: `${col.name} has future-looking dates more than one year ahead.`, evidence: r });
            issues.push({ severity: "info", code: "DATE_RANGE", column: col.name, message: `${col.name} date range inspected.`, evidence: r });
            await auditOk(config, dateId, dateSql, params.database, dateResult.elapsedMs, dateResult.rowCount);
          } catch (err) {
            await auditError(config, dateId, dateSql, params.database, err);
          }
        }
      }

      if (issues.some((i) => i.code.includes("NULL"))) recommendations.push("Review null handling before calculating KPIs or trend metrics.");
      if (issues.some((i) => i.code.includes("DUPLICATE"))) recommendations.push("Deduplicate rows or validate key uniqueness before aggregating revenue/counts.");
      if (issues.some((i) => i.code.includes("DATE"))) recommendations.push("Validate date parsing and reporting windows before time-series analysis.");
      if (!recommendations.length) recommendations.push("No major MVP quality issues detected; still validate metric definitions before final analysis.");

      return toolResponse({ ok: true, table: source.displayName, row_count: summary.row_count, issues, recommendations, elapsed_ms: Date.now() - started, query_ids: queryIds });
    },
  }));
}

async function auditOk(config: DuckDbBiConfig, queryId: string, sql: string, database: string | undefined, elapsedMs: number, rowCount: number) {
  await appendAuditEntry(config, { query_id: queryId, tool_name: TOOL_NAMES.qualityReport, timestamp: new Date().toISOString(), sql: trimSql(sql), database, elapsed_ms: elapsedMs, row_count: rowCount, truncated: false, status: "ok" });
}

async function auditError(config: DuckDbBiConfig, queryId: string, sql: string, database: string | undefined, err: unknown) {
  await appendAuditEntry(config, { query_id: queryId, tool_name: TOOL_NAMES.qualityReport, timestamp: new Date().toISOString(), sql: trimSql(sql), database, status: "error", error_message: (err as Error).message });
}
