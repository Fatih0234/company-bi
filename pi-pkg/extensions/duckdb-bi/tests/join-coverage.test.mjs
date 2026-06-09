// Integration tests for the duckdb_join_coverage tool added in Layer 1.
//
// Run with: node --test tests/join-coverage.test.mjs
//
// The tool is loaded via jiti with stubs for @earendil-works/pi-coding-agent
// and typebox (they're only used at registration time, not at execute time).
// Real DuckDB CLI is invoked against the tests/fixtures/ mini CSV files.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import createJiti from "jiti";
import path from "node:path";
import os from "node:os";
import { mkdtemp, readFile, rm, copyFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const EXT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES_DIR = path.join(EXT_DIR, "tests", "fixtures");
const STUBS_DIR = path.join(EXT_DIR, "tests", "_stubs");

const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  esmResolve: true,
  alias: {
    "@earendil-works/pi-coding-agent": path.join(STUBS_DIR, "pi-coding-agent.mjs"),
    "typebox": path.join(STUBS_DIR, "typebox.mjs"),
  },
});

const pathsMod = jiti(`${EXT_DIR}/src/lib/paths.ts`);
const joinMod = jiti(`${EXT_DIR}/src/tools/join-coverage.ts`);

let projectRoot;
let config;
let registeredTool;
const createdRoots = [];

after(async () => {
  for (const root of createdRoots) {
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
});

async function makeProjectRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "duckdb-bi-test-"));
  createdRoots.push(root);
  await copyFile(path.join(FIXTURES_DIR, "taxi_zone_lookup_mini.csv"), path.join(root, "taxi_zone_lookup_mini.csv"));
  await copyFile(path.join(FIXTURES_DIR, "yellow_tripdata_mini.csv"), path.join(root, "yellow_tripdata_mini.csv"));
  return root;
}

async function loadTool(root) {
  projectRoot = root;
  config = pathsMod.createConfig(root);
  registeredTool = null;
  const stub = { registerTool(def) { registeredTool = def; } };
  joinMod.registerJoinCoverageTool(stub, config);
  assert.ok(registeredTool, "tool should be registered");
  assert.equal(registeredTool.name, "duckdb_join_coverage");
  assert.match(registeredTool.promptSnippet, /coverage/i);
  assert.ok(Array.isArray(registeredTool.promptGuidelines) && registeredTool.promptGuidelines.length >= 1,
    "should expose promptGuidelines (added in Layer 1)");
}

async function invoke(params) {
  const ctx = { cwd: projectRoot };
  const result = await registeredTool.execute("call_1", params, undefined, undefined, ctx);
  const text = result.content[0].text;
  return JSON.parse(text);
}

test("registers with name duckdb_join_coverage and exposes prompt pieces", async () => {
  const root = await makeProjectRoot();
  await loadTool(root);
  // assertions live inside loadTool()
});

test("auto_discover finds PULocationID via pu_prefix and DOLocationID via do_prefix", async () => {
  const root = await makeProjectRoot();
  await loadTool(root);
  const data = await invoke({
    dimension_table: "taxi_zone_lookup_mini",
    key_column: "LocationID",
    auto_discover: true,
    timeout_ms: 30_000,
  });
  assert.equal(data.ok, true);
  assert.ok(Array.isArray(data.candidates_considered));
  assert.equal(data.candidates_considered.length, 2);
  for (const c of data.candidates_considered) {
    assert.ok(c.table, `candidates_considered[].table must be populated, got ${JSON.stringify(c)}`);
  }
  const byRule = Object.fromEntries(data.candidates_considered.map((c) => [c.match_rule, c]));
  assert.equal(byRule.pu_prefix?.fk_column, "PULocationID");
  assert.equal(byRule.do_prefix?.fk_column, "DOLocationID");
  assert.equal(byRule.pu_prefix?.table, "yellow_tripdata_mini");
  assert.equal(byRule.do_prefix?.table, "yellow_tripdata_mini");
});

