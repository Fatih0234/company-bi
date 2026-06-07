import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { DEFAULT_TIMEOUT_MS, ERROR_CODES, TOOL_NAMES } from "../constants";
import type { DuckDbBiConfig, Finding, JoinCandidateMatch, JoinCoverageResult, TableSource } from "../types";
import { appendAuditEntry, createQueryId, trimSql } from "../lib/audit-log";
import { runDuckDbJson } from "../lib/duckdb-cli";
import { areTypesCompatible } from "../lib/findings";
import { coerceNumber } from "../lib/result-parser";
import { quoteIdentifier, resolveTableSource, tableSourceForFile } from "../lib/sql-safety";
import { discoverDataFiles, ensureRuntimeDirs, withProjectRoot } from "../lib/paths";
import { toolError, toolResponse } from "../lib/tool-result";

const CandidateSchema = Type.Object({
  table: Type.String({ description: "Fact table name, alias, or file path." }),
  fk_column: Type.String({ description: "FK column in the fact table to join on." }),
  name: Type.Optional(Type.String({ description: "Optional human-readable label for this join." })),
});

const Parameters = Type.Object({
  dimension_table: Type.String({ description: "Dimension/lookup table name, alias, or file path." }),
  key_column: Type.String({ description: "Column in the dimension table to join on." }),
  database: Type.Optional(Type.String()),
  candidates: Type.Optional(Type.Array(CandidateSchema)),
  auto_discover: Type.Optional(Type.Boolean({
    default: false,
    description: "If true and `candidates` is empty, scan sibling data files for FK columns matching `key_column` by name (exact, pu_/do_ prefix, pickup_/dropoff_ prefix, or _key suffix).",
  })),
  timeout_ms: Type.Optional(Type.Number({ default: DEFAULT_TIMEOUT_MS, minimum: 1000, maximum: 120000 })),
});

interface InternalCandidate {
  table: string;
  fkColumn: string;
  name: string;
  matchRule: string;
}

