/**
 * Evidence Quality Guard - Validation Engine
 *
 * Unified validation pipeline that coordinates all quality checks.
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type {
  ValidationResult,
  ValidationError,
  RenderingIssue,
  SqlBlock,
} from './types.ts';
import { StateManager, getStateManager } from './state-manager.ts';
import { extractSqlBlocks, validatePageContent } from './empty-dataset-detector.ts';
import { analyzeEvidenceMarkdown, renderingIssuesToErrors } from './static-analysis.ts';
import {
  formatValidationErrors,
  formatStaticAnalysisErrors,
  formatValidationSuccess,
} from './error-formatter.ts';

// ── Validation Engine Class ─────────────────────────────────────────

export class ValidationEngine {
  private stateManager: StateManager;
  private pi: ExtensionAPI;
  
  constructor(pi: ExtensionAPI) {
    this.pi = pi;
    this.stateManager = getStateManager(pi);
  }
  
  /**
   * Initialize the validation engine.
   */
  async initialize(ctx: ExtensionContext): Promise<void> {
    await this.stateManager.initialize(ctx);
  }
  
  /**
   * Validate a page write operation.
   * Returns null if validation passes, or error result if blocked.
   */
  async validatePageWrite(
    filePath: string,
    content: string,
    ctx: ExtensionContext,
  ): Promise<{ allowed: boolean; result?: ValidationResult; staticErrors?: RenderingIssue[] }> {
    // Only validate .md files in pages/ directories
    if (!filePath.endsWith('.md') || !filePath.includes('/pages/')) {
      return { allowed: true };
    }
    
    // Check if file exists and is accessible
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      return { allowed: true };
    }
    
    // Run static analysis first (faster, no external dependencies)
    const staticIssues = analyzeEvidenceMarkdown(content);
    const staticErrors = staticIssues.filter(i => i.severity === 'error');
    
    if (staticErrors.length > 0) {
      return {
        allowed: false,
        staticErrors: staticIssues,
      };
    }
    
    // Validate SQL blocks against query cache
    const validationResult = validatePageContent(content, this.stateManager.getCache());
    
    if (!validationResult.valid) {
      return {
        allowed: false,
        result: validationResult,
      };
    }
    
    // All validations passed
    return { allowed: true };
  }
  
  /**
   * Format validation result for display.
   */
  formatResult(
    allowed: boolean,
    result?: ValidationResult,
    staticErrors?: RenderingIssue[],
  ): string {
    if (allowed) {
      return formatValidationSuccess();
    }
    
    if (staticErrors && staticErrors.length > 0) {
      return formatStaticAnalysisErrors(staticErrors);
    }
    
    if (result) {
      return formatValidationErrors(result);
    }
    
    return 'Unknown validation error';
  }
  
  /**
   * Format validation result with EXACT instructions for the agent.
   * This shows the exact SQL to run and the exact command to use.
   */
  formatResultWithInstructions(
    filePath: string,
    content: string,
    result?: ValidationResult,
    staticErrors?: RenderingIssue[],
  ): string {
    const lines: string[] = [];
    
    lines.push('## ❌ PAGE WRITE BLOCKED — Follow These Steps Exactly');
    lines.push('');
    lines.push('You CANNOT write this page until you complete these steps:');
    lines.push('');
    lines.push('### Step 1: Run Each Query via `duckdb_run_sql`');
    lines.push('');
    lines.push('Copy and run EXACTLY these commands (one by one):');
    lines.push('');
    
    // Extract SQL blocks from the page
    const sqlBlocks = extractSqlBlocks(content);
    
    for (const block of sqlBlocks) {
      const isUnvalidated = result?.unvalidatedBlocks.includes(block.name);
      const isEmpty = result?.emptyBlocks.includes(block.name);
      
      if (isUnvalidated || isEmpty) {
        lines.push(`#### Query: \`${block.name}\``);
        lines.push('');
        lines.push('```sql');
        lines.push(block.sql);
        lines.push('```');
        lines.push('');
        lines.push('Run this via `duckdb_run_sql` with the SQL above.');
        lines.push('');
      }
    }
    
    lines.push('### Step 2: Re-write the Page');
    lines.push('');
    lines.push('After running ALL queries above, write the page again.');
    lines.push('');
    lines.push('---');
    lines.push('');
    
    // Add the detailed error info
    if (staticErrors && staticErrors.length > 0) {
      lines.push(formatStaticAnalysisErrors(staticErrors));
    } else if (result) {
      lines.push(formatValidationErrors(result));
    }
    
    return lines.join('\n');
  }
}

// ── Singleton Instance ──────────────────────────────────────────────

let instance: ValidationEngine | null = null;

/**
 * Get or create the singleton ValidationEngine instance.
 */
export function getValidationEngine(pi: ExtensionAPI): ValidationEngine {
  if (!instance) {
    instance = new ValidationEngine(pi);
  }
  return instance;
}

/**
 * Reset the singleton instance (for testing).
 */
export function resetValidationEngine(): void {
  instance = null;
}
