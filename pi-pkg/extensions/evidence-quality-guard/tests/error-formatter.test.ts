// Unit tests for error-formatter.ts
//
// Run with: node --experimental-strip-types --test tests/error-formatter.test.ts
//
// These tests verify the error formatting logic that generates
// actionable error messages for the agent.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatValidationErrors,
  formatSingleError,
  formatWarnings,
  formatValidationSuccess,
  formatStaticAnalysisErrors,
  formatCacheStatus,
} from "../error-formatter.ts";
import type { ValidationResult, ValidationError, RenderingIssue } from "../types.ts";

// ---------------------------------------------------------------------------
// formatValidationErrors
// ---------------------------------------------------------------------------

test("formatValidationErrors: formats query_not_validated errors", () => {
  const result: ValidationResult = {
    valid: false,
    errors: [
      {
        type: "query_not_validated",
        message: "SQL block `daily_metrics` has not been run",
        fixHint: "Run via duckdb_run_sql",
        line: 15,
        blockName: "daily_metrics",
      },
    ],
    warnings: [],
    sqlBlocks: [],
    validatedBlocks: [],
    unvalidatedBlocks: ["daily_metrics"],
    emptyBlocks: [],
  };
  
  const formatted = formatValidationErrors(result);
  
  assert.ok(formatted.includes("BLOCKED"), "should include BLOCKED");
  assert.ok(formatted.includes("daily_metrics"), "should include block name");
  assert.ok(formatted.includes("duckdb_run_sql"), "should include fix hint");
  assert.ok(formatted.includes("Line 15"), "should include line number");
});

test("formatValidationErrors: formats query_empty errors", () => {
  const result: ValidationResult = {
    valid: false,
    errors: [
      {
        type: "query_empty",
        message: "SQL block `daily_metrics` returned 0 rows",
        fixHint: "Debug the query",
        line: 15,
        blockName: "daily_metrics",
      },
    ],
    warnings: [],
    sqlBlocks: [],
    validatedBlocks: [],
    unvalidatedBlocks: [],
    emptyBlocks: ["daily_metrics"],
  };
  
  const formatted = formatValidationErrors(result);
  
  assert.ok(formatted.includes("BLOCKED"), "should include BLOCKED");
  assert.ok(formatted.includes("0 rows"), "should mention 0 rows");
  assert.ok(formatted.includes("daily_metrics"), "should include block name");
});

test("formatValidationErrors: formats missing_data_reference errors", () => {
  const result: ValidationResult = {
    valid: false,
    errors: [
      {
        type: "missing_data_reference",
        message: "BarChart references query `nonexistent` which doesn't exist",
        fixHint: "Add a SQL block named `nonexistent`",
        line: 20,
        blockName: "nonexistent",
      },
    ],
    warnings: [],
    sqlBlocks: [],
    validatedBlocks: [],
    unvalidatedBlocks: [],
    emptyBlocks: [],
  };
  
  const formatted = formatValidationErrors(result);
  
  assert.ok(formatted.includes("BLOCKED"), "should include BLOCKED");
  assert.ok(formatted.includes("nonexistent"), "should include query name");
  assert.ok(formatted.includes("BarChart"), "should include component name");
});

test("formatValidationErrors: groups errors by type", () => {
  const result: ValidationResult = {
    valid: false,
    errors: [
      {
        type: "query_not_validated",
        message: "First unvalidated",
        fixHint: "Fix 1",
        line: 10,
        blockName: "query1",
      },
      {
        type: "query_not_validated",
        message: "Second unvalidated",
        fixHint: "Fix 2",
        line: 20,
        blockName: "query2",
      },
      {
        type: "query_empty",
        message: "Empty query",
        fixHint: "Fix 3",
        line: 30,
        blockName: "query3",
      },
    ],
    warnings: [],
    sqlBlocks: [],
    validatedBlocks: [],
    unvalidatedBlocks: ["query1", "query2"],
    emptyBlocks: ["query3"],
  };
  
  const formatted = formatValidationErrors(result);
  
  // Should have sections for each error type
  assert.ok(formatted.includes("Query Not Validated"), "should have Query Not Validated section");
  assert.ok(formatted.includes("Query Returns No Data"), "should have Query Returns No Data section");
});

test("formatValidationErrors: includes required actions", () => {
  const result: ValidationResult = {
    valid: false,
    errors: [
      {
        type: "query_not_validated",
        message: "Unvalidated query",
        fixHint: "Fix it",
        line: 10,
        blockName: "query1",
      },
    ],
    warnings: [],
    sqlBlocks: [],
    validatedBlocks: [],
    unvalidatedBlocks: ["query1"],
    emptyBlocks: [],
  };
  
  const formatted = formatValidationErrors(result);
  
  assert.ok(formatted.includes("Required Actions"), "should include Required Actions section");
  assert.ok(formatted.includes("query1"), "should list unvalidated queries");
});

test("formatValidationErrors: includes common issues table", () => {
  const result: ValidationResult = {
    valid: false,
    errors: [
      {
        type: "query_not_validated",
        message: "Error",
        fixHint: "Fix",
        line: 10,
      },
    ],
    warnings: [],
    sqlBlocks: [],
    validatedBlocks: [],
    unvalidatedBlocks: [],
    emptyBlocks: [],
  };
  
  const formatted = formatValidationErrors(result);
  
  assert.ok(formatted.includes("Common Issues"), "should include Common Issues section");
  assert.ok(formatted.includes("Wrong table name"), "should include common issue");
});