export function registerJoinCoverageTool(pi: ExtensionAPI, baseConfig: DuckDbBiConfig) {
  pi.registerTool(defineTool({
    name: TOOL_NAMES.joinCoverage,
    label: "DuckDB: Join Coverage",
    description: "Check join coverage between a dimension/lookup table and one or more fact tables, in both directions. Reports orphans (fact rows with no match), unused dimension rows, type compatibility, and a `findings` array. Supports explicit `candidates` or `auto_discover: true` to find candidate FK columns in sibling data files by name pattern.",
    promptSnippet: "Check join coverage between a dim table and fact tables: orphans, unused dim rows, type compatibility, auto-discover candidates.",
    promptGuidelines: [
      "Use duckdb_join_coverage right after duckdb_summarize_table on a dimension or lookup table, especially when the `findings` array includes `POSSIBLE_DIMENSION` or `POSSIBLE_FACT`.",
      "duckdb_join_coverage checks join coverage and type compatibility but does not diagnose the root cause of low coverage. If `orphans` or `unused` is high, run duckdb_run_sql with a SELECT on the orphan key values to spot type mismatch, NULL FKs, or stale IDs.",
      "Use `auto_discover: true` to find candidate fact tables and FK columns by name (LocationID ↔ PULocationID / DOLocationID, etc.). Override with explicit `candidates` for non-standard schemas.",
    ],
    parameters: Parameters,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const config = withProjectRoot(baseConfig, ctx.cwd ?? process.cwd());
      await ensureRuntimeDirs(config);
      const started = Date.now();
      const queryIds: string[] = [];

      let dimSource: TableSource;
      let dimRowCount: number;
      let dimKeyType: string | undefined;
      try {
        dimSource = await resolveTableSource(config, params.dimension_table);
      } catch (err) {
        return toolError({ code: ERROR_CODES.invalidInput, message: (err as Error).message, elapsed_ms: Date.now() - started });
      }
      try {
        ({ rowCount: dimRowCount, keyType: dimKeyType } = await fetchDimInfo(config, dimSource, params.key_column, params.database, signal, queryIds));
      } catch (err) {
        return toolError({ code: ERROR_CODES.duckdbError, message: `Failed to inspect dimension table: ${(err as Error).message}`, elapsed_ms: Date.now() - started });
      }

      let candidates: InternalCandidate[];
      try {
        candidates = await buildCandidates(config, dimSource, params, signal, queryIds);
      } catch (err) {
        return toolError({ code: ERROR_CODES.duckdbError, message: `Failed to discover candidates: ${(err as Error).message}`, elapsed_ms: Date.now() - started });
      }

      if (!candidates.length) {
        return toolResponse({
          ok: true,
          dimension: { table: dimSource.displayName, key_column: params.key_column, row_count: dimRowCount, key_type: dimKeyType },
          candidates_considered: [],
          joins: [],
          findings: [{
            severity: "info",
            code: "NO_CANDIDATES",
            message: "No fact-table candidates to check. Provide `candidates` explicitly or set `auto_discover: true`.",
          }] satisfies Finding[],
          query_ids: queryIds,
          elapsed_ms: Date.now() - started,
        });
      }

      const joins: JoinCoverageResult[] = [];
      const findings: Finding[] = [];

      for (const candidate of candidates) {
        try {
          const factSource = await resolveTableSource(config, candidate.table);
          const { fkType, factRowCount } = await fetchFactInfo(config, factSource, candidate.fkColumn, params.database, signal, queryIds);
          const compatible = areTypesCompatible(dimKeyType, fkType);
          const coverage = await runCoverageQueries(config, dimSource, factSource, params.key_column, candidate.fkColumn, params.database, signal, queryIds);
          const result: JoinCoverageResult = {
            name: candidate.name,
            fact_table: factSource.displayName,
            fk_column: candidate.fkColumn,
            match_rule: candidate.matchRule,
            fact_row_count: factRowCount,
            matched: coverage.matched,
            null_fk: coverage.nullFk,
            orphans: coverage.orphans,
            orphan_pct: pct(coverage.orphans, factRowCount),
            coverage_pct: pct(coverage.matched, factRowCount),
            dim_row_count: dimRowCount,
            used: coverage.used,
            unused: coverage.unused,
            unused_pct: pct(coverage.unused, dimRowCount),
            fk_type: fkType,
            key_type: dimKeyType,
            type_compatible: compatible,
          };
          joins.push(result);
          addCoverageFindings(findings, result);
        } catch (err) {
          findings.push({
            severity: "warning",
            code: "CANDIDATE_SKIPPED",
            message: `Skipped ${candidate.table}.${candidate.fkColumn}: ${(err as Error).message}`,
            evidence: { candidate },
          });
        }
      }

      // Sort by coverage descending so the most-relevant join surfaces first.
      joins.sort((a, b) => b.coverage_pct - a.coverage_pct);

      return toolResponse({
        ok: true,
        dimension: { table: dimSource.displayName, key_column: params.key_column, row_count: dimRowCount, key_type: dimKeyType },
        candidates_considered: candidates.map((c) => ({ table: c.table, fk_column: c.fkColumn, match_rule: c.matchRule })),
        joins,
        findings,
        query_ids: queryIds,
        elapsed_ms: Date.now() - started,
      });
    },
  }));
}

interface DimInfo {
  rowCount: number;
  keyType?: string;
}

interface FactInfo {
  factRowCount: number;
  fkType?: string;
}

interface CoverageStats {
  matched: number;
  nullFk: number;
  orphans: number;
  used: number;
  unused: number;
}

