import { DEFAULT_MAX_ROWS, HARD_MAX_ROWS } from "../constants";

export function clampRows(maxRows: unknown): number {
  const requested = Number(maxRows ?? DEFAULT_MAX_ROWS);
  if (!Number.isFinite(requested) || requested <= 0) return DEFAULT_MAX_ROWS;
  return Math.min(Math.floor(requested), HARD_MAX_ROWS);
}

export function truncateRows<T>(rows: T[], maxRows: number): { rows: T[]; truncated: boolean; totalRows: number; reason?: string } {
  if (rows.length > maxRows) {
    return { rows: rows.slice(0, maxRows), truncated: true, totalRows: rows.length, reason: "row_limit" };
  }
  return { rows, truncated: false, totalRows: rows.length };
}

export function truncateText(text: string, maxBytes: number): { text: string; truncated: boolean; totalBytes: number } {
  const totalBytes = Buffer.byteLength(text, "utf8");
  if (totalBytes <= maxBytes) return { text, truncated: false, totalBytes };
  const buffer = Buffer.from(text, "utf8").subarray(0, maxBytes);
  return {
    text: `${buffer.toString("utf8")}\n[truncated at ${maxBytes} bytes from ${totalBytes} bytes]`,
    truncated: true,
    totalBytes,
  };
}
