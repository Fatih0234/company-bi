import { writeFile } from "node:fs/promises";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { DEFAULT_MAX_OUTPUT_BYTES, DEFAULT_TIMEOUT_MS, ERROR_CODES, TOOL_NAMES } from "../constants";
import type { DuckDbBiConfig } from "../types";
import { appendAuditEntry, auditBlocked, createQueryId, trimSql } from "../lib/audit-log";
import { runDuckDbJson } from "../lib/duckdb-cli";
import { rowsToArrays } from "../lib/result-parser";
import { assertSqlAllowed } from "../lib/sql-safety";
import { clampRows, truncateRows } from "../lib/truncation";
import { ensureRuntimeDirs, resolveExportPath, safeOutputName, toProjectRelative, withProjectRoot } from "../lib/paths";
import { discoverEvidenceSources, readEvidenceSourceSql, sourceSqlToSubquery } from "../lib/evidence-sources";
import { toolError, toolResponse } from "../lib/tool-result";

const Parameters = Type.Object({
  sql: Type.String({ description: "Single DuckDB SQL query to run." }),
  database: Type.Optional(Type.String({ description: "Optional DuckDB database path inside the project." })),
  readonly: Type.Optional(Type.Boolean({ default: true })),
  max_rows: Type.Optional(Type.Number({ default: 100, minimum: 1, maximum: 1000 })),
  timeout_ms: Type.Optional(Type.Number({ default: DEFAULT_TIMEOUT_MS, minimum: 1000, maximum: 120000 })),
  save_full_result: Type.Optional(Type.Boolean({ default: false })),
  result_format: Type.Optional(StringEnum(["records", "arrays"] as const)),
});

function findTableReferences(sql: string): string[] {
  const refs = new Set<string>();
  const regex = /\b(FROM|JOIN|INTO)\s+([a-zA-Z_][a-zA-Z0-9_.]*)\b/gi;
  let match;
  while ((match = regex.exec(sql)) !== null) {
    refs.add(match[2]);
  }
  return Array.from(refs);
}

function mergeWithClause(sql: string, newCtes: string[]): string {
  if (/^\s*WITH\s+/i.test(sql)) {
    return sql.replace(/^\s*WITH\s+/i, `WITH ${newCtes.join(',\n')}, `);
  }
  return `WITH ${newCtes.join(',\n')}\n${sql}`;
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function registerRunSqlTool(pi: ExtensionAPI, baseConfig: DuckDbBiConfig) {
  pi.registerTool(defineTool({
    name: TOOL_NAMES.runSql,
    label: "DuckDB: Run SQL",
    description: "Run one bounded, readonly DuckDB SQL query and return structured rows. Blocks destructive SQL by default.",
    parameters: Parameters,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = withProjectRoot(baseConfig, ctx.cwd ?? process.cwd());
      await ensureRuntimeDirs(config);
      
      // Auto-resolve Evidence sources in the query
      let resolvedSql = params.sql;
      try {
        const evidenceSources = await discoverEvidenceSources(config);
        if (evidenceSources.length > 0) {
          const tableRefs = findTableReferences(resolvedSql);
          const sourceMap = new Map<string, string>();
          
          for (const source of evidenceSources) {
            if (tableRefs.includes(source.qualifiedName)) {
              const sourceSql = await readEvidenceSourceSql(config, source);
              sourceMap.set(source.qualifiedName, sourceSqlToSubquery(sourceSql, config));
            }
          }
          
          if (sourceMap.size > 0) {
            const ctes = [];
            for (const [name, sql] of sourceMap) {
              ctes.push(`${quoteIdentifier(name)} AS ${sql}`);
            }
            
            // Replace table references with quoted identifiers
            for (const [name, _sql] of sourceMap) {
              const regex = new RegExp(`\\b(FROM|JOIN|INTO)\\s+\\b${name.replace('.', '\\.')}\\b`, 'g');
              resolvedSql = resolvedSql.replace(regex, (match, keyword) => {
                return `${keyword} ${quoteIdentifier(name)}`;
              });
            }
            
            resolvedSql = mergeWithClause(resolvedSql, ctes);
          }
        }
      } catch (_err) {
        // If source resolution fails, fall back to original SQL
      }
      
      const queryId = createQueryId(params.sql ?? "");
      const started = Date.now();
      try {
        assertSqlAllowed(resolvedSql, { readonly: params.readonly ?? true });
      } catch (err) {
        await auditBlocked(config, {
          queryId,
          toolName: TOOL_NAMES.runSql,
          sql: params.sql,
          database: params.database,
          errorMessage: (err as Error).message,
        });
        return toolResponse({
          ok: false,
          columns: [],
          rows: [],
          row_count: 0,
          elapsed_ms: Date.now() - started,
          truncated: false,
          query_id: queryId,
          error: { code: ERROR_CODES.sqlBlocked, message: (err as Error).message },
        });
      }

      try {
        const result = await runDuckDbJson(config, {
          sql: resolvedSql,
          database: params.database,
          readonly: params.readonly ?? true,
          timeoutMs: params.timeout_ms,
          maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
          signal,
        });
        const maxRows = clampRows(params.max_rows);
        const truncatedRows = truncateRows(result.rows, maxRows);
        let resultPath: string | undefined;
        if (params.save_full_result || truncatedRows.truncated) {
          const filename = safeOutputName(undefined, queryId, "json");
          const outputPath = resolveExportPath(config, filename);
          await writeFile(outputPath, JSON.stringify(result.rows, null, 2), "utf8");
          resultPath = toProjectRelative(config, outputPath);
        }
        const rows = params.result_format === "arrays" ? rowsToArrays(truncatedRows.rows, result.columns) : truncatedRows.rows;
        await appendAuditEntry(config, {
          query_id: queryId,
          tool_name: TOOL_NAMES.runSql,
          timestamp: new Date().toISOString(),
          sql: trimSql(params.sql),
          database: params.database,
          elapsed_ms: result.elapsedMs,
          row_count: result.rowCount,
          truncated: truncatedRows.truncated,
          status: "ok",
          artifact_paths: resultPath ? [resultPath] : undefined,
        });
        return toolResponse({
          ok: true,
          columns: result.columns,
          rows,
          row_count: result.rowCount,
          elapsed_ms: result.elapsedMs,
          truncated: truncatedRows.truncated,
          truncation_reason: truncatedRows.reason,
          result_path: resultPath,
          query_id: queryId,
          warnings: result.stderr ? [result.stderr] : [],
        });
      } catch (err) {
        const code = (err as any).code ?? ERROR_CODES.duckdbError;
        await appendAuditEntry(config, {
          query_id: queryId,
          tool_name: TOOL_NAMES.runSql,
          timestamp: new Date().toISOString(),
          sql: trimSql(params.sql),
          database: params.database,
          elapsed_ms: Date.now() - started,
          row_count: 0,
          truncated: false,
          status: "error",
          error_message: (err as Error).message,
        });
        return toolResponse({
          ok: false,
          columns: [],
          rows: [],
          row_count: 0,
          elapsed_ms: Date.now() - started,
          truncated: false,
          query_id: queryId,
          error: { code, message: (err as Error).message },
        });
      }
    },
  }));
}