async function fetchDimInfo(
  config: DuckDbBiConfig,
  source: TableSource,
  keyColumn: string,
  database: string | undefined,
  signal: AbortSignal | undefined,
  queryIds: string[],
): Promise<DimInfo> {
  const quoted = quoteIdentifier(keyColumn);
  const rowCountSql = `SELECT COUNT(*) AS row_count FROM ${source.sql}`;
  const rowCountId = createQueryId(rowCountSql);
  const rowCountResult = await runDuckDbJson(config, { sql: rowCountSql, database, readonly: true, signal });
  queryIds.push(rowCountId);
  await auditOk(config, rowCountId, rowCountSql, database, rowCountResult.elapsedMs, rowCountResult.rowCount);

  const describeSql = `DESCRIBE SELECT ${quoted} AS col FROM ${source.sql}`;
  const describeId = createQueryId(describeSql);
  const describe = await runDuckDbJson(config, { sql: describeSql, database, readonly: true, signal });
  queryIds.push(describeId);
  await auditOk(config, describeId, describeSql, database, describe.elapsedMs, describe.rowCount);
  const keyType = String(describe.rows[0]?.column_type ?? "").trim() || undefined;
  return { rowCount: coerceNumber(rowCountResult.rows[0]?.row_count, 0), keyType };
}

async function fetchFactInfo(
  config: DuckDbBiConfig,
  source: TableSource,
  fkColumn: string,
  database: string | undefined,
  signal: AbortSignal | undefined,
  queryIds: string[],
): Promise<FactInfo> {
  const quoted = quoteIdentifier(fkColumn);
  const rowCountSql = `SELECT COUNT(*) AS row_count FROM ${source.sql}`;
  const rowCountId = createQueryId(rowCountSql);
  const rowCountResult = await runDuckDbJson(config, { sql: rowCountSql, database, readonly: true, signal });
  queryIds.push(rowCountId);
  await auditOk(config, rowCountId, rowCountSql, database, rowCountResult.elapsedMs, rowCountResult.rowCount);

  const describeSql = `DESCRIBE SELECT ${quoted} AS col FROM ${source.sql}`;
  const describeId = createQueryId(describeSql);
  const describe = await runDuckDbJson(config, { sql: describeSql, database, readonly: true, signal });
  queryIds.push(describeId);
  await auditOk(config, describeId, describeSql, database, describe.elapsedMs, describe.rowCount);
  const fkType = String(describe.rows[0]?.column_type ?? "").trim() || undefined;
  return { factRowCount: coerceNumber(rowCountResult.rows[0]?.row_count, 0), fkType };
}

async function buildCandidates(
  config: DuckDbBiConfig,
  dimSource: TableSource,
  params: any,
  signal: AbortSignal | undefined,
  queryIds: string[],
): Promise<InternalCandidate[]> {
  if (Array.isArray(params.candidates) && params.candidates.length) {
    return params.candidates.map((c: any) => ({
      table: String(c.table),
      fkColumn: String(c.fk_column),
      name: c.name ? String(c.name) : `${c.table}.${c.fk_column}`,
      matchRule: "explicit",
    }));
  }
  if (!params.auto_discover) return [];

  const all = await discoverDataFiles(config);
  const dimRel = dimSource.sourcePath?.replace(/\\/g, "/");
  const keyLower = String(params.key_column).toLowerCase();
  const out: InternalCandidate[] = [];
  const considered: JoinCandidateMatch[] = [];

  for (const file of all) {
    if (file.type === "duckdb") continue;
    const fileRel = file.path.replace(/\\/g, "/");
    if (dimRel && fileRel === dimRel) continue;
    // For CSV/Parquet etc, a quick existence check that the file is readable.
    let source: TableSource;
    try {
      source = await tableSourceForFile(config, file.path);
    } catch {
      continue;
    }
    const describeSql = `DESCRIBE SELECT * FROM ${source.sql}`;
    const describeId = createQueryId(describeSql);
    let columns: string[] = [];
    try {
      const result = await runDuckDbJson(config, { sql: describeSql, readonly: true, signal });
      queryIds.push(describeId);
      columns = result.rows.map((row) => String(row.column_name ?? row.name ?? "")).filter(Boolean);
      await auditOk(config, describeId, describeSql, undefined, result.elapsedMs, result.rowCount);
    } catch (err) {
      await auditError(config, describeId, describeSql, undefined, err);
      continue;
    }

    for (const col of columns) {
      const rule = matchRule(col, keyLower);
      if (rule) {
        out.push({ table: file.alias, fkColumn: col, name: `${file.alias}.${col}`, matchRule: rule });
        considered.push({ fact_table: file.alias, fk_column: col, match_rule: rule });
      }
    }
  }

  // De-duplicate (a file may have multiple matches; we keep all).
  return out;
}

