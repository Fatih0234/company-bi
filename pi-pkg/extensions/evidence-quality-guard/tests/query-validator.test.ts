// Unit tests for query-validator.ts
//
// Run with: node --experimental-strip-types --test tests/query-validator.test.ts
//
// These tests verify the core query validation logic that prevents
// silent failures in Evidence dashboards. Every test is written to
// fail if the corresponding behavior did not exist.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeQuery,
  getQueryHash,
  createQueryCache,
  recordQueryValidation,
  getValidatedQuery,
  isQueryValidated,
  queryHasData,
  clearExpiredEntries,
  clearCache,
  serializeCache,
  deserializeCache,
  extractValidationFromResponse,
  parseDuckDbResponse,
} from "../query-validator.ts";
import type { DuckDbRunSqlResponse, QueryCache } from "../types.ts";

// ---------------------------------------------------------------------------
// normalizeQuery
// ---------------------------------------------------------------------------

test("normalizeQuery: collapses whitespace", () => {
  const result = normalizeQuery("  SELECT   *   FROM   trips  ");
  assert.equal(result, "select * from trips");
});

test("normalizeQuery: lowercases keywords", () => {
  const result = normalizeQuery("SELECT * FROM Trips WHERE Date = '2024-01-01'");
  assert.equal(result, "select * from trips where date = '2024-01-01'");
});

test("normalizeQuery: removes single-line comments", () => {
  const result = normalizeQuery("SELECT * -- this is a comment\nFROM trips");
  assert.equal(result, "select * from trips");
});

test("normalizeQuery: removes multi-line comments", () => {
  const result = normalizeQuery("SELECT /* comment */ * FROM trips");
  assert.equal(result, "select * from trips");
});

test("normalizeQuery: handles complex SQL with mixed whitespace", () => {
  const sql = `
    SELECT
      pickup_date,
      COUNT(*) as trip_count
    FROM
      trips
    WHERE
      date >= '2024-01-01'
      AND date <= '2024-01-31'
    GROUP BY
      pickup_date
  `;
  const result = normalizeQuery(sql);
  assert.equal(result, "select pickup_date, count(*) as trip_count from trips where date >= '2024-01-01' and date <= '2024-01-31' group by pickup_date");
});

test("normalizeQuery: empty string returns empty string", () => {
  assert.equal(normalizeQuery(""), "");
});

test("normalizeQuery: whitespace-only returns empty string", () => {
  assert.equal(normalizeQuery("   \n\t  "), "");
});

// ---------------------------------------------------------------------------
// getQueryHash
// ---------------------------------------------------------------------------

test("getQueryHash: same normalized queries produce same hash", () => {
  const hash1 = getQueryHash("SELECT * FROM trips");
  const hash2 = getQueryHash("  SELECT  *  FROM  trips  ");
  assert.equal(hash1, hash2);
});

test("getQueryHash: different queries produce different hashes", () => {
  const hash1 = getQueryHash("SELECT * FROM trips");
  const hash2 = getQueryHash("SELECT * FROM zones");
  assert.notEqual(hash1, hash2);
});

test("getQueryHash: case-insensitive matching", () => {
  const hash1 = getQueryHash("SELECT * FROM Trips");
  const hash2 = getQueryHash("select * from trips");
  assert.equal(hash1, hash2);
});

test("getQueryHash: comment removal affects hash", () => {
  const hash1 = getQueryHash("SELECT * FROM trips");
  const hash2 = getQueryHash("SELECT * FROM trips -- comment");
  // After comment removal, these should be identical
  assert.equal(hash1, hash2);
});

// ---------------------------------------------------------------------------
// createQueryCache
// ---------------------------------------------------------------------------

test("createQueryCache: creates empty cache", () => {
  const cache = createQueryCache();
  assert.equal(cache.queries.size, 0);
  assert.ok(cache.lastUpdated > 0);
});

// ---------------------------------------------------------------------------
// recordQueryValidation
// ---------------------------------------------------------------------------

test("recordQueryValidation: stores query in cache", () => {
  const cache = createQueryCache();
  const sql = "SELECT COUNT(*) FROM trips";
  
  recordQueryValidation(cache, sql, 1000, ["count"]);
  
  assert.equal(cache.queries.size, 1);
  const hash = getQueryHash(sql);
  assert.ok(cache.queries.has(hash));
});

