// Tests for Evidence-aware discovery defaults and source SQL table resolution.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import createJiti from "jiti";
import path from "node:path";
import os from "node:os";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const EXT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STUBS_DIR = path.join(EXT_DIR, "tests", "_stubs");
const jiti = createJiti(import.meta.url, { interopDefault: true, esmResolve: true });
const toolJiti = createJiti(import.meta.url, {
  interopDefault: true,
  esmResolve: true,
  alias: {
    "@earendil-works/pi-coding-agent": path.join(STUBS_DIR, "pi-coding-agent.mjs"),
    "@earendil-works/pi-ai": path.join(STUBS_DIR, "pi-ai.mjs"),
    "typebox": path.join(STUBS_DIR, "typebox.mjs"),
  },
});
const pathsMod = jiti(`${EXT_DIR}/src/lib/paths.ts`);
const evidenceMod = jiti(`${EXT_DIR}/src/lib/evidence-sources.ts`);
const safetyMod = jiti(`${EXT_DIR}/src/lib/sql-safety.ts`);
const duckdbMod = jiti(`${EXT_DIR}/src/lib/duckdb-cli.ts`);
const registerMod = toolJiti(`${EXT_DIR}/src/register-tools.ts`);

const createdRoots = [];

after(async () => {
  for (const root of createdRoots) await rm(root, { recursive: true, force: true }).catch(() => {});
});

async function makeEvidenceRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "duckdb-bi-evidence-test-"));
  createdRoots.push(root);
  await mkdir(path.join(root, "data"), { recursive: true });
  await mkdir(path.join(root, "sources", "demo"), { recursive: true });
  await mkdir(path.join(root, ".cmux"), { recursive: true });
  await mkdir(path.join(root, ".pi", "fixtures"), { recursive: true });
  await mkdir(path.join(root, ".workspaces", "old"), { recursive: true });
  await writeFile(path.join(root, "data", "orders.csv"), "order_id,customer_id,amount\n1,10,25\n2,11,40\n", "utf8");
  await writeFile(path.join(root, ".cmux", "workspace.json"), "{}\n", "utf8");
  await writeFile(path.join(root, ".pi", "fixtures", "noise.csv"), "x\n1\n", "utf8");
  await writeFile(path.join(root, ".workspaces", "old", "stale.csv"), "x\n1\n", "utf8");
  await writeFile(path.join(root, "sources", "demo", "orders.sql"), "select order_id, customer_id, amount from read_csv_auto('data/orders.csv')\n", "utf8");
  return root;
}

test("business data discovery defaults to data/ and excludes generated/internal dirs", async () => {
  const root = await makeEvidenceRoot();
  const config = pathsMod.createConfig(root);
  const files = await pathsMod.discoverDataFiles(config);
  assert.deepEqual(files.map((file) => file.path), ["data/orders.csv"]);
});

test("all data discovery can still scan project-local non-business files when requested", async () => {
  const root = await makeEvidenceRoot();
  const config = pathsMod.createConfig(root);
  const files = await pathsMod.discoverDataFiles(config, { mode: "all" });
  const paths = files.map((file) => file.path);
  assert.ok(paths.includes("data/orders.csv"));
  assert.ok(paths.includes(".pi/fixtures/noise.csv"));
});

test("Evidence source catalog exposes qualified source names", async () => {
  const root = await makeEvidenceRoot();
  const config = pathsMod.createConfig(root);
  const sources = await evidenceMod.discoverEvidenceSources(config);
  assert.deepEqual(sources.map((source) => source.qualifiedName), ["demo.orders"]);
  assert.equal(sources[0].path, "sources/demo/orders.sql");
});

test("resolveTableSource resolves Evidence sources by qualified name, unambiguous name, and SQL path", async () => {
  const root = await makeEvidenceRoot();
  const config = pathsMod.createConfig(root);
  for (const name of ["demo.orders", "orders", "sources/demo/orders.sql"]) {
    const source = await safetyMod.resolveTableSource(config, name);
    assert.equal(source.displayName, "demo.orders");
    assert.equal(source.sourceType, "evidence_sql");
    assert.equal(source.sourcePath, "sources/demo/orders.sql");
  }
});