// ---------------------------------------------------------------------------
// formatSingleError
// ---------------------------------------------------------------------------

test("formatSingleError: formats error with line number", () => {
  const error: ValidationError = {
    type: "query_not_validated",
    message: "Query not validated",
    fixHint: "Run via duckdb_run_sql",
    line: 15,
    blockName: "query1",
  };
  
  const formatted = formatSingleError(error);
  
  assert.ok(formatted.includes("Line 15"), "should include line number");
  assert.ok(formatted.includes("query1"), "should include block name");
  assert.ok(formatted.includes("duckdb_run_sql"), "should include fix hint");
});

test("formatSingleError: formats error without line number", () => {
  const error: ValidationError = {
    type: "query_not_validated",
    message: "Query not validated",
    fixHint: "Run via duckdb_run_sql",
  };
  
  const formatted = formatSingleError(error);
  
  assert.ok(formatted.includes("Query not validated"), "should include message");
  assert.ok(!formatted.includes("Line"), "should not include Line when no line number");
});

// ---------------------------------------------------------------------------
// formatWarnings
// ---------------------------------------------------------------------------

test("formatWarnings: formats multiple warnings", () => {
  const warnings = ["Warning 1", "Warning 2", "Warning 3"];
  
  const formatted = formatWarnings(warnings);
  
  assert.ok(formatted.includes("Warning 1"), "should include first warning");
  assert.ok(formatted.includes("Warning 2"), "should include second warning");
  assert.ok(formatted.includes("Warning 3"), "should include third warning");
  assert.ok(formatted.includes("Warnings"), "should include Warnings header");
});

test("formatWarnings: returns empty string for empty warnings", () => {
  const formatted = formatWarnings([]);
  assert.equal(formatted, "", "should return empty string for no warnings");
});

// ---------------------------------------------------------------------------
// formatValidationSuccess
// ---------------------------------------------------------------------------

test("formatValidationSuccess: includes PASSED message", () => {
  const formatted = formatValidationSuccess();
  
  assert.ok(formatted.includes("PASSED"), "should include PASSED");
  assert.ok(formatted.includes("✅"), "should include checkmark");
});

test("formatValidationSuccess: includes all validation checks", () => {
  const formatted = formatValidationSuccess();
  
  assert.ok(formatted.includes("validated"), "should mention validated queries");
  assert.ok(formatted.includes("row_count"), "should mention row_count");
  assert.ok(formatted.includes("rendering"), "should mention rendering issues");
});

// ---------------------------------------------------------------------------
// formatStaticAnalysisErrors
// ---------------------------------------------------------------------------

test("formatStaticAnalysisErrors: formats rendering issues", () => {
  const issues: RenderingIssue[] = [
    { line: 10, message: "Invalid HTML tag", fixHint: "Use valid tag", severity: "error" },
    { line: 20, message: "Potential issue", fixHint: "Check this", severity: "warning" },
  ];
  
  const formatted = formatStaticAnalysisErrors(issues);
  
  assert.ok(formatted.includes("BLOCKED"), "should include BLOCKED");
  assert.ok(formatted.includes("Line 10"), "should include first line");
  assert.ok(formatted.includes("Line 20"), "should include second line");
  assert.ok(formatted.includes("Invalid HTML tag"), "should include first message");
  assert.ok(formatted.includes("Potential issue"), "should include second message");
});

test("formatStaticAnalysisErrors: includes severity icons", () => {
  const issues: RenderingIssue[] = [
    { line: 10, message: "Error issue", fixHint: "Fix", severity: "error" },
    { line: 20, message: "Warning issue", fixHint: "Fix", severity: "warning" },
  ];
  
  const formatted = formatStaticAnalysisErrors(issues);
  
  assert.ok(formatted.includes("❌"), "should include error icon");
  assert.ok(formatted.includes("⚠️"), "should include warning icon");
});

// ---------------------------------------------------------------------------
// formatCacheStatus
// ---------------------------------------------------------------------------

test("formatCacheStatus: formats cache statistics", () => {
  const formatted = formatCacheStatus(42, ["query1", "query2"], ["query3"]);
  
  assert.ok(formatted.includes("42"), "should include total queries");
  assert.ok(formatted.includes("2"), "should include validated count");
  assert.ok(formatted.includes("1"), "should include unvalidated count");
});

test("formatCacheStatus: lists unvalidated blocks", () => {
  const formatted = formatCacheStatus(10, [], ["query1", "query2"]);
  
  assert.ok(formatted.includes("query1"), "should list first unvalidated");
  assert.ok(formatted.includes("query2"), "should list second unvalidated");
  assert.ok(formatted.includes("Unvalidated"), "should include Unvalidated header");
});

test("formatCacheStatus: handles no unvalidated blocks", () => {
  const formatted = formatCacheStatus(10, ["query1", "query2"], []);
  
  assert.ok(formatted.includes("0"), "should show 0 unvalidated");
  // The statistic line "- Unvalidated blocks: 0" is always present
  // but the detailed list header "**Unvalidated blocks:**" should not be
  assert.ok(!formatted.includes("**Unvalidated blocks:**"), "should not show detailed list when empty");
});