test("recordQueryValidation: stores correct metadata", () => {
  const cache = createQueryCache();
  const sql = "SELECT COUNT(*) as cnt FROM trips";
  
  const validated = recordQueryValidation(cache, sql, 500, ["cnt"], "query-123");
  
  assert.equal(validated.rowCount, 500);
  assert.deepEqual(validated.columns, ["cnt"]);
  assert.equal(validated.queryId, "query-123");
  assert.equal(validated.sql, sql);
  assert.ok(validated.validatedAt > 0);
});

test("recordQueryValidation: overwrites existing entry with same query", () => {
  const cache = createQueryCache();
  const sql = "SELECT COUNT(*) FROM trips";
  
  recordQueryValidation(cache, sql, 100, ["count"]);
  recordQueryValidation(cache, sql, 200, ["count"]);
  
  assert.equal(cache.queries.size, 1);
  const validated = getValidatedQuery(cache, sql);
  assert.equal(validated?.rowCount, 200);
});

test("recordQueryValidation: stores different queries separately", () => {
  const cache = createQueryCache();
  
  recordQueryValidation(cache, "SELECT COUNT(*) FROM trips", 100, ["count"]);
  recordQueryValidation(cache, "SELECT COUNT(*) FROM zones", 200, ["count"]);
  
  assert.equal(cache.queries.size, 2);
});

// ---------------------------------------------------------------------------
// getValidatedQuery
// ---------------------------------------------------------------------------

test("getValidatedQuery: returns null for unknown query", () => {
  const cache = createQueryCache();
  const result = getValidatedQuery(cache, "SELECT * FROM trips");
  assert.equal(result, null);
});

test("getValidatedQuery: returns validated query for known query", () => {
  const cache = createQueryCache();
  const sql = "SELECT * FROM trips";
  
  recordQueryValidation(cache, sql, 100, ["col1"]);
  
  const result = getValidatedQuery(cache, sql);
  assert.ok(result !== null);
  assert.equal(result?.rowCount, 100);
});

test("getValidatedQuery: matches normalized query", () => {
  const cache = createQueryCache();
  const sql = "SELECT * FROM trips";
  
  recordQueryValidation(cache, sql, 100, ["col1"]);
  
  // Query with different whitespace should still match
  const result = getValidatedQuery(cache, "  SELECT  *  FROM  trips  ");
  assert.ok(result !== null);
});

// ---------------------------------------------------------------------------
// isQueryValidated
// ---------------------------------------------------------------------------

test("isQueryValidated: returns false for unknown query", () => {
  const cache = createQueryCache();
  assert.equal(isQueryValidated(cache, "SELECT * FROM trips"), false);
});

test("isQueryValidated: returns true for validated query", () => {
  const cache = createQueryCache();
  const sql = "SELECT * FROM trips";
  
  recordQueryValidation(cache, sql, 100, ["col1"]);
  
  assert.equal(isQueryValidated(cache, sql), true);
});

// ---------------------------------------------------------------------------
// queryHasData
// ---------------------------------------------------------------------------

test("queryHasData: returns false for unknown query", () => {
  const cache = createQueryCache();
  assert.equal(queryHasData(cache, "SELECT * FROM trips"), false);
});

test("queryHasData: returns false for query with 0 rows", () => {
  const cache = createQueryCache();
  const sql = "SELECT * FROM trips WHERE 1=0";
  
  recordQueryValidation(cache, sql, 0, []);
  
  assert.equal(queryHasData(cache, sql), false);
});

test("queryHasData: returns true for query with data", () => {
  const cache = createQueryCache();
  const sql = "SELECT * FROM trips";
  
  recordQueryValidation(cache, sql, 100, ["col1"]);
  
  assert.equal(queryHasData(cache, sql), true);
});

// ---------------------------------------------------------------------------
// clearExpiredEntries
// ---------------------------------------------------------------------------

test("clearExpiredEntries: removes expired entries", () => {
  const cache = createQueryCache();
  const sql = "SELECT * FROM trips";
  
  recordQueryValidation(cache, sql, 100, ["col1"]);
  
  // Manually set validatedAt to past (beyond expiry)
  const hash = getQueryHash(sql);
  const entry = cache.queries.get(hash)!;
  entry.validatedAt = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
  
  const removed = clearExpiredEntries(cache);
  
  assert.equal(removed, 1);
  assert.equal(cache.queries.size, 0);
});

