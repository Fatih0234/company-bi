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
      const registeredTables = (registry?.tables ?? []).map((t: WorkspaceDataTable) => ({
        name: t.qualifiedName,
        alias: t.alias,
        path: t.path,
        format: t.format,
        status: t.status,
        sizeBytes: t.sizeBytes,
        rowCount: t.rowCount,
        columns: t.columns?.map((c) => c.name),
        recommended_for_dashboard: t.status === "ready",
      }));

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
        cwd: config.projectRoot,
        discovery_mode: mode,
        artifact_policy: ".pi/duckdb/** is local scratch/provenance and is ignored by Git; Evidence pages/queries remain the dashboard deliverables.",
        runtime_dir: toProjectRelative(config, config.runtimeDir),
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
