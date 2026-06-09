import { mkdir, readdir, stat, access } from "node:fs/promises";
import { constants as fsConstants, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  AUDIT_DIR,
  AUDIT_LOG_FILE,
  DATA_FILE_EXTENSIONS,
  EXPORTS_DIR,
  REPORTS_DIR,
  RUNTIME_DIR,
  TMP_DIR,
} from "../constants";
import type { DataDiscoveryOptions, DataFileInfo, DuckDbBiConfig } from "../types";

const ALWAYS_EXCLUDED_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", ".cache", "coverage"]);
const BUSINESS_EXCLUDED_DIRS = new Set([".agent", ".cmux", ".evidence", ".pi", ".workspaces", ".minio-data"]);
const DEFAULT_BUSINESS_ROOTS = ["data"];
const MAX_DISCOVERED_FILES = 300;

type WorkspaceMetadata = Record<string, unknown>;

export function createConfig(projectRoot = process.cwd()): DuckDbBiConfig {
  const initialRoot = path.resolve(projectRoot);
  const workspace = readJson(path.join(initialRoot, ".cmux", "workspace.json"));
  const evidenceConfig = readJson(path.join(initialRoot, ".cmux", "evidence.json"));
  const isContentOnly = isContentWorkspace(workspace, evidenceConfig);

  const workspaceRoot = isContentOnly
    ? path.resolve(stringValue(workspace?.workspaceRoot) || stringValue(evidenceConfig?.workspaceRoot) || initialRoot)
    : initialRoot;
  const runtimeRoot = isContentOnly
    ? path.resolve(stringValue(workspace?.runtimeRoot) || stringValue(evidenceConfig?.runtimeRoot) || initialRoot)
    : initialRoot;
  const shadowRuntimeRoot = isContentOnly
    ? path.resolve(stringValue(workspace?.shadowRuntimeRoot) || stringValue(evidenceConfig?.shadowRuntimeRoot) || runtimeRoot)
    : initialRoot;
  const evidenceSourceRoot = existingDir(path.join(shadowRuntimeRoot, "sources"))
    ? shadowRuntimeRoot
    : existingDir(path.join(runtimeRoot, "sources"))
      ? runtimeRoot
      : workspaceRoot;

  // Keep DuckDB cwd at the content workspace so raw SQL like
  // read_csv_auto('data/local/file.csv') continues to work for user-provided
  // files. Evidence source SQL and discovered runtime files are rewritten to
  // absolute paths before execution.
  const duckdbCwd = workspaceRoot;
  const runtimeDir = path.join(workspaceRoot, RUNTIME_DIR);
  const exportsDir = path.join(runtimeDir, EXPORTS_DIR);
  const reportsDir = path.join(runtimeDir, REPORTS_DIR);
  const auditDir = path.join(runtimeDir, AUDIT_DIR);
  const tmpDir = path.join(runtimeDir, TMP_DIR);
  const dataRoots = uniqueRoots([
    { root: workspaceRoot, label: "workspace" as const },
    ...(isContentOnly ? [{ root: shadowRuntimeRoot, label: "shadow" as const }, { root: runtimeRoot, label: "runtime" as const }] : []),
  ]);

  return {
    projectRoot: workspaceRoot,
    workspaceRoot,
    runtimeRoot: isContentOnly ? runtimeRoot : undefined,
    shadowRuntimeRoot: isContentOnly ? shadowRuntimeRoot : undefined,
    evidenceSourceRoot,
    duckdbCwd,
    dataRoots,
    runtimeDir,
    exportsDir,
    reportsDir,
    auditDir,
    tmpDir,
    auditLogPath: path.join(auditDir, AUDIT_LOG_FILE),
  };
}

export async function ensureRuntimeDirs(config: DuckDbBiConfig): Promise<void> {
  await Promise.all([
    mkdir(config.exportsDir, { recursive: true }),
    mkdir(config.reportsDir, { recursive: true }),
    mkdir(config.auditDir, { recursive: true }),
    mkdir(config.tmpDir, { recursive: true }),
  ]);
}

export function withProjectRoot(config: DuckDbBiConfig, projectRoot: string): DuckDbBiConfig {
  return createConfig(projectRoot || config.projectRoot);
}

export function toProjectRelative(config: DuckDbBiConfig, absolutePath: string): string {
  return normalizeSlashes(path.relative(config.projectRoot, absolutePath));
}