test("Evidence source SQL can be queried through DuckDB tools as a subquery", async () => {
  const root = await makeEvidenceRoot();
  const config = pathsMod.createConfig(root);
  const source = await safetyMod.resolveTableSource(config, "demo.orders");
  const result = await duckdbMod.runDuckDbJson(config, {
    sql: `SELECT COUNT(*) AS row_count, SUM(amount) AS total_amount FROM ${source.sql}`,
    readonly: true,
  });
  assert.equal(result.rows[0].row_count, 2);
  assert.equal(result.rows[0].total_amount, 65);
});

test("content-only config sees shadow Evidence sources while writing artifacts under workspace", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "duckdb-bi-content-test-"));
  createdRoots.push(root);
  const workspace = path.join(root, "workspace");
  const shadow = path.join(root, "shadow");
  const runtime = path.join(root, "runtime");
  await mkdir(path.join(workspace, ".cmux"), { recursive: true });
  await mkdir(path.join(workspace, "data", "local"), { recursive: true });
  await mkdir(path.join(shadow, "sources", "demo"), { recursive: true });
  await mkdir(path.join(shadow, "data"), { recursive: true });
  await mkdir(runtime, { recursive: true });
  await writeFile(path.join(workspace, "data", "local", "sample.csv"), "id,label\n1,alpha\n", "utf8");
  await writeFile(path.join(shadow, "data", "orders.csv"), "order_id,amount\n1,25\n2,40\n", "utf8");
  await writeFile(path.join(shadow, "sources", "demo", "orders.sql"), "select * from read_csv_auto('data/orders.csv')\n", "utf8");
  await writeFile(path.join(workspace, ".cmux", "workspace.json"), JSON.stringify({
    kind: "lumen-analysis-workspace",
    workspaceMode: "content-only",
    workspaceRoot: workspace,
    shadowRuntimeRoot: shadow,
    runtimeRoot: runtime,
  }), "utf8");
  await writeFile(path.join(workspace, ".cmux", "evidence.json"), JSON.stringify({
    type: "evidence",
    workspaceMode: "content-only",
    workspaceRoot: workspace,
    shadowRuntimeRoot: shadow,
    runtimeRoot: runtime,
  }), "utf8");

  const config = pathsMod.createConfig(workspace);
  assert.equal(config.projectRoot, workspace);
  assert.equal(config.evidenceSourceRoot, shadow);
  assert.equal(config.runtimeDir, path.join(workspace, ".pi", "duckdb"));

  const files = await pathsMod.discoverDataFiles(config);
  assert.ok(files.some((file) => file.root === "workspace" && file.path === "data/local/sample.csv"));
  assert.ok(files.some((file) => file.root === "shadow" && file.path === "data/orders.csv"));

  const sources = await evidenceMod.discoverEvidenceSources(config);
  assert.deepEqual(sources.map((source) => source.qualifiedName), ["demo.orders"]);

  const source = await safetyMod.resolveTableSource(config, "demo.orders");
  assert.equal(source.sourceType, "evidence_sql");
  const result = await duckdbMod.runDuckDbJson(config, {
    sql: `SELECT COUNT(*) AS row_count, SUM(amount) AS total_amount FROM ${source.sql}`,
    readonly: true,
  });
  assert.equal(result.rows[0].row_count, 2);
  assert.equal(result.rows[0].total_amount, 65);

  const tools = new Map();
  registerMod.registerDuckDbBiTools({ registerTool(tool) { tools.set(tool.name, tool); } }, pathsMod.createConfig(runtime));
  const exportResultRaw = await tools.get("duckdb_export_query").execute("call_1", {
    sql: "SELECT * FROM read_csv_auto('data/local/sample.csv')",
    format: "csv",
    output_name: "local-sample",
    overwrite: true,
  }, undefined, undefined, { cwd: workspace });
  const exportResult = JSON.parse(exportResultRaw.content[0].text);
  assert.equal(exportResult.ok, true);
  assert.equal(exportResult.path, ".pi/duckdb/exports/local-sample.csv");
  assert.ok(await pathsMod.pathExists(path.join(workspace, ".pi", "duckdb", "exports", "local-sample.csv")));
});
