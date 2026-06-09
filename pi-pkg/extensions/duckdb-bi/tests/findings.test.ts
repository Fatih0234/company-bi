// Unit tests for the pure findings logic added in Layer 1.
//
// Run with: node --experimental-strip-types --test tests/findings.test.ts
//
// findings.ts has only type-only imports, so --experimental-strip-types can
// load it directly without jiti/tsx.
//
// Every test is written to fail if the corresponding rule did not exist
// (or was tuned away by accident).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeColumnFindings,
  areTypesCompatible,
} from "../src/lib/findings.ts";
import type { ColumnProfile } from "../src/types.ts";

function numProfile(name: string, opts: Partial<ColumnProfile> = {}): ColumnProfile {
  return {
    name,
    type: "BIGINT",
    null_count: 0,
    null_pct: 0,
    distinct_count: opts.distinct_count ?? 1,
    min: opts.min,
    max: opts.max,
    top_values: opts.top_values,
  };
}

function textProfile(name: string, opts: Partial<ColumnProfile> = {}): ColumnProfile {
  return {
    name,
    type: "VARCHAR",
    null_count: 0,
    null_pct: 0,
    distinct_count: opts.distinct_count,
    top_values: opts.top_values,
  };
}

function codes(findings: { code: string; column?: string }[]): Set<string> {
  return new Set(findings.map((f) => f.code));
}

function codesFor(findings: { code: string; column?: string }[], column: string): Set<string> {
  return new Set(findings.filter((f) => f.column === column).map((f) => f.code));
}

// ---------------------------------------------------------------------------
// areTypesCompatible
// ---------------------------------------------------------------------------

test("areTypesCompatible: numeric ↔ numeric is compatible", () => {
  assert.equal(areTypesCompatible("INTEGER", "BIGINT"), true);
  assert.equal(areTypesCompatible("INT", "DOUBLE"), true);
  assert.equal(areTypesCompatible("DECIMAL(10,2)", "NUMERIC(8,4)"), true);
});

test("areTypesCompatible: text ↔ text is compatible", () => {
  assert.equal(areTypesCompatible("VARCHAR", "TEXT"), true);
  assert.equal(areTypesCompatible("CHAR(3)", "STRING"), true);
});

test("areTypesCompatible: date ↔ date is compatible", () => {
  assert.equal(areTypesCompatible("DATE", "TIMESTAMP"), true);
  assert.equal(areTypesCompatible("TIMESTAMP", "TIMESTAMP"), true);
});

test("areTypesCompatible: numeric ↔ text is NOT compatible", () => {
  assert.equal(areTypesCompatible("INTEGER", "VARCHAR"), false);
  assert.equal(areTypesCompatible("VARCHAR", "INT"), false);
});

test("areTypesCompatible: date ↔ numeric is NOT compatible", () => {
  assert.equal(areTypesCompatible("DATE", "INTEGER"), false);
});

test("areTypesCompatible: missing types are treated as compatible (permissive)", () => {
  assert.equal(areTypesCompatible(undefined, "INTEGER"), true);
  assert.equal(areTypesCompatible("INTEGER", undefined), true);
  assert.equal(areTypesCompatible(undefined, undefined), true);
});

// ---------------------------------------------------------------------------
// EDGE_CASE_SENTINEL
// ---------------------------------------------------------------------------

test("EDGE_CASE_SENTINEL: fires for N/A and Unknown", () => {
  const profiles = [
    textProfile("Borough", {
      distinct_count: 3,
      top_values: [
        { value: "Manhattan", count: 50 },
        { value: "Unknown", count: 5 },
        { value: "N/A", count: 1 },
      ],
    }),
  ];
  const findings = computeColumnFindings(profiles, 56);
  const borough = codesFor(findings, "Borough");
  assert.ok(borough.has("EDGE_CASE_SENTINEL"), "should detect sentinels in Borough");
  const f = findings.find((x) => x.code === "EDGE_CASE_SENTINEL" && x.column === "Borough");
  assert.ok(f, "finding present");
  assert.equal(f!.severity, "warning");
  assert.match(f!.message, /"Unknown"/);
  assert.match(f!.message, /"N\/A"/);
});

