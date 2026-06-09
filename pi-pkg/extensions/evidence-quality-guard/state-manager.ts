/**
 * Evidence Quality Guard - State Manager
 *
 * Manages persistent state for the quality guard extension.
 * Handles query cache storage and retrieval across sessions.
 */

import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { QueryCache, ValidatedQuery } from './types.ts';
import {
  VALIDATION_CACHE_KEY,
} from './types.ts';
import {
  createQueryCache,
  serializeCache,
  deserializeCache,
  recordQueryValidation,
  clearExpiredEntries,
  getQueryHash,
  getValidatedQuery,
} from './query-validator.ts';

// ── State Manager Class ─────────────────────────────────────────────

export class StateManager {
  private cache: QueryCache;
  pi: ExtensionAPI;
  private initialized = false;
  
  constructor(pi: ExtensionAPI) {
    this.pi = pi;
    this.cache = createQueryCache();
  }
  
  /**
   * Initialize state from session entries.
   * Call this during session_start.
   */
  async initialize(ctx: ExtensionContext): Promise<void> {
    if (this.initialized) return;
    
    // Restore cache from session entries
    for (const entry of ctx.sessionManager.getEntries()) {
      if (entry.type === 'custom' && entry.customType === VALIDATION_CACHE_KEY) {
        const data = entry.data as { cacheJson?: string } | undefined;
        if (data?.cacheJson) {
          this.cache = deserializeCache(data.cacheJson);
          break;
        }
      }
    }
    
    // Clear expired entries
    clearExpiredEntries(this.cache);
    
    this.initialized = true;
  }
  
  /**
   * Get the current query cache.
   */
  getCache(): QueryCache {
    return this.cache;
  }
  
  /**
   * Record a validated query.
   */
  recordValidation(
    sql: string,
    rowCount: number,
    columns: string[],
    queryId?: string,
  ): ValidatedQuery {
    const validated = recordQueryValidation(this.cache, sql, rowCount, columns, queryId);
    this.persistCache();
    return validated;
  }
  
  /**
   * Check if a query is validated.
   */
  isQueryValidated(sql: string): boolean {
    const hash = getQueryHash(sql);
    return this.cache.queries.has(hash);
  }
  
  /**
   * Get validation info for a query.
   */
  getValidation(sql: string): ValidatedQuery | null {
    return getValidatedQuery(this.cache, sql);
  }
  
  /**
   * Clear all cached data.
   */
  clearCache(): void {
    this.cache = createQueryCache();
    this.persistCache();
  }
  
  /**
   * Get cache statistics.
   */
  getStats(): { totalQueries: number; lastUpdated: number } {
    return {
      totalQueries: this.cache.queries.size,
      lastUpdated: this.cache.lastUpdated,
    };
  }
  
  /**
   * Persist cache to session entries.
   */
  private persistCache(): void {
    const cacheJson = serializeCache(this.cache);
    this.pi.appendEntry(VALIDATION_CACHE_KEY, { cacheJson });
  }
}

// ── Singleton Instance ──────────────────────────────────────────────

let instance: StateManager | null = null;

/**
 * Get or create the singleton StateManager instance.
 * Updates the pi reference if the extension is reloaded with a new session.
 */
export function getStateManager(pi: ExtensionAPI): StateManager {
  if (!instance) {
    instance = new StateManager(pi);
  } else {
    // Update pi reference when extension is reloaded (new session)
    instance.pi = pi;
  }
  return instance;
}

/**
 * Reset the singleton instance (for testing).
 */
export function resetStateManager(): void {
  instance = null;
}
