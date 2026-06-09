/**
 * Evidence Quality Guard Extension
 *
 * Unified extension that prevents silent failures in Evidence dashboards
 * by enforcing validation at multiple checkpoints.
 *
 * Features:
 * - Query validation: Ensures SQL queries are run via duckdb_run_sql before page writes
 * - Empty dataset detection: Ensures queries return data (row_count > 0)
 * - Static analysis: Detects Svelte/HTML rendering issues
 * - Hard block: Prevents page writes until all validations pass
 *
 * Usage:
 * - Place in .pi/extensions/ for auto-discovery
 * - Or load via pi -e ./evidence-quality-guard/index.ts
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

import { StateManager, getStateManager } from './state-manager.ts';
import { ValidationEngine, getValidationEngine } from './validation-engine.ts';
import {
  parseDuckDbResponse,
  extractValidationFromResponse,
} from './query-validator.ts';
import { extractSqlBlocks } from './empty-dataset-detector.ts';
import {
  formatCacheStatus,
  formatValidationErrors,
  formatStaticAnalysisErrors,
} from './error-formatter.ts';
import type { ValidationResult, RenderingIssue } from './types.ts';

// ── Constants ───────────────────────────────────────────────────────

const EXTENSION_NAME = 'evidence-quality-guard';
const TOOL_NAMES = {
  duckdbRunSql: 'duckdb_run_sql',
  write: 'write',
  edit: 'edit',
  bash: 'bash',
} as const;

// ── Bash Command Patterns ─────────────────────────────────────────

/**
 * Extract target file paths from a bash command that writes to files.
 */
