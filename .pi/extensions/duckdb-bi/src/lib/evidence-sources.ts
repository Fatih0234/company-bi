import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { DuckDbBiConfig, EvidenceSourceInfo, TableSource } from "../types";
import { normalizeSlashes, resolveProjectPath, toProjectRelative } from "./paths";

export function sourceSqlToSubquery(sql: string): string {
  const trimmed = sql.trim().replace(/;\s*$/g, "");
  if (!trimmed) throw new Error("Evidence source SQL is empty");
  return `(${trimmed})`;
}

export async function discoverEvidenceSources(config: DuckDbBiConfig): Promise<EvidenceSourceInfo[]> {
  const sourcesRoot = path.join(config.projectRoot, "sources");
  try {
    const s = await stat(sourcesRoot);
    if (!s.isDirectory()) return [];
  } catch {
    return [];
  }

  const out: EvidenceSourceInfo[] = [];
  let sourceDirs: string[];
  try {
    sourceDirs = await readdir(sourcesRoot);
  } catch {
    return [];
  }

  for (const sourceName of sourceDirs.sort()) {
    const sourceDir = path.join(sourcesRoot, sourceName);
    try {
      if (!(await stat(sourceDir)).isDirectory()) continue;
    } catch {
      continue;
    }
    let files: string[];
    try {
      files = await readdir(sourceDir);
    } catch {
      continue;
    }
    for (const fileName of files.sort()) {
      if (!fileName.endsWith(".sql")) continue;
      const abs = path.join(sourceDir, fileName);
      const tableName = fileName.replace(/\.sql$/i, "");
      out.push({
        source: sourceName,
        name: tableName,
        qualifiedName: `${sourceName}.${tableName}`,
        path: normalizeSlashes(path.relative(config.projectRoot, abs)),
        absolutePath: abs,
      });
    }
  }
  return out;
}

export async function readEvidenceSourceSql(config: DuckDbBiConfig, source: EvidenceSourceInfo): Promise<string> {
  const abs = resolveProjectPath(config, source.path, "Evidence source SQL path");
  const sql = await readFile(abs, "utf8");
  return sourceSqlToSubquery(sql);
}

export async function resolveEvidenceTableSource(config: DuckDbBiConfig, table: string): Promise<TableSource | undefined> {
  const normalized = table.replace(/\\/g, "/");
  const sources = await discoverEvidenceSources(config);
  const match = sources.find((source) => {
    return source.qualifiedName === table
      || source.path === normalized
      || source.name === table && sources.filter((candidate) => candidate.name === table).length === 1;
  });
  if (!match) return undefined;
  const sql = await readEvidenceSourceSql(config, match);
  return {
    sql,
    displayName: match.qualifiedName,
    sourcePath: match.path,
    isFileSource: false,
    sourceType: "evidence_sql",
  };
}

export function evidenceSourceToPublic(source: EvidenceSourceInfo) {
  return {
    name: source.qualifiedName,
    source: source.source,
    table: source.name,
    path: source.path,
    source_type: "evidence_sql" as const,
    recommended_for_dashboard: true,
  };
}
