/**
 * Workspace data registry reader for Pi tools.
 *
 * Reads and normalizes `.cmux/data-registry.json` so that DuckDB BI tools
 * and evidence-context can present registered workspace tables as first-class
 * dashboard sources.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { DuckDbBiConfig } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkspaceDataTableStatus = "ready" | "missing" | "error" | "stale";

export interface WorkspaceDataTableColumn {
  name: string;
  type?: string;
  semanticRole?: string;
}

export interface WorkspaceDataTable {
  alias: string;
  qualifiedName: string;
  path: string;
  format: string;
  status: WorkspaceDataTableStatus;
  sizeBytes?: number;
  fingerprint?: string;
  columns?: WorkspaceDataTableColumn[];
  rowCount?: number;
  warnings?: string[];
}

export interface WorkspaceDataRegistry {
  version: number;
  sourceName: string;
  workspaceRoot?: string;
  updatedAt?: string;
  tables: WorkspaceDataTable[];
  warnings?: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_REGISTRY_BYTES = 512_000; // 500 KB safety limit

function safeReadJson(filePath: string): unknown | undefined {
  try {
    if (!existsSync(filePath)) return undefined;
    const stat = statSync(filePath);
    if (!stat.isFile() || stat.size > MAX_REGISTRY_BYTES) return undefined;
    const text = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function registryPath(config: DuckDbBiConfig): string {
  return path.join(config.projectRoot, ".cmux", "data-registry.json");
}

function profilePath(config: DuckDbBiConfig): string {
  return path.join(config.projectRoot, ".cmux", "data-profile.json");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load the workspace data registry from `.cmux/data-registry.json`.
 * Returns undefined if the file doesn't exist or is invalid.
 */
export function loadWorkspaceDataRegistry(config: DuckDbBiConfig): WorkspaceDataRegistry | undefined {
  const raw = safeReadJson(registryPath(config));
  if (!raw || typeof raw !== "object") return undefined;

  const data = raw as Record<string, unknown>;

  // Validate minimal shape
  if (typeof data.version !== "number") return undefined;
  if (!Array.isArray(data.tables)) return undefined;

  const tables: WorkspaceDataTable[] = [];
  for (const rawTable of data.tables) {
    if (!rawTable || typeof rawTable !== "object" || Array.isArray(rawTable)) continue;
    const t = rawTable as Record<string, unknown>;
    if (typeof t.alias !== "string" || typeof t.path !== "string") continue;

    tables.push({
      alias: t.alias,
      qualifiedName: typeof t.qualifiedName === "string" ? t.qualifiedName : `files.${t.alias}`,
      path: t.path,
      format: typeof t.format === "string" ? t.format : "unknown",
      status: isValidStatus(t.status) ? t.status as WorkspaceDataTableStatus : "ready",
      sizeBytes: typeof t.sizeBytes === "number" ? t.sizeBytes : undefined,
      fingerprint: typeof t.fingerprint === "string" ? t.fingerprint : undefined,
      columns: Array.isArray(t.columns) ? normalizeColumns(t.columns) : undefined,
      rowCount: typeof t.rowCount === "number" ? t.rowCount : undefined,
      warnings: Array.isArray(t.warnings) ? t.warnings.filter((w): w is string => typeof w === "string") : undefined,
    });
  }

  return {
    version: data.version as number,
    sourceName: typeof data.sourceName === "string" ? data.sourceName : "files",
    workspaceRoot: typeof data.workspaceRoot === "string" ? data.workspaceRoot : undefined,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
    tables,
    warnings: Array.isArray(data.warnings) ? data.warnings.filter((w): w is string => typeof w === "string") : undefined,
  };
}

/**
 * Get registered workspace tables formatted for Pi tool context.
 * Returns tables sorted: ready first, then missing/error/stale.
 */
export function registeredTablesForContext(config: DuckDbBiConfig): WorkspaceDataTable[] {
  const registry = loadWorkspaceDataRegistry(config);
  if (!registry) return [];

  const statusOrder: Record<WorkspaceDataTableStatus, number> = {
    ready: 0,
    stale: 1,
    error: 2,
    missing: 3,
  };

  return registry.tables.sort((a, b) => {
    const sa = statusOrder[a.status] ?? 99;
    const sb = statusOrder[b.status] ?? 99;
    if (sa !== sb) return sa - sb;
    return a.alias.localeCompare(b.alias);
  });
}

/**
 * Get warnings from registry and profile files.
 */
export function registryWarnings(config: DuckDbBiConfig): string[] {
  const warnings: string[] = [];
  const registry = loadWorkspaceDataRegistry(config);
  if (registry?.warnings) warnings.push(...registry.warnings);
  for (const table of registry?.tables ?? []) {
    if (table.warnings) warnings.push(...table.warnings);
  }
  return warnings;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isValidStatus(value: unknown): boolean {
  return value === "ready" || value === "missing" || value === "error" || value === "stale";
}

function normalizeColumns(rawColumns: unknown[]): WorkspaceDataTableColumn[] {
  const result: WorkspaceDataTableColumn[] = [];
  for (const raw of rawColumns) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const col = raw as Record<string, unknown>;
    if (typeof col.name !== "string") continue;
    result.push({
      name: col.name,
      type: typeof col.type === "string" ? col.type : undefined,
      semanticRole: typeof col.semanticRole === "string" ? col.semanticRole : undefined,
    });
  }
  return result;
}
