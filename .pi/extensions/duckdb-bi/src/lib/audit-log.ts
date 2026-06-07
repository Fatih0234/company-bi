import { appendFile, readFile } from "node:fs/promises";
import crypto from "node:crypto";
import type { AuditEntry, DuckDbBiConfig } from "../types";
import { ensureRuntimeDirs } from "./paths";

export function createQueryId(sql: string): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const hash = crypto.createHash("sha256").update(sql).update(String(Math.random())).digest("hex").slice(0, 8);
  return `q_${stamp}_${hash}`;
}

export async function appendAuditEntry(config: DuckDbBiConfig, entry: AuditEntry): Promise<void> {
  await ensureRuntimeDirs(config);
  await appendFile(config.auditLogPath, `${JSON.stringify(entry)}\n`, "utf8");
}

export async function auditBlocked(
  config: DuckDbBiConfig,
  input: { queryId?: string; toolName: string; sql: string; database?: string; errorMessage: string; artifactPaths?: string[] },
): Promise<string> {
  const queryId = input.queryId ?? createQueryId(input.sql);
  await appendAuditEntry(config, {
    query_id: queryId,
    tool_name: input.toolName,
    timestamp: new Date().toISOString(),
    sql: trimSql(input.sql),
    database: input.database,
    status: "blocked",
    error_message: input.errorMessage,
    artifact_paths: input.artifactPaths,
  });
  return queryId;
}

export function trimSql(sql: string): string {
  const compact = sql.replace(/\s+/g, " ").trim();
  return compact.length > 5000 ? `${compact.slice(0, 5000)}…` : compact;
}

export async function readAuditEntries(
  config: DuckDbBiConfig,
  filters: { limit?: number; status?: string; tool_name?: string; since?: string } = {},
): Promise<AuditEntry[]> {
  let text = "";
  try {
    text = await readFile(config.auditLogPath, "utf8");
  } catch {
    return [];
  }
  const sinceTs = filters.since ? Date.parse(filters.since) : undefined;
  const entries = text
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as AuditEntry;
      } catch {
        return undefined;
      }
    })
    .filter((entry): entry is AuditEntry => !!entry)
    .filter((entry) => (!filters.status || entry.status === filters.status))
    .filter((entry) => (!filters.tool_name || entry.tool_name === filters.tool_name))
    .filter((entry) => (!sinceTs || Date.parse(entry.timestamp) >= sinceTs));

  const limit = Math.max(1, Math.min(Number(filters.limit ?? 50), 500));
  return entries.slice(-limit).reverse();
}
