/**
 * Evidence Quality Guard - Query Validator
 *
 * Tracks SQL queries validated via duckdb_run_sql and ensures
 * queries return data before being embedded in pages.
 */

import type {
  ValidatedQuery,
  QueryCache,
  SqlBlock,
  DuckDbRunSqlResponse,
} from './types.ts';
import {
  VALIDATION_CACHE_KEY,
  MAX_CACHED_QUERIES,
  CACHE_EXPIRY_MS,
} from './types.ts';

// ── Query Hash Normalization ────────────────────────────────────────

/**
 * Normalize SQL query for consistent hashing.
 * - Collapse whitespace
 * - Lowercase keywords
 * - Remove comments
 * - Trim
 */
export function normalizeQuery(sql: string): string {
  return sql
    // Remove single-line comments
    .replace(/--.*$/gm, '')
    // Remove multi-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    // Lowercase
    .toLowerCase()
    // Trim
    .trim();
}

/**
 * Generate a hash for a SQL query.
 * Uses a simple but effective approach for deduplication.
 */
export function getQueryHash(sql: string): string {
  const normalized = normalizeQuery(sql);
  // Simple hash - for our purposes, the normalized string is sufficient
  // as a cache key. We don't need cryptographic strength.
  return normalized;
}

// ── Query Cache Operations ──────────────────────────────────────────

/**
 * Create a new empty query cache.
 */
export function createQueryCache(): QueryCache {
  return {
    queries: new Map(),
    lastUpdated: Date.now(),
  };
}

/**
 * Record a validated query in the cache.
 */
export function recordQueryValidation(
  cache: QueryCache,
  sql: string,
  rowCount: number,
  columns: string[],
  queryId?: string,
): ValidatedQuery {
  const hash = getQueryHash(sql);
  
  const validated: ValidatedQuery = {
    queryHash: hash,
    sql: sql.trim(),
    rowCount,
    columns,
    validatedAt: Date.now(),
    queryId,
  };
  
  cache.queries.set(hash, validated);
  cache.lastUpdated = Date.now();
  
  // Evict old entries if cache is too large
  if (cache.queries.size > MAX_CACHED_QUERIES) {
    evictOldEntries(cache);
  }
  
  return validated;
}

/**
 * Check if a query is validated and returns data.
 */
export function getValidatedQuery(
  cache: QueryCache,
  sql: string,
): ValidatedQuery | null {
  const hash = getQueryHash(sql);
  const validated = cache.queries.get(hash);
  
  if (!validated) {
    return null;
  }
  
  // Check if cache entry has expired
  if (Date.now() - validated.validatedAt > CACHE_EXPIRY_MS) {
    cache.queries.delete(hash);
    return null;
  }
  
  return validated;
}

/**
 * Check if a query is validated (regardless of row count).
 */
export function isQueryValidated(cache: QueryCache, sql: string): boolean {
  return getValidatedQuery(cache, sql) !== null;
}

/**
 * Check if a query returns data.
 */
export function queryHasData(cache: QueryCache, sql: string): boolean {
  const validated = getValidatedQuery(cache, sql);
  return validated !== null && validated.rowCount > 0;
}

/**
 * Evict oldest entries when cache is full.
 */
function evictOldEntries(cache: QueryCache): void {
  const entries = Array.from(cache.queries.entries());
  
  // Sort by validatedAt ascending (oldest first)
  entries.sort((a, b) => a[1].validatedAt - b[1].validatedAt);
  
  // Remove oldest 10%
  const toRemove = Math.ceil(entries.length * 0.1);
  for (let i = 0; i < toRemove; i++) {
    cache.queries.delete(entries[i][0]);
  }
}

/**
 * Clear expired entries from cache.
 */
export function clearExpiredEntries(cache: QueryCache): number {
  const now = Date.now();
  let removed = 0;
  
  for (const [hash, query] of cache.queries) {
    if (now - query.validatedAt > CACHE_EXPIRY_MS) {
      cache.queries.delete(hash);
      removed++;
    }
  }
  
  cache.lastUpdated = now;
  return removed;
}

/**
 * Clear all entries from cache.
 */
export function clearCache(cache: QueryCache): void {
  cache.queries.clear();
  cache.lastUpdated = Date.now();
}

// ── Cache Serialization ─────────────────────────────────────────────

/**
 * Serialize cache to JSON for storage.
 */
export function serializeCache(cache: QueryCache): string {
  const entries = Array.from(cache.queries.entries());
  return JSON.stringify({
    queries: entries.map(([hash, query]) => [hash, query]),
    lastUpdated: cache.lastUpdated,
  });
}

/**
 * Deserialize cache from JSON.
 */
export function deserializeCache(json: string): QueryCache {
  try {
    const data = JSON.parse(json);
    const cache: QueryCache = {
      queries: new Map(),
      lastUpdated: data.lastUpdated || Date.now(),
    };
    
    if (Array.isArray(data.queries)) {
      for (const [hash, query] of data.queries) {
        cache.queries.set(hash, query);
      }
    }
    
    return cache;
  } catch {
    return createQueryCache();
  }
}

// ── Validation from duckdb_run_sql Response ─────────────────────────

/**
 * Extract validation info from a duckdb_run_sql response.
 */
export function extractValidationFromResponse(
  sql: string,
  response: DuckDbRunSqlResponse,
): { rowCount: number; columns: string[]; queryId: string } | null {
  if (!response.ok) {
    return null;
  }
  
  return {
    rowCount: response.row_count,
    columns: response.columns,
    queryId: response.query_id,
  };
}

/**
 * Parse a duckdb_run_sql result from tool_result details.
 * Accepts either a string (JSON) or an object (already parsed).
 */
export function parseDuckDbResponse(
  details: string | Record<string, unknown>,
): DuckDbRunSqlResponse | null {
  try {
    let response: unknown;
    
    if (typeof details === 'string') {
      response = JSON.parse(details);
    } else if (typeof details === 'object' && details !== null) {
      response = details;
    } else {
      return null;
    }
    
    if (typeof response === 'object' && response !== null && 'row_count' in response) {
      return response as DuckDbRunSqlResponse;
    }
    return null;
  } catch {
    return null;
  }
}