test("explicit candidates work and don't require auto_discover", async () => {
  const root = await makeProjectRoot();
  await loadTool(root);
  const data = await invoke({
    dimension_table: "taxi_zone_lookup_mini",
    key_column: "LocationID",
    candidates: [{ table: "yellow_tripdata_mini", fk_column: "PULocationID" }],
    timeout_ms: 30_000,
  });
  assert.equal(data.candidates_considered.length, 1);
  assert.equal(data.candidates_considered[0].match_rule, "explicit");
  assert.equal(data.joins.length, 1);
  assert.equal(data.joins[0].fk_column, "PULocationID");
});

test("forward coverage percentage is computed correctly (1 of 14 rows has FK=999 → 13/14 = 92.86%)", async () => {
  const root = await makeProjectRoot();
  await loadTool(root);
  const data = await invoke({
    dimension_table: "taxi_zone_lookup_mini",
    key_column: "LocationID",
    candidates: [{ table: "yellow_tripdata_mini", fk_column: "PULocationID" }],
    timeout_ms: 30_000,
  });
  const j = data.joins[0];
  assert.equal(j.fact_row_count, 14);
  assert.equal(j.matched, 13);
  assert.equal(j.orphans, 1);
  assert.equal(j.null_fk, 0);
  assert.equal(j.coverage_pct, 92.86);
  assert.equal(j.orphan_pct, 7.14);
});

test("low coverage (92.86%) fires the LOW_COVERAGE finding with the right percentage in the message", async () => {
  const root = await makeProjectRoot();
  await loadTool(root);
  const data = await invoke({
    dimension_table: "taxi_zone_lookup_mini",
    key_column: "LocationID",
    candidates: [{ table: "yellow_tripdata_mini", fk_column: "PULocationID" }],
    timeout_ms: 30_000,
  });
  const codes = data.findings.map((f) => f.code);
  assert.ok(codes.includes("LOW_COVERAGE"), `expected LOW_COVERAGE, got ${JSON.stringify(codes)}`);
  const low = data.findings.find((f) => f.code === "LOW_COVERAGE");
  assert.equal(low.severity, "warning");
  assert.match(low.message, /92\.86%/);
});

test("unused dimension rows are detected (LocationID 6 'Unknown' is never picked up)", async () => {
  const root = await makeProjectRoot();
  await loadTool(root);
  const data = await invoke({
    dimension_table: "taxi_zone_lookup_mini",
    key_column: "LocationID",
    candidates: [{ table: "yellow_tripdata_mini", fk_column: "PULocationID" }],
    timeout_ms: 30_000,
  });
  const j = data.joins[0];
  assert.equal(j.dim_row_count, 8);
  // Mini fact uses LocationIDs {1,2,3,4,5,7,8}, not 6. Unused count should be 1.
  assert.equal(j.unused, 1);
  assert.equal(j.used, 7);
  assert.equal(j.unused_pct, 12.5);
  const codes = data.findings.map((f) => f.code);
  assert.ok(codes.includes("UNUSED_DIMENSION_ROWS"), `expected UNUSED_DIMENSION_ROWS, got ${JSON.stringify(codes)}`);
});

test("100% forward coverage fires FULL_COVERAGE (and no UNUSED_DIMENSION_ROWS when all dim rows are used)", async () => {
  const root = await makeProjectRoot();
  // All 8 LocationIDs are used, no orphans, all matches.
  await writeFile(path.join(root, "clean_fact.csv"), "PULocationID,DOLocationID\n1,2\n2,3\n3,4\n4,5\n5,6\n6,7\n7,8\n8,1\n");
  await loadTool(root);
  const data = await invoke({
    dimension_table: "taxi_zone_lookup_mini",
    key_column: "LocationID",
    candidates: [{ table: "clean_fact", fk_column: "PULocationID" }],
    timeout_ms: 30_000,
  });
  assert.equal(data.joins[0].coverage_pct, 100);
  assert.equal(data.joins[0].orphans, 0);
  assert.equal(data.joins[0].unused, 0);
  const codes = data.findings.map((f) => f.code);
  assert.ok(codes.includes("FULL_COVERAGE"), `expected FULL_COVERAGE, got ${JSON.stringify(codes)}`);
  assert.equal(codes.includes("UNUSED_DIMENSION_ROWS"), false, "no dim row unused here");
});

