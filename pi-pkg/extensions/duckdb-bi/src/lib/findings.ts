import type { ColumnProfile, Finding } from "../types";

const NAME_LIKE_RE = /(^|_| )(name|zone|label|title|description)$/i;
const PK_LIKE_RE = /(^id$|_id$|.*id$|^uuid$|^key$)/i;
const NUMERIC_PK_RE = /^(id|_id|.*_id|uuid|key)$/i;

const EDGE_CASE_SENTINELS = new Set([
  "n/a",
  "na",
  "unknown",
  "other",
  "tbd",
  "none",
  "null",
  "-",
  "",
]);

function isNumeric(type: string | undefined): boolean {
  return !!type && /INT|DECIMAL|NUMERIC|DOUBLE|FLOAT|REAL|HUGEINT/i.test(type);
}

function isText(type: string | undefined): boolean {
  return !!type && /CHAR|VARCHAR|TEXT|STRING/i.test(type);
}

function coerceNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeSentinel(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * Derive interpretation findings from a column profile set.
 * Pure function — no SQL, no I/O — so it can run cheaply inline with summarize.
 */
export function computeColumnFindings(profiles: ColumnProfile[], rowCount: number): Finding[] {
  const findings: Finding[] = [];
  if (!rowCount) return findings;

  let textCount = 0;
  let numericCount = 0;
  let dateCount = 0;
  let pkLikeColumn: ColumnProfile | undefined;

  for (const col of profiles) {
    if (isText(col.type)) textCount++;
    else if (isNumeric(col.type)) numericCount++;
    if (/DATE|TIME|TIMESTAMP/i.test(col.type)) dateCount++;
    if (PK_LIKE_RE.test(col.name)) pkLikeColumn = pkLikeColumn ?? col;
  }

  for (const col of profiles) {
    const distinct = col.distinct_count ?? 0;
    const isPkLike = PK_LIKE_RE.test(col.name);
    const isNameLike = NAME_LIKE_RE.test(col.name);
    const colIsNumeric = isNumeric(col.type);
    const colIsText = isText(col.type);

    if (distinct === 1 && rowCount > 1) {
      findings.push({
        severity: "warning",
        code: "CONSTANT_COLUMN",
        column: col.name,
        message: `${col.name} has a single value across all ${rowCount} rows.`,
        evidence: { distinct_count: distinct },
      });
    } else if (distinct > 1 && distinct <= 3 && rowCount > 50) {
      findings.push({
        severity: "info",
        code: "LOW_DIVERSITY",
        column: col.name,
        message: `${col.name} is low-diversity (${distinct} distinct values across ${rowCount} rows). May be a flag/enum dimension.`,
        evidence: { distinct_count: distinct, row_count: rowCount },
      });
    }

    if (isPkLike && distinct > 0 && distinct < rowCount) {
      findings.push({
        severity: "error",
        code: "NON_UNIQUE_PRIMARY_KEY",
        column: col.name,
        message: `${col.name} looks like a primary key but has ${distinct} distinct values across ${rowCount} rows.`,
        evidence: { distinct_count: distinct, row_count: rowCount },
      });
    }

    if (isPkLike && colIsNumeric) {
      const minNum = coerceNum(col.min, NaN);
      const maxNum = coerceNum(col.max, NaN);
      const expected = rowCount;
      if (Number.isFinite(minNum) && minNum > 1) {
        findings.push({
          severity: "info",
          code: "PK_GAPS_LOWER",
          column: col.name,
          message: `${col.name} starts at ${minNum}, not 1. Sequence has a lower gap.`,
          evidence: { min: minNum, row_count: expected },
        });
      }
      if (Number.isFinite(maxNum) && maxNum !== expected) {
        const expectedMax = expected;
        const diff = maxNum - expectedMax;
        findings.push({
          severity: diff > expected ? "warning" : "info",
          code: "PK_GAPS_UPPER",
          column: col.name,
          message: `${col.name} max is ${maxNum} but row count is ${expected}. Sequence is non-contiguous (${diff > 0 ? `+${diff}` : diff} gap).`,
          evidence: { max: maxNum, row_count: expected, gap: diff },
        });
      }
    }

    if (colIsText && !isNameLike && rowCount > 50 && distinct / rowCount > 0.9) {
      findings.push({
        severity: "info",
        code: "HIGH_CARDINALITY_CATEGORICAL",
        column: col.name,
        message: `${col.name} is high-cardinality text (${distinct}/${rowCount} ≈ ${Math.round((distinct / rowCount) * 100)}% distinct). Possibly a free-text or ID column.`,
        evidence: { distinct_count: distinct, row_count: rowCount, ratio: Number((distinct / rowCount).toFixed(3)) },
      });
    }

    if (isNameLike && colIsText && distinct > 0 && distinct < rowCount) {
      const duplicates = collectDuplicateValues(col.top_values);
      // Filter out low-cardinality flag columns: if one value dominates, the column is
      // an enum/flag, not a "display name with duplicates" situation.
      const topValueDominates = (col.top_values?.[0]?.count ?? 0) > rowCount * 0.5;
      const hasMultipleDuplicates = duplicates.length >= 2;
      if (duplicates.length && !topValueDominates && hasMultipleDuplicates) {
        findings.push({
          severity: "warning",
          code: "DUPLICATE_NAME",
          column: col.name,
          message: `${col.name} has ${rowCount - distinct} duplicate name(s) (${distinct} distinct across ${rowCount} rows). Same display name mapped to multiple IDs.`,
          evidence: { duplicate_values: duplicates, distinct_count: distinct, row_count: rowCount },
        });
      }
    }

    if (colIsText && col.top_values?.length) {
      const sentinels = collectSentinelValues(col.top_values);
      if (sentinels.length) {
        findings.push({
          severity: "warning",
          code: "EDGE_CASE_SENTINEL",
          column: col.name,
          message: `${col.name} contains ${sentinels.length} edge-case sentinel value(s): ${sentinels.map((s) => JSON.stringify(s.value)).join(", ")}. These will silently break aggregations like COUNT/GROUP BY.`,
          evidence: { sentinels },
        });
      }
    }
  }

  // Table-level heuristics (intentionally fuzzy — surface as info, not assertion).
  if (rowCount < 10_000 && textCount >= 2 && numericCount <= 1 && pkLikeColumn) {
    findings.push({
      severity: "info",
      code: "POSSIBLE_DIMENSION",
      message: `Heuristic: this looks like a lookup/dimension table (${rowCount} rows, mostly text, one PK-like column: ${pkLikeColumn.name}). Consider running duckdb_join_coverage against related fact tables.`,
      evidence: { row_count: rowCount, text_count: textCount, numeric_count: numericCount, pk_like_column: pkLikeColumn.name },
    });
  }

  if (rowCount > 1_000 && numericCount >= 3 && profiles.some((p) => /location_id$|_id$|^id$|uuid/i.test(p.name))) {
    findings.push({
      severity: "info",
      code: "POSSIBLE_FACT",
      message: `Heuristic: this looks like a fact/event table (${rowCount} rows, multiple numeric measures, FK-like columns). Consider identifying dimension candidates and checking join coverage.`,
      evidence: { row_count: rowCount, numeric_count: numericCount },
    });
  }

  return findings;
}

function collectDuplicateValues(topValues: ColumnProfile["top_values"]): Array<{ value: unknown; count: number }> {
  if (!topValues) return [];
  return topValues
    .filter((tv) => (tv.count ?? 0) > 1)
    .map((tv) => ({ value: tv.value, count: tv.count ?? 0 }));
}

function collectSentinelValues(topValues: ColumnProfile["top_values"]): Array<{ value: unknown; count: number }> {
  if (!topValues) return [];
  const seen = new Set<string>();
  const out: Array<{ value: unknown; count: number }> = [];
  for (const tv of topValues) {
    const norm = normalizeSentinel(tv.value);
    if (EDGE_CASE_SENTINELS.has(norm) && !seen.has(norm)) {
      seen.add(norm);
      out.push({ value: tv.value, count: tv.count ?? 0 });
    }
  }
  return out;
}

/** Lightweight type-compatibility check between dim key and fact FK types. */
export function areTypesCompatible(dimKeyType: string | undefined, fkType: string | undefined): boolean {
  if (!dimKeyType || !fkType) return true; // unknown — be permissive
  const a = dimKeyType.toUpperCase();
  const b = fkType.toUpperCase();
  const numeric = (t: string) => /INT|DECIMAL|NUMERIC|DOUBLE|FLOAT|REAL|HUGEINT/.test(t);
  const text = (t: string) => /CHAR|VARCHAR|TEXT|STRING/.test(t);
  const date = (t: string) => /DATE|TIME|TIMESTAMP/.test(t);
  if (numeric(a) && numeric(b)) return true;
  if (text(a) && text(b)) return true;
  if (date(a) && date(b)) return true;
  return false;
}
