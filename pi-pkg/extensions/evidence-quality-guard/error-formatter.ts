/**
 * Evidence Quality Guard - Error Formatter
 *
 * Formats validation errors into actionable messages for the agent.
 */

import type { ValidationError, ValidationResult, RenderingIssue, SqlWarning } from './types.ts';

// ── Error Type Icons ────────────────────────────────────────────────

const ERROR_ICONS: Record<string, string> = {
  query_not_validated: '🔍',
  query_empty: '📭',
  query_error: '❌',
  static_analysis: '🔧',
  missing_data_reference: '🔗',
};

const ERROR_TYPE_NAMES: Record<string, string> = {
  query_not_validated: 'Query Not Validated',
  query_empty: 'Query Returns No Data',
  query_error: 'Query Execution Error',
  static_analysis: 'Rendering Issue',
  missing_data_reference: 'Missing Query Reference',
};

// ── Main Formatting Function ────────────────────────────────────────

/**
 * Format validation errors into a detailed error message.
 */
export function formatValidationErrors(result: ValidationResult): string {
  const lines: string[] = [];
  
  // Header
  lines.push('## Evidence Quality Guard — BLOCKED ❌');
  lines.push('');
  lines.push('The page write was blocked because of validation errors.');
  lines.push('');
  
  // Group errors by type
  const errorsByType = new Map<string, ValidationError[]>();
  for (const error of result.errors) {
    const existing = errorsByType.get(error.type) || [];
    existing.push(error);
    errorsByType.set(error.type, existing);
  }
  
  // Format each error group
  for (const [type, errors] of errorsByType) {
    const icon = ERROR_ICONS[type] || '❓';
    const typeName = ERROR_TYPE_NAMES[type] || type;
    
    lines.push(`### ${icon} ${typeName}`);
    lines.push('');
    
    for (const error of errors) {
      const location = error.line ? `Line ${error.line}` : 'Unknown location';
      const block = error.blockName ? ` (\`${error.blockName}\`)` : '';
      
      lines.push(`**${location}${block}:** ${error.message}`);
      lines.push(`**Fix:** ${error.fixHint}`);
      lines.push('');
    }
  }
  
  // Summary of what needs to be done
  lines.push('### Required Actions');
  lines.push('');
  
  if (result.unvalidatedBlocks.length > 0) {
    lines.push('1. **Run unvalidated queries via `duckdb_run_sql`:**');
    for (const block of result.unvalidatedBlocks) {
      lines.push(`   - \`${block}\``);
    }
    lines.push('');
  }
  
  if (result.emptyBlocks.length > 0) {
    lines.push('2. **Fix empty queries:**');
    for (const block of result.emptyBlocks) {
      lines.push(`   - \`${block}\` - debug why it returns no data`);
    }
    lines.push('');
  }
  
  lines.push('3. **Re-write the page after fixing all issues**');
  lines.push('');
  
  // Common issues reference
  lines.push('### Common Issues');
  lines.push('');
  lines.push('| Issue | Symptom | Fix |');
  lines.push('|-------|---------|-----|');
  lines.push('| Wrong table name | Query returns 0 rows | Check source SQL files for actual table names |');
  lines.push('| Column case mismatch | Query returns 0 rows | Use exact column names from source (lowercase) |');
  lines.push('| Over-restrictive filter | Query returns 0 rows | Remove WHERE clauses and add back incrementally |');
  lines.push('| Join failure | Query returns 0 rows | Verify FK relationships and data exists in both tables |');
  lines.push('| Invalid HTML tag | Svelte crash | Avoid `<` in plain text, use `&lt;` or words instead |');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Format a single error for quick display.
 */
export function formatSingleError(error: ValidationError): string {
  const icon = ERROR_ICONS[error.type] || '❓';
  const location = error.line ? `Line ${error.line}` : '';
  const block = error.blockName ? ` (\`${error.blockName}\`)` : '';
  
  return `${icon} **${location}${block}:** ${error.message}\n**Fix:** ${error.fixHint}`;
}

/**
 * Format warnings (non-blocking).
 */
export function formatWarnings(warnings: string[]): string {
  if (warnings.length === 0) return '';
  
  const lines: string[] = [];
  lines.push('### ⚠️ Warnings');
  lines.push('');
  
  for (const warning of warnings) {
    lines.push(`- ${warning}`);
  }
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Format success message when validation passes.
 */
export function formatValidationSuccess(): string {
  return [
    '## Evidence Quality Guard — PASSED ✅',
    '',
    'All validation checks passed:',
    '- ✅ All SQL queries have been validated via `duckdb_run_sql`',
    '- ✅ All queries return data (row_count > 0)',
    '- ✅ No rendering issues detected',
    '',
    'Page write allowed.',
  ].join('\n');
}

/**
 * Format static analysis issues.
 */
export function formatStaticAnalysisErrors(issues: RenderingIssue[]): string {
  const lines: string[] = [];
  
  lines.push('## Evidence Quality Guard — BLOCKED ❌');
  lines.push('');
  lines.push('The page write was blocked because of rendering issues.');
  lines.push('');
  
  for (const issue of issues) {
    const severity = issue.severity === 'error' ? '❌' : '⚠️';
    lines.push(`### ${severity} Line ${issue.line}`);
    lines.push(`**Issue:** ${issue.message}`);
    lines.push(`**Fix:** ${issue.fixHint}`);
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Format query cache status for debugging.
 */
export function formatCacheStatus(
  totalQueries: number,
  validatedBlocks: string[],
  unvalidatedBlocks: string[],
): string {
  const lines: string[] = [];
  
  lines.push('### Query Cache Status');
  lines.push(`- Total cached queries: ${totalQueries}`);
  lines.push(`- Validated blocks: ${validatedBlocks.length}`);
  lines.push(`- Unvalidated blocks: ${unvalidatedBlocks.length}`);
  
  if (unvalidatedBlocks.length > 0) {
    lines.push('');
    lines.push('**Unvalidated blocks:**');
    for (const block of unvalidatedBlocks) {
      lines.push(`- \`${block}\``);
    }
  }
  
  return lines.join('\n');
}

// ── Post-Write Reminder Formatter ────────────────────────────────────

/**
 * Format a post-write SQL health check reminder.
 * This is shown after a successful write when there are SQL or process warnings.
 */
export function formatPostWriteReminder(
  filePath: string,
  sqlWarnings: SqlWarning[],
  processWarnings: string[],
  validatedCount: number,
  totalSqlBlocks: number,
): string {
  const lines: string[] = [];
  const fileName = filePath.split('/').pop() || filePath;

  lines.push('## 📋 Post-Write SQL Health Check Reminder');
  lines.push('');
  lines.push(
    `You just wrote **${totalSqlBlocks} SQL quer${totalSqlBlocks === 1 ? 'y' : 'ies'}** to \`${fileName}\`.`,
  );
  lines.push('');

  // Group SQL warnings by type
  const unvalidated = sqlWarnings.filter(w => w.type === 'unvalidated');
  const empty = sqlWarnings.filter(w => w.type === 'empty');
  const missingRef = sqlWarnings.filter(w => w.type === 'missing_reference');

  // ── Empty datasets (highest priority) ──────────────────────────
  if (empty.length > 0) {
    lines.push(`### 🚨 Empty Datasets (${empty.length})`);
    lines.push('');
    lines.push('These queries returned 0 rows — charts will render empty:');
    lines.push('');
    lines.push('| Query | Line | Rows |');
    lines.push('|-------|------|------|');
    for (const w of empty) {
      lines.push(`| \`${w.blockName}\` | ${w.line} | 0 rows |`);
    }
    lines.push('');
  }

  // ── Unvalidated queries ────────────────────────────────────────
  if (unvalidated.length > 0) {
    lines.push(`### ⚠️ Unvalidated Queries (${unvalidated.length})`);
    lines.push('');
    lines.push('These queries were not found in the validation cache. Please verify them:');
    lines.push('');
    lines.push('| Query | Line | Status |');
    lines.push('|-------|------|--------|');
    for (const w of unvalidated) {
      lines.push(`| \`${w.blockName}\` | ${w.line} | 🔍 Not validated |`);
    }
    lines.push('');
  }

  // ── Missing references ─────────────────────────────────────────
  if (missingRef.length > 0) {
    lines.push(`### 🔗 Missing Query References (${missingRef.length})`);
    lines.push('');
    for (const w of missingRef) {
      lines.push(`- **Line ${w.line}:** ${w.message}`);
    }
    lines.push('');
  }

  // ── Validated queries summary ──────────────────────────────────
  if (validatedCount > 0) {
    lines.push(`### ✅ Validated Queries (${validatedCount})`);
    lines.push('');
    lines.push('These queries are validated and return data.');
    lines.push('');
  }

  // ── Next steps ─────────────────────────────────────────────────
  if (sqlWarnings.length > 0) {
    lines.push('### Next Steps (do these now)');
    lines.push('');
    let step = 1;
    if (unvalidated.length > 0) {
      lines.push(`${step}. **Run each unvalidated query** via \`duckdb_run_sql\` to verify it returns data`);
      step++;
    }
    if (empty.length > 0) {
      lines.push(`${step}. **Debug empty queries** — check table names, column names, and filters`);
      step++;
    }
    lines.push(`${step}. **Run \`check_evidence_health\`** to verify the build compiles`);
    step++;
    lines.push(`${step}. **Check the preview** in CMUX browser to verify charts render with data`);
    lines.push('');
    lines.push('> If any query returns 0 rows or errors, fix the SQL and re-write the affected section.');
    lines.push('');
  }

  // ── Process warnings ───────────────────────────────────────────
  if (processWarnings.length > 0) {
    lines.push('### 📝 Process Reminders');
    lines.push('');
    for (const pw of processWarnings) {
      lines.push(`- ⚠️ ${pw}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