test("EDGE_CASE_SENTINEL: matches case-insensitively but reports original case", () => {
  const profiles = [
    textProfile("status", {
      distinct_count: 3,
      top_values: [
        { value: "active", count: 80 },
        { value: "n/a", count: 5 },
        { value: "TBD", count: 2 },
      ],
    }),
  ];
  const findings = computeColumnFindings(profiles, 87);
  const f = findings.find((x) => x.code === "EDGE_CASE_SENTINEL" && x.column === "status");
  assert.ok(f, "sentinel must fire regardless of case");
  const sentinels = (f!.evidence as { sentinels: { value: string }[] }).sentinels;
  const values = sentinels.map((s) => s.value).sort();
  assert.deepEqual(values, ["TBD", "n/a"]);
});

test("EDGE_CASE_SENTINEL: does NOT fire on a column with no sentinels", () => {
  const profiles = [
    textProfile("Borough", {
      distinct_count: 3,
      top_values: [
        { value: "Manhattan", count: 50 },
        { value: "Queens", count: 30 },
        { value: "Brooklyn", count: 20 },
      ],
    }),
  ];
  const findings = computeColumnFindings(profiles, 100);
  assert.equal(codesFor(findings, "Borough").has("EDGE_CASE_SENTINEL"), false);
});

test("EDGE_CASE_SENTINEL: only fires on text columns", () => {
  const profiles = [
    numProfile("Borough", {
      distinct_count: 3,
      top_values: [
        { value: 1, count: 50 },
        { value: 999, count: 5 },
        { value: 0, count: 1 },
      ],
    }),
  ];
  const findings = computeColumnFindings(profiles, 56);
  // 'Borough' is numeric-typed here, so the rule should not treat top values as text.
  assert.equal(codesFor(findings, "Borough").has("EDGE_CASE_SENTINEL"), false);
});

// ---------------------------------------------------------------------------
// DUPLICATE_NAME (with the "top-value dominates >50%" guard)
// ---------------------------------------------------------------------------

test("DUPLICATE_NAME: fires for Zone with multiple display-name duplicates", () => {
  // 3 rows for "Governor's Island", 2 rows for "Corona" — both repeat, no value > 50% of rows.
  const profiles = [
    textProfile("Zone", {
      distinct_count: 3,
      top_values: [
        { value: "Governor's Island", count: 3 },
        { value: "Corona", count: 2 },
        { value: "Jamaica", count: 1 },
      ],
    }),
  ];
  const findings = computeColumnFindings(profiles, 6);
  const f = findings.find((x) => x.code === "DUPLICATE_NAME" && x.column === "Zone");
  assert.ok(f, "should fire for Zone");
  assert.equal(f!.severity, "warning");
  assert.match(f!.message, /3 duplicate/);
});

test("DUPLICATE_NAME: does NOT fire when only one value is duplicated (the rule needs ≥2 duplicated values)", () => {
  const profiles = [
    textProfile("Zone", {
      distinct_count: 2,
      top_values: [
        { value: "Governor's Island", count: 5 },
        { value: "Jamaica", count: 1 },
      ],
    }),
  ];
  const findings = computeColumnFindings(profiles, 6);
  assert.equal(codesFor(findings, "Zone").has("DUPLICATE_NAME"), false);
});

test("DUPLICATE_NAME: does NOT fire on low-cardinality flag columns (single value dominates >50%)", () => {
  // The original false positive: 'Boro Zone' dominates 205/265 ≈ 77%, so this is a flag, not a name.
  const profiles = [
    textProfile("service_zone", {
      distinct_count: 3,
      top_values: [
        { value: "Boro Zone", count: 205 },
        { value: "Yellow Zone", count: 55 },
        { value: "Airports", count: 5 },
      ],
    }),
  ];
  const findings = computeColumnFindings(profiles, 265);
  assert.equal(codesFor(findings, "service_zone").has("DUPLICATE_NAME"), false);
});

