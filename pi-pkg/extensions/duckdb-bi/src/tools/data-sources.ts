import { readdir } from "node:fs/promises";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { TOOL_NAMES } from "../constants";
import type { DuckDbBiConfig } from "../types";
import { discoverDataFiles, ensureRuntimeDirs, toProjectRelative, withProjectRoot } from "../lib/paths";
import { discoverEvidenceSources, evidenceSourceToPublic } from "../lib/evidence-sources";
import { loadWorkspaceDataRegistry, type WorkspaceDataTable } from "../lib/workspace-data-registry";
import { toolResponse } from "../lib/tool-result";

const Parameters = Type.Object({
  include_files: Type.Optional(Type.Boolean({ default: true })),
  include_runtime_dirs: Type.Optional(Type.Boolean({ default: true })),
  include_evidence_sources: Type.Optional(Type.Boolean({ default: true })),
  include_semantics: Type.Optional(Type.Boolean({ default: true })),
  include_profile_status: Type.Optional(Type.Boolean({ default: true })),
  mode: Type.Optional(Type.String({ default: "business", description: "Discovery mode: 'business' (default; data/ + Evidence sources) or 'all' (scan project, excluding only generic build/dependency dirs)." })),
});

export function registerDataSourcesTool(pi: ExtensionAPI, baseConfig: DuckDbBiConfig) {
  pi.registerTool(defineTool({
    name: TOOL_NAMES.dataSources,
    label: "DuckDB: Data Sources",
    description: "Show likely project-local CSV, Parquet, JSON, and DuckDB data sources plus DuckDB BI runtime directories.",
    parameters: Parameters,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const config = withProjectRoot(baseConfig, ctx.cwd ?? process.cwd());
      await ensureRuntimeDirs(config);
      const mode = params.mode === "all" ? "all" : "business";
      const files = params.include_files === false ? [] : await discoverDataFiles(config, { mode });
      const evidenceSources = params.include_evidence_sources === false ? [] : await discoverEvidenceSources(config);
      const exports = await safeList(config.exportsDir, config);
      const reports = await safeList(config.reportsDir, config);

      // Load registered workspace tables from data registry
      const registry = loadWorkspaceDataRegistry(config);
      const registeredTables = (registry?.tables ?? []).map((t: WorkspaceDataTable) => {
        const columns = t.columns ?? [];
        const profileStatus = profileStatusFor(t);
        return {
          name: t.qualifiedName,
          alias: t.alias,
          path: t.path,
          format: t.format,
          status: t.status,
          sizeBytes: t.sizeBytes,
          rowCount: t.rowCount,
          columns: columns.map((c) => c.name),
          column_details: columns.map((c) => ({
            name: c.name,
            type: c.type,
            semantic_role: c.semanticRole ?? inferColumnRole(c.name, c.type),
          })),
          likely_role: params.include_semantics === false ? undefined : inferTableRole(t),
          semantic_hints: params.include_semantics === false ? undefined : semanticHintsFor(t),
          profile_status: params.include_profile_status === false ? undefined : profileStatus,
          recommended_for_dashboard: t.status === "ready",
          next_actions: nextActionsForRegisteredTable(t, profileStatus),
        };
      });

      // Filter out files that are already registered to avoid duplication
      const registeredPaths = new Set((registry?.tables ?? []).map((t) => t.path));
      const unregisteredFiles = files
        .filter((file) => file.type !== "duckdb" && !registeredPaths.has(file.path))
        .map(({ path, type, size_bytes, alias, root }) => ({
          path,
          type,
          size_bytes,
          alias,
          root,
          source_type: "file",
          recommended_for_dashboard: false,
          registration_hint: "Run cmux-evidence data refresh to register this file.",
        }));

      return toolResponse({
        ok: true,
        summary: {
          registered_table_count: registeredTables.length,
          ready_registered_table_count: registeredTables.filter((t) => t.status === "ready").length,
          evidence_source_count: evidenceSources.length,
          unregistered_file_count: unregisteredFiles.length,
          database_count: files.filter((file) => file.type === "duckdb").length,
          preferred_dashboard_sources: registeredTables.filter((t) => t.recommended_for_dashboard).map((t) => t.name),
          next_action: nextOverallAction(registeredTables, unregisteredFiles, evidenceSources.length),
        },
        cwd: config.projectRoot,
        discovery_mode: mode,
        artifact_policy: ".pi/duckdb/** is local scratch/provenance and is ignored by Git; Evidence pages/queries remain the dashboard deliverables.",
        runtime_dir: toProjectRelative(config, config.runtimeDir),
        registry: registry ? {
          source_name: registry.sourceName,
          updated_at: registry.updatedAt,
          warnings: registry.warnings ?? [],
        } : undefined,
        registered_tables: registeredTables,
        evidence_sources: evidenceSources.map(evidenceSourceToPublic),
        databases: files.filter((file) => file.type === "duckdb").map((file) => ({ name: file.alias, path: file.path, readonly: true })),
        files: unregisteredFiles,
        exports,
        reports,
        audit_log_path: toProjectRelative(config, config.auditLogPath),
        runtime_dirs: params.include_runtime_dirs === false ? undefined : {
          exports: toProjectRelative(config, config.exportsDir),
          reports: toProjectRelative(config, config.reportsDir),
          audit: toProjectRelative(config, config.auditDir),
          tmp: toProjectRelative(config, config.tmpDir),
        },
      });
    },
  }));
}