function extractTargetFilesFromCommand(command: string): string[] {
  const files: string[] = [];
  
  // cat > file or cat > file << 'EOF'
  const catMatch = command.match(/cat\s*(?:-[aA])?\s*>\s*([^\s<]+)/);
  if (catMatch) files.push(catMatch[1]);
  
  // echo "..." > file
  const echoMatch = command.match(/echo\s["']?.*["']?\s*>\s*([^\s<]+)/);
  if (echoMatch) files.push(echoMatch[1]);
  
  // tee file
  const teeMatch = command.match(/tee\s+([^\s<]+)/);
  if (teeMatch) files.push(teeMatch[1]);
  
  // cp source dest (only if dest is .md in pages/)
  const cpMatch = command.match(/cp\s+\S+\s+(\S+)/);
  if (cpMatch) files.push(cpMatch[1]);
  
  // mv source dest (only if dest is .md in pages/)
  const mvMatch = command.match(/mv\s+\S+\s+(\S+)/);
  if (mvMatch) files.push(mvMatch[1]);
  
  // printf '...' > file
  const printfMatch = command.match(/printf\s["']?.*["']?\s*>\s*([^\s<]+)/);
  if (printfMatch) files.push(printfMatch[1]);
  
  return files;
}

// ── Main Extension ──────────────────────────────────────────────────

export default function evidenceQualityGuardExtension(pi: ExtensionAPI) {
  let stateManager: StateManager;
  let validationEngine: ValidationEngine;
  
  // ── Session Start ───────────────────────────────────────────────
  
  pi.on('session_start', async (event, ctx) => {
    stateManager = getStateManager(pi);
    validationEngine = getValidationEngine(pi);
    
    await validationEngine.initialize(ctx);
    
    if (ctx.hasUI) {
      const stats = stateManager.getStats();
      ctx.ui.notify(
        `${EXTENSION_NAME} active (${stats.totalQueries} cached queries)`,
        'info',
      );
    }
  });
  
  // ── Track duckdb_run_sql Results ────────────────────────────────
  
  pi.on('tool_result', async (event, ctx) => {
    // Only process duckdb_run_sql results
    if (event.toolName !== TOOL_NAMES.duckdbRunSql) {
      return;
    }
    
    // Parse the response
    const response = parseDuckDbResponse(event.content);
    if (!response) {
      return;
    }
    
    // Get the SQL from the input
    const sql = event.input?.sql;
    if (!sql || typeof sql !== 'string') {
      return;
    }
    
    // Extract validation info
    const validation = extractValidationFromResponse(sql, response);
    if (!validation) {
      // Query failed - don't record
      return;
    }
    
    // Record the validation
    stateManager.recordValidation(
      sql,
      validation.rowCount,
      validation.columns,
      validation.queryId,
    );
    
    // Log to agent
    if (ctx.hasUI && validation.rowCount === 0) {
      ctx.ui.notify(
        `⚠️ Query returned 0 rows - will block page writes using this query`,
        'warning',
      );
    }
  });
  
  // ── Validate Page Writes ────────────────────────────────────────
  
  /**
   * Validate a page file and return error if validation fails.
   */
  async function validateAndBlockIfNeeded(
    filePath: string,
    ctx: ExtensionContext,
  ): Promise<{ allowed: boolean; response?: { content: Array<{ type: string; text: string }>; isError: boolean } }> {
    // Only validate .md files in pages/ directories
    if (!filePath.endsWith('.md') || !filePath.includes('/pages/')) {
      return { allowed: true };
    }
    
    // Check if file exists
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      return { allowed: true };
    }
    
    // Read the file content
    let content: string;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch {
      return { allowed: true };
    }
    
    // Run validation
    const { allowed, result, staticErrors } = await validationEngine.validatePageWrite(
      filePath,
      content,
      ctx,
    );
    
    if (!allowed) {
      // BLOCK: Return error with EXACT instructions
      const errorMessage = validationEngine.formatResultWithInstructions(
        filePath,
        content,
        result,
        staticErrors,
      );
      
      return {
        allowed: false,
        response: {
          content: [{ type: 'text', text: errorMessage }],
          isError: true,
        },
      };
    }
    
    // PASSED: Allow write to proceed
    if (ctx.hasUI) {
      const stats = stateManager.getStats();
      const sqlBlocks = extractSqlBlocks(content);
      
      if (sqlBlocks.length > 0) {
        ctx.ui.notify(
          `✅ Page validated (${sqlBlocks.length} queries, ${stats.totalQueries} cached)`,
          'info',
        );
      }
    }
    
    return { allowed: true };
  }
  
  pi.on('tool_result', async (event, ctx) => {
    // Process write/edit tools
    if (event.toolName === TOOL_NAMES.write || event.toolName === TOOL_NAMES.edit) {
      const filePath = event.input?.path;
      if (!filePath || typeof filePath !== 'string') {
        return;
      }
      
      const { allowed, response } = await validateAndBlockIfNeeded(filePath, ctx);
      if (!allowed && response) {
        return response;
      }
    }
    
    // Process bash tool calls that write to .md files
    if (event.toolName === TOOL_NAMES.bash) {
      const command = event.input?.command || '';
      const targetFiles = extractTargetFilesFromCommand(command);
      
      for (const filePath of targetFiles) {
        const { allowed, response } = await validateAndBlockIfNeeded(filePath, ctx);
        if (!allowed && response) {
          return response;
        }
      }
    }
  });
  
  // ── Register Helper Command ─────────────────────────────────────
  
  pi.registerCommand('evidence-quality-status', {
    description: 'Show Evidence Quality Guard status and cache info',
    handler: async (args, ctx) => {
      const stats = stateManager.getStats();
      
      const lines = [
        '## Evidence Quality Guard Status',
        '',
        `**Cached queries:** ${stats.totalQueries}`,
        `**Last updated:** ${new Date(stats.lastUpdated).toISOString()}`,
        '',
        '### Commands',
        '- `/evidence-quality-status` - Show this status',
        '- `/evidence-quality-clear-cache` - Clear the query cache',
        '',
      ];
      
      ctx.ui.notify(lines.join('\n'), 'info');
    },
  });
  
  pi.registerCommand('evidence-quality-clear-cache', {
    description: 'Clear the Evidence Quality Guard query cache',
    handler: async (args, ctx) => {
      stateManager.clearCache();
      ctx.ui.notify('Query cache cleared', 'info');
    },
  });
  
  // ── Register Validation Tool ────────────────────────────────────
  
  pi.registerTool({
    name: 'evidence_validate_page',
    label: 'Evidence: Validate Page',
    description:
      'Validate an Evidence page for query validation and rendering issues. ' +
      'Use this to check if a page is ready to be written.',
    promptSnippet: 'Validate an Evidence page before writing',
    promptGuidelines: [
      'Use evidence_validate_page to check if a page has all queries validated before writing.',
      'Call evidence_validate_page after running queries via duckdb_run_sql but before writing the page.',
    ],
    parameters: Type.Object({
      path: Type.String({ description: 'Path to the .md file to validate' }),
    }),
    
    async execute(_toolCallId, params, _signal, onUpdate, ctx) {
      const filePath = params.path;
      
      // Check if file exists
      if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        return {
          content: [{ type: 'text', text: `File not found: ${filePath}` }],
          details: { error: 'File not found' },
        };
      }
      
      // Read file content
      let content: string;
      try {
        content = readFileSync(filePath, 'utf8');
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error reading file: ${err}` }],
          details: { error: String(err) },
        };
      }
      
      onUpdate?.({
        content: [{ type: 'text', text: `Validating ${filePath}...` }],
      });
      
      // Run validation
      const { allowed, result, staticErrors } = await validationEngine.validatePageWrite(
        filePath,
        content,
        ctx,
      );
      
      const formatted = validationEngine.formatResult(allowed, result, staticErrors);
      
      return {
        content: [{ type: 'text', text: formatted }],
        details: {
          allowed,
          validationResult: result,
          staticErrors,
        },
      };
    },
  });
}

// ── Re-exports for testing ──────────────────────────────────────────

export { StateManager, getStateManager, resetStateManager } from './state-manager.js';
export { ValidationEngine, getValidationEngine, resetValidationEngine } from './validation-engine.js';
export * from './query-validator.js';
export * from './empty-dataset-detector.js';
export * from './static-analysis.js';
export * from './error-formatter.js';
export * from './types.js';