export function toRootRelative(root: string, absolutePath: string): string {
  return normalizeSlashes(path.relative(root, absolutePath));
}

export function normalizeSlashes(value: string): string {
  return value.split(path.sep).join("/");
}

export function isInside(parent: string, child: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === "" || (!!rel && !rel.startsWith("..") && !path.isAbsolute(rel));
}

export function assertInside(parent: string, child: string, label = "path"): void {
  if (!isInside(parent, child)) {
    throw new Error(`${label} must stay inside ${parent}`);
  }
}

export function allowedRoots(config: DuckDbBiConfig): string[] {
  return Array.from(new Set([
    config.projectRoot,
    config.workspaceRoot,
    config.shadowRuntimeRoot,
    config.runtimeRoot,
    config.evidenceSourceRoot,
    config.duckdbCwd,
    ...(config.dataRoots ?? []).map((root) => root.root),
  ].filter((root): root is string => !!root).map((root) => path.resolve(root))));
}

export function assertInsideAllowedRoots(config: DuckDbBiConfig, child: string, label = "path"): void {
  const roots = allowedRoots(config);
  if (!roots.some((root) => isInside(root, child))) {
    throw new Error(`${label} must stay inside an approved workspace/runtime root`);
  }
}

export function resolveProjectPath(config: DuckDbBiConfig, inputPath: string, label = "path"): string {
  if (!inputPath || inputPath.includes("\0")) throw new Error(`${label} is empty or invalid`);
  const resolved = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(config.projectRoot, inputPath);
  assertInside(config.projectRoot, resolved, label);
  return resolved;
}

export function resolveDataPath(config: DuckDbBiConfig, inputPath: string, label = "data file path"): string {
  if (!inputPath || inputPath.includes("\0")) throw new Error(`${label} is empty or invalid`);
  if (path.isAbsolute(inputPath)) {
    const resolved = path.resolve(inputPath);
    assertInsideAllowedRoots(config, resolved, label);
    return resolved;
  }

  const candidateRoots = [
    config.projectRoot,
    ...(config.dataRoots ?? []).map((root) => root.root),
    config.evidenceSourceRoot,
    config.shadowRuntimeRoot,
    config.runtimeRoot,
  ].filter((root): root is string => !!root);

  for (const root of candidateRoots) {
    const candidate = path.resolve(root, inputPath);
    if (existsSync(candidate)) {
      assertInsideAllowedRoots(config, candidate, label);
      return candidate;
    }
  }

  const fallback = path.resolve(config.projectRoot, inputPath);
  assertInsideAllowedRoots(config, fallback, label);
  return fallback;
}

export function sqlPathForDuckDb(config: DuckDbBiConfig, absolutePath: string): string {
  const resolved = path.resolve(absolutePath);
  const cwd = path.resolve(config.duckdbCwd ?? config.projectRoot);
  if (isInside(cwd, resolved)) return normalizeSlashes(path.relative(cwd, resolved));
  return normalizeSlashes(resolved);
}

export function safeOutputName(input: string | undefined, fallbackBase: string, ext: string): string {
  const raw = (input || fallbackBase).trim();
  const cleaned = raw
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const base = cleaned || fallbackBase;
  if (base.startsWith(".") || base.includes("..")) throw new Error("output_name must not be hidden or contain '..'");
  return `${base}.${ext}`;
}

export function resolveExportPath(config: DuckDbBiConfig, outputName: string): string {
  if (path.isAbsolute(outputName) || outputName.includes("..") || outputName.includes("/")) {
    throw new Error("output_name must be a filename under .pi/duckdb/exports/");
  }
  const resolved = path.join(config.exportsDir, outputName);
  assertInside(config.exportsDir, resolved, "export path");
  return resolved;
}

export function resolveReportPath(config: DuckDbBiConfig, outputName: string): string {
  if (path.isAbsolute(outputName) || outputName.includes("..") || outputName.includes("/")) {
    throw new Error("output_name must be a filename under .pi/duckdb/reports/");
  }
  const resolved = path.join(config.reportsDir, outputName);
  assertInside(config.reportsDir, resolved, "report path");
  return resolved;
}