async function safeList(dir: string, config: DuckDbBiConfig): Promise<string[]> {
  try {
    const names = await readdir(dir);
    return names.slice(0, 100).map((name) => toProjectRelative(config, `${dir}/${name}`));
  } catch {
    return [];
  }
}

function profileStatusFor(table: WorkspaceDataTable): "available" | "partial" | "missing" {
  const hasColumns = (table.columns?.length ?? 0) > 0;
  const hasRowCount = typeof table.rowCount === "number";
  if (hasColumns && hasRowCount) return "available";
  if (hasColumns || hasRowCount) return "partial";
  return "missing";
}

function inferColumnRole(name: string, type?: string): string {
  const lower = name.toLowerCase();
  const typeText = type ?? "";
  if (/(^id$|_id$|uuid|key$)/i.test(lower)) return "id";
  if (/(date|time|timestamp|created|updated|month|week|year|quarter|hour|day)/i.test(lower) || /DATE|TIME|TIMESTAMP/i.test(typeText)) return "time";
  if (/(amount|revenue|sales|cost|price|total|value|quantity|qty|count|rate|ratio|pct|percent|score|margin|profit|duration|distance)/i.test(lower)) return "measure";
  if (/INT|DECIMAL|NUMERIC|DOUBLE|FLOAT|REAL|BIGINT|SMALLINT|TINYINT/i.test(typeText)) return "numeric";
  return "dimension";
}

function inferTableRole(table: WorkspaceDataTable): { value: string; confidence: "low" | "medium"; evidence: string[] } {
  const columns = table.columns ?? [];
  const roles = columns.map((c) => inferColumnRole(c.name, c.type));
  const rowCount = table.rowCount ?? 0;
  const idCount = roles.filter((r) => r === "id").length;
  const measureCount = roles.filter((r) => r === "measure").length;
  const timeCount = roles.filter((r) => r === "time").length;
  const evidence = [
    `${columns.length} registered column(s)`,
    rowCount ? `${rowCount} registered row(s)` : "row count not registered",
  ];
  if (!columns.length) return { value: "unknown", confidence: "low", evidence };
  if (rowCount > 1_000 && measureCount >= 1 && (timeCount >= 1 || idCount >= 1)) {
    return { value: "possible_fact", confidence: "medium", evidence: [...evidence, `${measureCount} measure-like column(s)`, `${timeCount} time-like column(s)`] };
  }
  if ((rowCount > 0 && rowCount < 10_000) && idCount >= 1 && measureCount <= 1) {
    return { value: "possible_dimension", confidence: "medium", evidence: [...evidence, `${idCount} id-like column(s)`, `${measureCount} measure-like column(s)`] };
  }
  return { value: "unknown", confidence: "low", evidence };
}

function semanticHintsFor(table: WorkspaceDataTable) {
  const columns = table.columns ?? [];
  return {
    ids: columns.filter((c) => inferColumnRole(c.name, c.type) === "id").map((c) => c.name),
    time_fields: columns.filter((c) => inferColumnRole(c.name, c.type) === "time").map((c) => c.name),
    measures: columns.filter((c) => inferColumnRole(c.name, c.type) === "measure").map((c) => c.name),
    dimensions: columns.filter((c) => inferColumnRole(c.name, c.type) === "dimension").map((c) => c.name),
  };
}

function nextActionsForRegisteredTable(table: WorkspaceDataTable, profileStatus: string): string[] {
  if (table.status !== "ready") return ["Run cmux-evidence data refresh and resolve the table status before dashboard use."];
  const actions = [];
  if (profileStatus === "missing") actions.push(`Run duckdb_describe_table and duckdb_summarize_table for ${table.qualifiedName}.`);
  else actions.push(`Review duckdb_summarize_table findings for ${table.qualifiedName}.`);
  actions.push(`Use ${table.qualifiedName} in Evidence page SQL; avoid raw file paths.`);
  return actions;
}

function nextOverallAction(registeredTables: Array<{ name: string; status: string }>, unregisteredFiles: unknown[], evidenceSourceCount: number): string {
  if (registeredTables.some((t) => t.status === "ready")) return "Profile ready registered tables with duckdb_summarize_table before writing Evidence SQL.";
  if (unregisteredFiles.length) return "Run cmux-evidence data refresh so data files become registered files.<alias> sources.";
  if (evidenceSourceCount) return "Profile available Evidence sources, then validate queries before writing pages.";
  return "Add supported CSV, TSV, Parquet, JSON, or JSONL files under data/ and run cmux-evidence data refresh.";
}