function matchRule(column: string, keyLower: string): string | null {
  const colLower = column.toLowerCase();
  if (colLower === keyLower) return "exact";
  if (colLower === `pu${keyLower}`) return "pu_prefix";
  if (colLower === `do${keyLower}`) return "do_prefix";
  if (colLower === `pickup_${keyLower}`) return "pickup_prefix";
  if (colLower === `dropoff_${keyLower}`) return "dropoff_prefix";
  if (colLower === `origin_${keyLower}`) return "origin_prefix";
  if (colLower === `destination_${keyLower}`) return "destination_prefix";
  if (colLower === `source_${keyLower}`) return "source_prefix";
  if (colLower === `target_${keyLower}`) return "target_prefix";
  if (colLower === `from_${keyLower}`) return "from_prefix";
  if (colLower === `to_${keyLower}`) return "to_prefix";
  if (colLower.endsWith(`_${keyLower}`)) return "suffix";
  return null;
}

async function runCoverageQueries(
  config: DuckDbBiConfig,
  dimSource: TableSource,
  factSource: TableSource,
  keyColumn: string,
  fkColumn: string,
  database: string | undefined,
  signal: AbortSignal | undefined,
  queryIds: string[],
): Promise<CoverageStats> {
  const keyQ = quoteIdentifier(keyColumn);
  const fkQ = quoteIdentifier(fkColumn);

  const forwardSql = `SELECT COUNT(*) AS total, COUNT(d.${keyQ}) AS matched, SUM(CASE WHEN f.${fkQ} IS NULL THEN 1 ELSE 0 END) AS null_fk FROM ${factSource.sql} f LEFT JOIN ${dimSource.sql} d ON f.${fkQ} = d.${keyQ}`;
  const forwardId = createQueryId(forwardSql);
  const forward = await runDuckDbJson(config, { sql: forwardSql, database, readonly: true, signal });
  queryIds.push(forwardId);
  await auditOk(config, forwardId, forwardSql, database, forward.elapsedMs, forward.rowCount);
  const f = forward.rows[0] ?? {};
  const total = coerceNumber(f.total, 0);
  const matched = coerceNumber(f.matched, 0);
  const nullFk = coerceNumber(f.null_fk, 0);
  const orphans = total - matched - nullFk;

  // Reverse coverage via a DISTINCT CTE: efficient because the FK cardinality is small.
  const reverseSql = `WITH used_keys AS (SELECT DISTINCT ${fkQ} AS k FROM ${factSource.sql} WHERE ${fkQ} IS NOT NULL) SELECT COUNT(*) AS dim_rows, COUNT(*) FILTER (WHERE u.k IS NOT NULL) AS used, COUNT(*) FILTER (WHERE u.k IS NULL) AS unused FROM ${dimSource.sql} d LEFT JOIN used_keys u ON d.${keyQ} = u.k`;
  const reverseId = createQueryId(reverseSql);
  const reverse = await runDuckDbJson(config, { sql: reverseSql, database, readonly: true, signal });
  queryIds.push(reverseId);
  await auditOk(config, reverseId, reverseSql, database, reverse.elapsedMs, reverse.rowCount);
  const r = reverse.rows[0] ?? {};
  const used = coerceNumber(r.used, 0);
  const unused = coerceNumber(r.unused, 0);

  return { matched, nullFk, orphans, used, unused };
}

