import { mkdir, readdir, stat, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
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

export function createConfig(projectRoot = process.cwd()): DuckDbBiConfig {
  const root = path.resolve(projectRoot);
  const runtimeDir = path.join(root, RUNTIME_DIR);
  const exportsDir = path.join(runtimeDir, EXPORTS_DIR);
  const reportsDir = path.join(runtimeDir, REPORTS_DIR);
  const auditDir = path.join(runtimeDir, AUDIT_DIR);
  const tmpDir = path.join(runtimeDir, TMP_DIR);
  return {
    projectRoot: root,
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

export function resolveProjectPath(config: DuckDbBiConfig, inputPath: string, label = "path"): string {
  if (!inputPath || inputPath.includes("\0")) throw new Error(`${label} is empty or invalid`);
  const resolved = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(config.projectRoot, inputPath);
  assertInside(config.projectRoot, resolved, label);
  return resolved;
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
  const includeRoots = options.includeRoots?.length
    ? options.includeRoots
    : mode === "business"
      ? await existingBusinessRoots(config)
      : ["."];
  const excluded = new Set([
    ...ALWAYS_EXCLUDED_DIRS,
    ...(mode === "business" ? BUSINESS_EXCLUDED_DIRS : []),
    ...(options.excludeRoots ?? []).map((item) => item.replace(/\/$/, "")),
  ]);
  const out: DataFileInfo[] = [];

  async function visit(dir: string, depth: number): Promise<void> {
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
      const rel = toProjectRelative(config, abs);
      if (excluded.has(rel)) continue;
      let s;
      try {
        s = await stat(abs);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        if (abs === config.runtimeDir) continue;
        await visit(abs, depth + 1);
      } else if (s.isFile() && DATA_FILE_EXTENSIONS.includes(path.extname(entry).toLowerCase())) {
        out.push({
          path: toProjectRelative(config, abs),
          absolutePath: abs,
          type: dataFileType(abs),
          size_bytes: s.size,
          alias: aliasForFile(abs),
        });
      }
    }
  }

  for (const root of includeRoots) {
    const abs = root === "." ? config.projectRoot : resolveProjectPath(config, root, "discovery root");
    await visit(abs, 0);
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

async function existingBusinessRoots(config: DuckDbBiConfig): Promise<string[]> {
  const roots: string[] = [];
  for (const candidate of DEFAULT_BUSINESS_ROOTS) {
    try {
      if ((await stat(path.join(config.projectRoot, candidate))).isDirectory()) roots.push(candidate);
    } catch {
      // ignore missing preferred roots
    }
  }
  return roots.length ? roots : ["."];
}