test("clearExpiredEntries: keeps valid entries", () => {
  const cache = createQueryCache();
  const sql = "SELECT * FROM trips";
  
  recordQueryValidation(cache, sql, 100, ["col1"]);
  
  const removed = clearExpiredEntries(cache);
  
  assert.equal(removed, 0);
  assert.equal(cache.queries.size, 1);
});

// ---------------------------------------------------------------------------
// clearCache
// ---------------------------------------------------------------------------

test("clearCache: removes all entries", () => {
  const cache = createQueryCache();
  
  recordQueryValidation(cache, "SELECT * FROM trips", 100, ["col1"]);
  recordQueryValidation(cache, "SELECT * FROM zones", 200, ["col2"]);
  
  assert.equal(cache.queries.size, 2);
  
  clearCache(cache);
  
  assert.equal(cache.queries.size, 0);
});

// ---------------------------------------------------------------------------
// serializeCache / deserializeCache
// ---------------------------------------------------------------------------

test("serializeCache: produces valid JSON", () => {
  const cache = createQueryCache();
  recordQueryValidation(cache, "SELECT * FROM trips", 100, ["col1"]);
  
  const json = serializeCache(cache);
  const parsed = JSON.parse(json);
  
  assert.ok(Array.isArray(parsed.queries));
  assert.equal(parsed.queries.length, 1);
  assert.ok(parsed.lastUpdated > 0);
});

test("deserializeCache: restores cache from JSON", () => {
  const original = createQueryCache();
  recordQueryValidation(original, "SELECT * FROM trips", 100, ["col1"]);
  
  const json = serializeCache(original);
  const restored = deserializeCache(json);
  
  assert.equal(restored.queries.size, 1);
  const validated = getValidatedQuery(restored, "SELECT * FROM trips");
  assert.ok(validated !== null);
  assert.equal(validated?.rowCount, 100);
});

test("deserializeCache: handles invalid JSON gracefully", () => {
  const cache = deserializeCache("not valid json");
  assert.equal(cache.queries.size, 0);
});

test("deserializeCache: handles empty object gracefully", () => {
  const cache = deserializeCache("{}");
  assert.equal(cache.queries.size, 0);
});

// ---------------------------------------------------------------------------
// extractValidationFromResponse
// ---------------------------------------------------------------------------

test("extractValidationFromResponse: extracts data from successful response", () => {
  const response: DuckDbRunSqlResponse = {
    ok: true,
    columns: ["count"],
    rows: [{ count: 100 }],
    row_count: 100,
    elapsed_ms: 50,
    truncated: false,
    query_id: "q-123",
  };
  
  const result = extractValidationFromResponse("SELECT COUNT(*)", response);
  
  assert.ok(result !== null);
  assert.equal(result?.rowCount, 100);
  assert.deepEqual(result?.columns, ["count"]);
  assert.equal(result?.queryId, "q-123");
});

test("extractValidationFromResponse: returns null for failed response", () => {
  const response: DuckDbRunSqlResponse = {
    ok: false,
    columns: [],
    rows: [],
    row_count: 0,
    elapsed_ms: 10,
    truncated: false,
    query_id: "q-456",
    error: { code: "SQL_ERROR", message: "Table not found" },
  };
  
  const result = extractValidationFromResponse("SELECT *", response);
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// parseDuckDbResponse
// ---------------------------------------------------------------------------

test("parseDuckDbResponse: parses valid response", () => {
  const content = JSON.stringify({
    ok: true,
    columns: ["count"],
    rows: [{ count: 100 }],
    row_count: 100,
    elapsed_ms: 50,
    truncated: false,
    query_id: "q-123",
  });
  
  const result = parseDuckDbResponse(content);
  assert.ok(result !== null);
  assert.equal(result?.row_count, 100);
});

test("parseDuckDbResponse: returns null for invalid JSON", () => {
  const result = parseDuckDbResponse("not json");
  assert.equal(result, null);
});

test("parseDuckDbResponse: returns null for missing row_count", () => {
  const content = JSON.stringify({ ok: true, columns: [] });
  const result = parseDuckDbResponse(content);
  assert.equal(result, null);
});

test("parseDuckDbResponse: returns null for non-object input", () => {
  const result = parseDuckDbResponse('"string"');
  assert.equal(result, null);
});
