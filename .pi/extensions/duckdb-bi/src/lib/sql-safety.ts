import path from "node:path";
import { discoverDataFiles, normalizeSlashes, resolveProjectPath, toProjectRelative } from "./paths";
import { resolveEvidenceTableSource } from "./evidence-sources";
import type { DuckDbBiConfig, TableSource } from "../types";

export interface SqlClassification {
  readonly: boolean;
  blocked: boolean;
  reasons: string[];
}

const UNSAFE_KEYWORDS = [
  "DROP",
  "DELETE",
  "UPDATE",
  "INSERT",
  "CREATE",
  "ALTER",
  "TRUNCATE",
  "COPY\\s+.+\\s+TO",
  "COPY\\s+.+\\s+FROM",
  "INSTALL",
  "LOAD",
  "EXPORT\\s+DATABASE",
  "IMPORT\\s+DATABASE",
  "ATTACH",
  "DETACH",
  "CALL",
  "PRAGMA",
  "SET",
  "RESET",
];

const DOT_COMMAND_RE = /^\s*\.(open|read|output|once|system|shell|sh|safe_mode|quit|cd|import|log|excel)\b/im;
const MULTI_STATEMENT_RE = /;\s*\S/;

export function stripSqlComments(sql: string): string {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

export function classifySql(sql: string): SqlClassification {
  const reasons: string[] = [];
  const clean = stripSqlComments(sql).trim();
  if (!clean) reasons.push("SQL is empty");
  if (DOT_COMMAND_RE.test(clean)) reasons.push("DuckDB dot commands are not allowed through this tool");
  if (MULTI_STATEMENT_RE.test(clean)) reasons.push("Multiple SQL statements are not allowed in readonly mode");
  for (const keyword of UNSAFE_KEYWORDS) {
    const re = new RegExp(`\\b${keyword}\\b`, "i");
    if (re.test(clean)) reasons.push(`SQL contains blocked operation: ${keyword.replace(/\\s\+/g, " ")}`);
  }
  return { readonly: reasons.length === 0, blocked: reasons.length > 0, reasons };
}

export function assertSqlAllowed(sql: string, options: { readonly?: boolean; allowWrites?: boolean } = {}): void {
  const classification = classifySql(sql);
  if (classification.blocked && (options.readonly !== false || !options.allowWrites)) {
    throw new Error(classification.reasons.join("; "));
  }
}

export function quoteIdentifier(identifier: string): string {
  if (!identifier || identifier.includes("\0")) throw new Error("identifier is empty or invalid");
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function quoteQualifiedIdentifier(schema: string | undefined, table: string): string {
  return schema ? `${quoteIdentifier(schema)}.${quoteIdentifier(table)}` : quoteIdentifier(table);
}

export function sqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function assertSafeWhere(where: string | undefined): void {
  if (!where) return;
  const trimmed = where.trim();
  if (!trimmed) return;
  if (trimmed.includes(";") || /--|\/\*/.test(trimmed)) throw new Error("where must be a simple predicate without comments or semicolons");
  const classification = classifySql(`SELECT 1 WHERE ${trimmed}`);
  if (classification.blocked) throw new Error(`Unsafe where clause: ${classification.reasons.join("; ")}`);
}

export function validateSqlFileAccess(config: DuckDbBiConfig, sql: string): void {
  const fileReaderRe = /read_(?:csv|csv_auto|parquet|json|json_auto)\s*\(\s*'((?:''|[^'])*)'/gi;
  for (const match of sql.matchAll(fileReaderRe)) {
    const raw = match[1].replace(/''/g, "'");
    resolveProjectPath(config, raw, "SQL file path");
  }
}

export function tableSourceForFile(config: DuckDbBiConfig, filePath: string, displayName?: string): TableSource {
  const abs = resolveProjectPath(config, filePath, "table file path");
  const rel = normalizeSlashes(path.relative(config.projectRoot, abs));
  const ext = path.extname(abs).toLowerCase();
  let sql: string;
  if (ext === ".csv" || ext === ".tsv") {
    sql = `read_csv_auto(${sqlStringLiteral(rel)})`;
  } else if (ext === ".parquet") {
    sql = `read_parquet(${sqlStringLiteral(rel)})`;
  } else if (ext === ".json" || ext === ".jsonl") {
    sql = `read_json_auto(${sqlStringLiteral(rel)})`;
  } else {
    throw new Error(`Unsupported table file extension: ${ext}`);
  }
  return { sql, displayName: displayName ?? rel, sourcePath: rel, isFileSource: true, sourceType: "file" };
}

export async function resolveTableSource(
  config: DuckDbBiConfig,
  table: string,
  schema?: string,
): Promise<TableSource> {
  if (!table || table.includes("\0") || table.includes(";")) throw new Error("table is empty or invalid");

  const tableLooksLikePath = /[\\/]/.test(table) || /\.(csv|tsv|parquet|json|jsonl)$/i.test(table);
  if (tableLooksLikePath) {
    if (/\.sql$/i.test(table)) {
      const evidenceSource = await resolveEvidenceTableSource(config, table);
      if (evidenceSource) return evidenceSource;
    }
    return tableSourceForFile(config, table);
  }

  const evidenceSource = await resolveEvidenceTableSource(config, table);
  if (evidenceSource) return evidenceSource;

  const files = await discoverDataFiles(config);
  const direct = files.find((file) => file.alias === table && file.type !== "duckdb");
  if (direct) return tableSourceForFile(config, direct.path, table);

  return { sql: quoteQualifiedIdentifier(schema, table), displayName: schema ? `${schema}.${table}` : table, isFileSource: false, sourceType: "duckdb_table" };
}

export async function validateDatabasePath(config: DuckDbBiConfig, database?: string): Promise<string | undefined> {
  if (!database) return undefined;
  if (database === ":memory:") return database;
  const resolved = resolveProjectPath(config, database, "database");
  return toProjectRelative(config, resolved);
}
