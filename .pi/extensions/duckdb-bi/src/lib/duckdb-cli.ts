import { spawn } from "node:child_process";
import { ERROR_CODES, DEFAULT_MAX_OUTPUT_BYTES, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS } from "../constants";
import type { DuckDbBiConfig, DuckDbCliResult, JsonQueryResult, QueryExecutionOptions } from "../types";
import { validateDatabasePath, validateSqlFileAccess } from "./sql-safety";
import { columnsFromRows, parseJsonRows } from "./result-parser";

export async function assertDuckDbAvailable(config: DuckDbBiConfig, signal?: AbortSignal): Promise<void> {
  const result = await runDuckDbCli(config, { args: ["-version"], timeoutMs: 5000, signal });
  if (result.exitCode !== 0) {
    throw Object.assign(new Error("DuckDB CLI was not found or did not run successfully. Install DuckDB and ensure `duckdb` is on PATH."), {
      code: ERROR_CODES.duckdbNotFound,
      stderr: result.stderr,
    });
  }
}

export async function runDuckDbJson(config: DuckDbBiConfig, options: QueryExecutionOptions): Promise<JsonQueryResult> {
  validateSqlFileAccess(config, options.sql);
  const database = await validateDatabasePath(config, options.database);
  const args = buildDuckDbArgs({
    database,
    sql: options.sql,
    readonly: options.readonly ?? true,
    format: "json",
  });
  const result = await runDuckDbCli(config, {
    args,
    timeoutMs: options.timeoutMs,
    maxOutputBytes: options.maxOutputBytes,
    signal: options.signal,
  });
  assertSuccessfulDuckDbResult(result);
  const rows = parseJsonRows(result.stdout);
  return {
    rows,
    columns: columnsFromRows(rows),
    rowCount: rows.length,
    elapsedMs: result.elapsedMs,
    stderr: result.stderr,
  };
}

export async function runDuckDbRaw(
  config: DuckDbBiConfig,
  options: QueryExecutionOptions & { format?: "csv" | "markdown" | "json" | "jsonlines" | "duckbox" },
): Promise<DuckDbCliResult> {
  validateSqlFileAccess(config, options.sql);
  const database = await validateDatabasePath(config, options.database);
  const args = buildDuckDbArgs({
    database,
    sql: options.sql,
    readonly: options.readonly ?? true,
    format: options.format ?? "duckbox",
  });
  const result = await runDuckDbCli(config, {
    args,
    timeoutMs: options.timeoutMs,
    maxOutputBytes: options.maxOutputBytes,
    signal: options.signal,
  });
  assertSuccessfulDuckDbResult(result);
  return result;
}

function buildDuckDbArgs(input: {
  database?: string;
  sql: string;
  readonly: boolean;
  format: "json" | "jsonlines" | "csv" | "markdown" | "duckbox";
}): string[] {
  const args = ["-init", "/dev/null", "-batch", "-no-stdin"];
  if (input.format !== "duckbox") args.push(`-${input.format}`);
  if (input.readonly && input.database && input.database !== ":memory:") args.push("-readonly");
  args.push(input.database || ":memory:");
  args.push("-c", input.sql);
  return args;
}

function assertSuccessfulDuckDbResult(result: DuckDbCliResult): void {
  if (result.timedOut) throw Object.assign(new Error("DuckDB query timed out"), { code: ERROR_CODES.timeout });
  if (result.outputTooLarge) throw Object.assign(new Error("DuckDB output exceeded max output bytes"), { code: ERROR_CODES.outputTooLarge });
  if (result.exitCode !== 0) {
    throw Object.assign(new Error(result.stderr || `DuckDB exited with code ${result.exitCode}`), { code: ERROR_CODES.duckdbError });
  }
}

export async function runDuckDbCli(
  config: DuckDbBiConfig,
  options: { args: string[]; timeoutMs?: number; maxOutputBytes?: number; signal?: AbortSignal },
): Promise<DuckDbCliResult> {
  const timeoutMs = clampTimeout(options.timeoutMs);
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const started = Date.now();
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  let outputTooLarge = false;

  return await new Promise<DuckDbCliResult>((resolve, reject) => {
    const child = spawn("duckdb", options.args, {
      cwd: config.projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      env: process.env,
    });

    const finish = (exitCode: number | null) => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abortHandler);
      resolve({ stdout, stderr, exitCode, elapsedMs: Date.now() - started, timedOut, outputTooLarge });
    };

    const kill = () => {
      if (!child.killed) child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 1000).unref?.();
    };

    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, timeoutMs);

    const abortHandler = () => {
      timedOut = true;
      kill();
    };
    options.signal?.addEventListener("abort", abortHandler, { once: true });

    child.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abortHandler);
      if (err.code === "ENOENT") {
        reject(Object.assign(new Error("DuckDB CLI not found on PATH"), { code: ERROR_CODES.duckdbNotFound }));
      } else {
        reject(err);
      }
    });

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      if (Buffer.byteLength(stdout, "utf8") > maxOutputBytes) {
        outputTooLarge = true;
        kill();
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      if (Buffer.byteLength(stderr, "utf8") > 200_000) stderr = `${stderr.slice(0, 200_000)}\n[stderr truncated]`;
    });

    child.on("close", finish);
  });
}

function clampTimeout(timeoutMs: unknown): number {
  const requested = Number(timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(requested) || requested <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.floor(requested), MAX_TIMEOUT_MS);
}
