import { ERROR_CODES } from "../constants";

export function parseJsonRows(stdout: string): Array<Record<string, unknown>> {
  const text = stdout.trim();
  if (!text) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw Object.assign(new Error(`Failed to parse DuckDB JSON output: ${(err as Error).message}`), {
      code: ERROR_CODES.outputParseError,
    });
  }
  if (!Array.isArray(parsed)) {
    throw Object.assign(new Error("DuckDB JSON output was not an array"), { code: ERROR_CODES.outputParseError });
  }
  return parsed.map((row) => {
    if (row && typeof row === "object" && !Array.isArray(row)) return row as Record<string, unknown>;
    return { value: row };
  });
}

export function columnsFromRows(rows: Array<Record<string, unknown>>): Array<{ name: string; type?: string }> {
  const seen = new Set<string>();
  const columns: Array<{ name: string; type?: string }> = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push({ name: key });
      }
    }
  }
  return columns;
}

export function rowsToArrays(rows: Array<Record<string, unknown>>, columns: Array<{ name: string }>): unknown[][] {
  return rows.map((row) => columns.map((col) => row[col.name]));
}

export function coerceNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function isNumericType(type: string | undefined): boolean {
  return !!type && /INT|DECIMAL|NUMERIC|DOUBLE|FLOAT|REAL|HUGEINT|BIGINT|SMALLINT|TINYINT|UBIGINT|UINTEGER|USMALLINT|UTINYINT/i.test(type);
}

export function isDateType(type: string | undefined): boolean {
  return !!type && /DATE|TIME|TIMESTAMP/i.test(type);
}

export function isTextType(type: string | undefined): boolean {
  return !!type && /CHAR|VARCHAR|TEXT|STRING/i.test(type);
}