test("DUPLICATE_NAME: does NOT fire on numeric columns even with name-like name", () => {
  const profiles = [
    numProfile("zone_id", {
      distinct_count: 4,
      top_values: [
        { value: 1, count: 3 },
        { value: 2, count: 2 },
        { value: 3, count: 1 },
      ],
    }),
  ];
  const findings = computeColumnFindings(profiles, 6);
  assert.equal(codes(findings).has("DUPLICATE_NAME"), false);
});

test("DUPLICATE_NAME: matches name / label / title / description column names", () => {
  for (const name of ["name", "label", "title", "description", "zone_name", "display_label", "Product Description"]) {
    const profiles = [
      textProfile(name, {
        distinct_count: 3,
        top_values: [
          { value: "A", count: 2 },
          { value: "B", count: 2 },
          { value: "C", count: 1 },
        ],
      }),
    ];
    const findings = computeColumnFindings(profiles, 5);
    assert.ok(
      codesFor(findings, name).has("DUPLICATE_NAME"),
      `expected DUPLICATE_NAME to fire for column named "${name}"`,
    );
  }
});

// ---------------------------------------------------------------------------
// CONSTANT_COLUMN / LOW_DIVERSITY
// ---------------------------------------------------------------------------

test("CONSTANT_COLUMN: fires when one value spans the whole table", () => {
  const profiles = [
    numProfile("region", { distinct_count: 1, top_values: [{ value: 1, count: 100 }] }),
  ];
  const findings = computeColumnFindings(profiles, 100);
  const f = findings.find((x) => x.code === "CONSTANT_COLUMN");
  assert.ok(f);
  assert.equal(f!.severity, "warning");
});

test("CONSTANT_COLUMN: does NOT fire for a 1-row table", () => {
  const profiles = [
    numProfile("region", { distinct_count: 1, top_values: [{ value: 1, count: 1 }] }),
  ];
  const findings = computeColumnFindings(profiles, 1);
  assert.equal(codes(findings).has("CONSTANT_COLUMN"), false);
});

test("LOW_DIVERSITY: fires for enum-like column (≤3 distinct, >50 rows)", () => {
  const profiles = [
    textProfile("channel", {
      distinct_count: 3,
      top_values: [
        { value: "web", count: 60 },
        { value: "retail", count: 30 },
        { value: "partner", count: 10 },
      ],
    }),
  ];
  const findings = computeColumnFindings(profiles, 100);
  const f = findings.find((x) => x.code === "LOW_DIVERSITY" && x.column === "channel");
  assert.ok(f);
  assert.equal(f!.severity, "info");
});

test("LOW_DIVERSITY: does NOT fire for small tables", () => {
  const profiles = [
    textProfile("channel", {
      distinct_count: 3,
      top_values: [
        { value: "web", count: 10 },
        { value: "retail", count: 5 },
        { value: "partner", count: 2 },
      ],
    }),
  ];
  const findings = computeColumnFindings(profiles, 17);
  assert.equal(codesFor(findings, "channel").has("LOW_DIVERSITY"), false);
});

// ---------------------------------------------------------------------------
// PK-like columns
// ---------------------------------------------------------------------------

test("NON_UNIQUE_PRIMARY_KEY: fires (error) when a PK-like column has duplicates", () => {
  const profiles = [
    numProfile("id", { distinct_count: 3, top_values: [{ value: 1, count: 2 }, { value: 2, count: 1 }, { value: 3, count: 1 }] }),
  ];
  const findings = computeColumnFindings(profiles, 4);
  const f = findings.find((x) => x.code === "NON_UNIQUE_PRIMARY_KEY");
  assert.ok(f);
  assert.equal(f!.severity, "error");
  assert.equal(f!.column, "id");
});

test("NON_UNIQUE_PRIMARY_KEY: does NOT fire when PK-like column is unique", () => {
  const profiles = [
    numProfile("id", { distinct_count: 4, min: 1, max: 4 }),
  ];
  const findings = computeColumnFindings(profiles, 4);
  assert.equal(codesFor(findings, "id").has("NON_UNIQUE_PRIMARY_KEY"), false);
});