test("TYPE_MISMATCH finding fires for INT dim key vs VARCHAR FK (and not for VARCHAR ↔ VARCHAR)", async () => {
  const root = await makeProjectRoot();
  // Leading-zero FK values force DuckDB to keep the column as VARCHAR, while still
  // being auto-castable to BIGINT for the join itself (so the join succeeds and we
  // exercise the type-compatibility path, not the CANDIDATE_SKIPPED path).
  await writeFile(path.join(root, "fact_strfk.csv"), "fk\n01\n02\n03\n");
  await loadTool(root);

  // Sanity: VARCHAR ↔ VARCHAR is compatible.
  const data1 = await invoke({
    dimension_table: "taxi_zone_lookup_mini",
    key_column: "LocationID",
    candidates: [{ table: "fact_strfk", fk_column: "fk" }],
    timeout_ms: 30_000,
  });
  const j1 = data1.joins[0];
  assert.equal(j1.fk_type, "VARCHAR", `expected fk_type=VARCHAR, got ${j1.fk_type}`);
  assert.equal(j1.key_type, "BIGINT");
  assert.equal(j1.type_compatible, false, "BIGINT vs VARCHAR must be incompatible");
  const codes1 = data1.findings.map((f) => f.code);
  assert.ok(codes1.includes("TYPE_MISMATCH"), `expected TYPE_MISMATCH, got ${JSON.stringify(codes1)}`);
  const tm = data1.findings.find((f) => f.code === "TYPE_MISMATCH");
  assert.equal(tm.severity, "warning");
  // The forward join still ran (no CANDIDATE_SKIPPED), so we can also check the
  // coverage results — leading-zero values auto-cast and match 1, 2, 3 in the dim.
  assert.equal(j1.matched, 3);
});

test("NO_CANDIDATES finding fires when neither candidates nor auto_discover is provided", async () => {
  const root = await makeProjectRoot();
  await loadTool(root);
  const data = await invoke({
    dimension_table: "taxi_zone_lookup_mini",
    key_column: "LocationID",
  });
  assert.equal(data.candidates_considered.length, 0);
  assert.equal(data.joins.length, 0);
  const codes = data.findings.map((f) => f.code);
  assert.ok(codes.includes("NO_CANDIDATES"), `expected NO_CANDIDATES, got ${JSON.stringify(codes)}`);
});

test("audit log gets one entry per SQL query, all with status=ok and tool_name=duckdb_join_coverage", async () => {
  const root = await makeProjectRoot();
  await loadTool(root);
  const data = await invoke({
    dimension_table: "taxi_zone_lookup_mini",
    key_column: "LocationID",
    auto_discover: true,
    timeout_ms: 30_000,
  });
  // Expected queries:
  //   - describe dim + count dim: 2
  //   - per candidate (2 of them): describe fact + count fact + forward + reverse: 4
  //   - in addition, auto-discover does describe per sibling file: 2 mini CSVs
  // Total: 2 + 2*4 + 2 = 12.
  assert.ok(data.query_ids.length >= 8, `expected at least 8 query ids, got ${data.query_ids.length}`);
  assert.equal(new Set(data.query_ids).size, data.query_ids.length, "all query ids should be unique");

  // Verify the audit log file got the entries written for this tool.
  const log = await readFile(config.auditLogPath, "utf-8");
  const lines = log.trim().split("\n").filter(Boolean);
  const recent = lines.slice(-data.query_ids.length);
  for (const line of recent) {
    const entry = JSON.parse(line);
    assert.equal(entry.tool_name, "duckdb_join_coverage");
    assert.equal(entry.status, "ok");
    assert.ok(entry.query_id, "audit entry has a query_id");
    assert.ok(entry.sql, "audit entry has SQL");
  }
});
