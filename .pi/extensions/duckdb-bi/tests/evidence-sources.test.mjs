// Tests for Evidence-aware discovery defaults and source SQL table resolution.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import createJiti from "jiti";
import path from "node:path";
import os from "node:os";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const EXT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, { interopDefault: true, esmResolve: true });
const pathsMod = jiti(`${EXT_DIR}/src/lib/paths.ts`);
const evidenceMod = jiti(`${EXT_DIR}/src/lib/evidence-sources.ts`);
const safetyMod = jiti(`${EXT_DIR}/src/lib/sql-safety.ts`);
const duckdbMod = jiti(`${EXT_DIR}/src/lib/duckdb-cli.ts`);

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