test("PK_GAPS_LOWER: fires when numeric PK starts above 1", () => {
  const profiles = [
    numProfile("LocationID", { distinct_count: 5, min: 100, max: 104 }),
  ];
  const findings = computeColumnFindings(profiles, 5);
  const f = findings.find((x) => x.code === "PK_GAPS_LOWER");
  assert.ok(f);
  assert.match(f!.message, /starts at 100/);
});

test("PK_GAPS_UPPER: fires (warning) when numeric PK has a large upper gap", () => {
  // 5 rows but max=1000 → big gap.
  const profiles = [
    numProfile("id", { distinct_count: 5, min: 1, max: 1000 }),
  ];
  const findings = computeColumnFindings(profiles, 5);
  const f = findings.find((x) => x.code === "PK_GAPS_UPPER");
  assert.ok(f);
  assert.equal(f!.severity, "warning");
});

test("PK_GAPS_UPPER: does NOT fire for a contiguous sequence", () => {
  const profiles = [
    numProfile("id", { distinct_count: 5, min: 1, max: 5 }),
  ];
  const findings = computeColumnFindings(profiles, 5);
  assert.equal(codesFor(findings, "id").has("PK_GAPS_UPPER"), false);
});

// ---------------------------------------------------------------------------
// HIGH_CARDINALITY_CATEGORICAL
// ---------------------------------------------------------------------------

test("HIGH_CARDINALITY_CATEGORICAL: fires for free-text columns that are >90% distinct", () => {
  const profiles = [
    textProfile("comment", {
      distinct_count: 95,
      top_values: [
        { value: "alpha", count: 1 },
        { value: "beta", count: 1 },
        { value: "gamma", count: 1 },
      ],
    }),
  ];
  const findings = computeColumnFindings(profiles, 100);
  const f = findings.find((x) => x.code === "HIGH_CARDINALITY_CATEGORICAL");
  assert.ok(f);
});

test("HIGH_CARDINALITY_CATEGORICAL: does NOT fire for name-like columns", () => {
  const profiles = [
    textProfile("zone_name", {
      distinct_count: 95,
      top_values: [
        { value: "alpha", count: 1 },
        { value: "beta", count: 1 },
        { value: "gamma", count: 1 },
      ],
    }),
  ];
  const findings = computeColumnFindings(profiles, 100);
  assert.equal(codesFor(findings, "zone_name").has("HIGH_CARDINALITY_CATEGORICAL"), false);
});

// ---------------------------------------------------------------------------
// POSSIBLE_DIMENSION / POSSIBLE_FACT
// ---------------------------------------------------------------------------

test("POSSIBLE_DIMENSION: fires for a small text-heavy table with a PK-like column", () => {
  // Mirrors the real taxi_zone_lookup shape.
  const profiles = [
    numProfile("LocationID", { distinct_count: 8, min: 1, max: 8 }),
    textProfile("Borough", { distinct_count: 5 }),
    textProfile("Zone", { distinct_count: 6 }),
    textProfile("service_zone", { distinct_count: 3 }),
  ];
  const findings = computeColumnFindings(profiles, 8);
  const f = findings.find((x) => x.code === "POSSIBLE_DIMENSION");
  assert.ok(f, "should look like a dimension table");
  assert.equal(f!.severity, "info");
  assert.match(f!.message, /LocationID/);
});

test("POSSIBLE_DIMENSION: does NOT fire for a large table", () => {
  const profiles = [
    numProfile("id", { distinct_count: 20_000, min: 1, max: 20_000 }),
    textProfile("name", { distinct_count: 19_000 }),
    textProfile("category", { distinct_count: 4 }),
  ];
  const findings = computeColumnFindings(profiles, 20_000);
  assert.equal(codes(findings).has("POSSIBLE_DIMENSION"), false);
});