function addCoverageFindings(findings: Finding[], result: JoinCoverageResult): void {
  const { name, fact_table: factTable, fk_column: fkColumn, coverage_pct: coveragePct, orphan_pct: orphanPct, unused, unused_pct: unusedPct, fact_row_count: factRowCount, type_compatible: compatible, key_type: keyType, fk_type: fkType } = result;

  if (!compatible) {
    findings.push({
      severity: "warning",
      code: "TYPE_MISMATCH",
      message: `${name}: dim key type ${keyType ?? "?"} and FK type ${fkType ?? "?"} are not join-compatible without casting. Coverage % may be misleading.`,
      evidence: { key_type: keyType, fk_type: fkType },
    });
  }

  if (factRowCount === 0) {
    findings.push({
      severity: "info",
      code: "EMPTY_FACT",
      message: `${name}: fact table has 0 rows — no coverage to check.`,
      evidence: { fact_table: factTable, fk_column: fkColumn },
    });
    return;
  }

  if (coveragePct >= 99.9) {
    findings.push({
      severity: "info",
      code: "FULL_COVERAGE",
      message: `${name}: ${coveragePct.toFixed(2)}% of ${factTable}.${fkColumn} rows match a ${result.key_type ? "key in" : "row in"} the dimension table.`,
      evidence: { coverage_pct: coveragePct, orphans: result.orphans, null_fk: result.null_fk },
    });
  } else if (coveragePct >= 95) {
    findings.push({
      severity: "info",
      code: "PARTIAL_COVERAGE",
      message: `${name}: ${coveragePct.toFixed(2)}% coverage — ${result.orphans} orphan FK value(s) in ${factTable}.${fkColumn} (${orphanPct.toFixed(2)}% of fact rows).`,
      evidence: { coverage_pct: coveragePct, orphans: result.orphans, null_fk: result.null_fk },
    });
  } else {
    findings.push({
      severity: "warning",
      code: "LOW_COVERAGE",
      message: `${name}: only ${coveragePct.toFixed(2)}% coverage — ${result.orphans} orphan FK value(s) in ${factTable}.${fkColumn} (${orphanPct.toFixed(2)}% of fact rows). Investigate root cause with duckdb_run_sql.`,
      evidence: { coverage_pct: coveragePct, orphans: result.orphans, null_fk: result.null_fk },
    });
  }

  if (result.null_fk > 0) {
    findings.push({
      severity: "info",
      code: "NULL_FK_VALUES",
      message: `${name}: ${result.null_fk} fact row(s) have NULL ${fkColumn} (excluded from coverage %).`,
      evidence: { null_fk: result.null_fk },
    });
  }

  if (unused > 0 && (unusedPct > 2 || unused >= 3)) {
    findings.push({
      severity: "info",
      code: "UNUSED_DIMENSION_ROWS",
      message: `${name}: ${unused} of ${result.dim_row_count} dimension row(s) (${unusedPct.toFixed(2)}%) are not referenced by any ${fkColumn} value.`,
      evidence: { unused, dim_row_count: result.dim_row_count },
    });
  }
}

function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

async function auditOk(config: DuckDbBiConfig, queryId: string, sql: string, database: string | undefined, elapsedMs: number, rowCount: number) {
  await appendAuditEntry(config, {
    query_id: queryId,
    tool_name: TOOL_NAMES.joinCoverage,
    timestamp: new Date().toISOString(),
    sql: trimSql(sql),
    database,
    elapsed_ms: elapsedMs,
    row_count: rowCount,
    truncated: false,
    status: "ok",
  });
}

async function auditError(config: DuckDbBiConfig, queryId: string, sql: string, database: string | undefined, err: unknown) {
  await appendAuditEntry(config, {
    query_id: queryId,
    tool_name: TOOL_NAMES.joinCoverage,
    timestamp: new Date().toISOString(),
    sql: trimSql(sql),
    database,
    status: "error",
    error_message: (err as Error).message,
  });
}