export async function pathExists(inputPath: string): Promise<boolean> {
  try {
    await access(inputPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function dataFileType(filePath: string): DataFileInfo["type"] {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".csv" || ext === ".tsv") return "csv";
  if (ext === ".parquet") return "parquet";
  if (ext === ".json" || ext === ".jsonl") return "json";
  if (ext === ".duckdb" || ext === ".db") return "duckdb";
  return "unknown";
}

export function aliasForFile(filePath: string): string {
  return path.basename(filePath).replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "data_file";
}

export async function discoverDataFiles(config: DuckDbBiConfig, options: DataDiscoveryOptions = {}): Promise<DataFileInfo[]> {
  const mode = options.mode ?? "business";
  const roots = options.includeRoots?.length
    ? options.includeRoots.map((root) => {
      const base = root === "." ? config.projectRoot : resolveDataPath(config, root, "discovery root");
      return { root: base, start: base, label: "workspace" as const };
    })
    : await existingBusinessRoots(config, mode);
  const excluded = new Set([
    ...ALWAYS_EXCLUDED_DIRS,
    ...(mode === "business" ? BUSINESS_EXCLUDED_DIRS : []),
    ...(options.excludeRoots ?? []).map((item) => item.replace(/\/$/, "")),
  ]);
  const out: DataFileInfo[] = [];
  const seen = new Set<string>();

  async function visit(baseRoot: string, label: "workspace" | "runtime" | "shadow", dir: string, depth: number): Promise<void> {
    if (out.length >= MAX_DISCOVERED_FILES || depth > 5) return;
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= MAX_DISCOVERED_FILES) return;
      if (excluded.has(entry)) continue;
      const abs = path.join(dir, entry);
      const rel = normalizeSlashes(path.relative(baseRoot, abs));
      if (excluded.has(rel)) continue;
      let s;
      try {
        s = await stat(abs);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        if (abs === config.runtimeDir) continue;
        await visit(baseRoot, label, abs, depth + 1);
      } else if (s.isFile() && DATA_FILE_EXTENSIONS.includes(path.extname(entry).toLowerCase())) {
        const key = `${label}:${rel}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          path: rel,
          absolutePath: abs,
          type: dataFileType(abs),
          size_bytes: s.size,
          alias: aliasForFile(abs),
          root: label,
        });
      }
    }
  }

  for (const root of roots) {
    await visit(root.root, root.label, root.start, 0);
  }
  return out.sort((a, b) => `${a.root}:${a.path}`.localeCompare(`${b.root}:${b.path}`));
}

async function existingBusinessRoots(config: DuckDbBiConfig, mode: string): Promise<Array<{ root: string; start: string; label: "workspace" | "runtime" | "shadow" }>> {
  if (mode !== "business") return [{ root: config.projectRoot, start: config.projectRoot, label: "workspace" }];
  const roots: Array<{ root: string; start: string; label: "workspace" | "runtime" | "shadow" }> = [];
  for (const candidate of config.dataRoots ?? [{ root: config.projectRoot, label: "workspace" as const }]) {
    for (const businessRoot of DEFAULT_BUSINESS_ROOTS) {
      const abs = path.join(candidate.root, businessRoot);
      try {
        if ((await stat(abs)).isDirectory()) roots.push({ root: candidate.root, start: abs, label: candidate.label });
      } catch {
        // ignore missing preferred roots
      }
    }
  }
  return roots.length ? roots : [{ root: config.projectRoot, start: config.projectRoot, label: "workspace" }];
}

function readJson(filePath: string): WorkspaceMetadata | undefined {
  try {
    if (!existsSync(filePath)) return undefined;
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as WorkspaceMetadata : undefined;
  } catch {
    return undefined;
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isContentWorkspace(workspace: WorkspaceMetadata | undefined, evidenceConfig: WorkspaceMetadata | undefined): boolean {
  if (stringValue(workspace?.kind) === "lumen-analysis-workspace") return true;
  const mode = stringValue(workspace?.workspaceMode) || stringValue(evidenceConfig?.workspaceMode);
  return mode === "content-only" && !!(workspace?.workspaceRoot || evidenceConfig?.workspaceRoot || workspace?.shadowRuntimeRoot || evidenceConfig?.shadowRuntimeRoot);
}

function existingDir(inputPath: string): boolean {
  try {
    return existsSync(inputPath);
  } catch {
    return false;
  }
}

function uniqueRoots(roots: Array<{ root: string; label: "workspace" | "runtime" | "shadow" }>) {
  const seen = new Set<string>();
  const out: Array<{ root: string; label: "workspace" | "runtime" | "shadow" }> = [];
  for (const item of roots) {
    const resolved = path.resolve(item.root);
    const key = `${item.label}:${resolved}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ root: resolved, label: item.label });
  }
  return out;
}