test("POSSIBLE_FACT: fires for a large table with multiple numerics and an FK-like column", () => {
  const profiles = [
    numProfile("id", { distinct_count: 50_000, min: 1, max: 50_000 }),
    numProfile("LocationID", { distinct_count: 100, min: 1, max: 100 }),
    numProfile("quantity", { distinct_count: 20 }),
    numProfile("unit_price", { distinct_count: 50 }),
    numProfile("revenue", { distinct_count: 5000 }),
  ];
  const findings = computeColumnFindings(profiles, 50_000);
  const f = findings.find((x) => x.code === "POSSIBLE_FACT");
  assert.ok(f, "should look like a fact table");
  assert.equal(f!.severity, "info");
});

test("POSSIBLE_FACT: does NOT fire for small tables", () => {
  const profiles = [
    numProfile("id", { distinct_count: 100, min: 1, max: 100 }),
    numProfile("quantity", { distinct_count: 10 }),
    numProfile("unit_price", { distinct_count: 10 }),
    numProfile("revenue", { distinct_count: 50 }),
  ];
  const findings = computeColumnFindings(profiles, 100);
  assert.equal(codes(findings).has("POSSIBLE_FACT"), false);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("computeColumnFindings: rowCount=0 returns no findings", () => {
  const findings = computeColumnFindings([], 0);
  assert.equal(findings.length, 0);
});

test("computeColumnFindings: empty profiles returns no findings (other than table-level heuristics)", () => {
  const findings = computeColumnFindings([], 100);
  // No columns → no column-level findings. POSSIBLE_DIMENSION needs a PK-like col, so it should not fire either.
  assert.equal(findings.length, 0);
});

test("computeColumnFindings: missing top_values does not crash EDGE_CASE_SENTINEL or DUPLICATE_NAME", () => {
  const profiles: ColumnProfile[] = [
    { name: "Borough", type: "VARCHAR", null_count: 0, null_pct: 0, distinct_count: 0 },
    { name: "Zone", type: "VARCHAR", null_count: 0, null_pct: 0, distinct_count: 0 },
  ];
  // Should not throw.
  const findings = computeColumnFindings(profiles, 100);
  assert.equal(codesFor(findings, "Borough").has("EDGE_CASE_SENTINEL"), false);
  assert.equal(codesFor(findings, "Zone").has("DUPLICATE_NAME"), false);
});

test("computeColumnFindings: produces all 4 expected findings for the real taxi_zone_lookup shape", () => {
  // Mini replica of the real taxi_zone_lookup_mini.csv profile.
  const profiles = [
    numProfile("LocationID", { distinct_count: 8, min: 1, max: 8 }),
    textProfile("Borough", {
      distinct_count: 6,
      top_values: [
        { value: "Manhattan", count: 3 },
        { value: "Queens", count: 1 },
        { value: "Brooklyn", count: 1 },
        { value: "Staten Island", count: 1 },
        { value: "EWR", count: 1 },
        { value: "Unknown", count: 1 },
      ],
    }),
    textProfile("Zone", {
      distinct_count: 6,
      top_values: [
        { value: "Governor's Island/Ellis Island/Liberty Island", count: 3 },
        { value: "Corona", count: 2 },
        { value: "Newark Airport", count: 1 },
        { value: "Jamaica Bay", count: 1 },
        { value: "N/A", count: 1 },
      ],
    }),
    textProfile("service_zone", {
      distinct_count: 3,
      top_values: [
        { value: "Boro Zone", count: 5 },
        { value: "Yellow Zone", count: 3 },
        { value: "EWR", count: 1 },
        { value: "N/A", count: 1 },
      ],
    }),
  ];
  const findings = computeColumnFindings(profiles, 8);
  const f = codes(findings);
  assert.ok(f.has("EDGE_CASE_SENTINEL"), "Borough and service_zone have sentinels");
  assert.ok(f.has("DUPLICATE_NAME"), "Zone has Governor's Island 3x and Corona 2x");
  assert.ok(f.has("POSSIBLE_DIMENSION"), "8-row text-heavy table with PK-like col");
  // service_zone has a single dominant value, so DUPLICATE_NAME must NOT fire there.
  assert.equal(codesFor(findings, "service_zone").has("DUPLICATE_NAME"), false);
});
