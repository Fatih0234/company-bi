/**
 * Evidence Quality Guard - Empty Dataset Detector
 *
 * Extracts SQL blocks from markdown files and validates
 * they return data before allowing page writes.
 */

import type {
  SqlBlock,
  ValidationResult,
  ValidationError,
  QueryCache,
} from './types.ts';
import {
  getQueryHash,
  getValidatedQuery,
  isQueryValidated,
} from './query-validator.ts';

// ── SQL Block Extraction ────────────────────────────────────────────

/**
 * Extract SQL blocks from markdown content.
 * Looks for patterns like: ```sql block_name
 */
export function extractSqlBlocks(content: string): SqlBlock[] {
  const blocks: SqlBlock[] = [];
  const lines = content.split('\n');
  
  let inSqlBlock = false;
  let currentBlockName = '';
  let currentBlockStart = 0;
  let currentBlockContent = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Start of SQL block
    if (line.startsWith('```sql')) {
      inSqlBlock = true;
      currentBlockName = line.replace(/^```sql\s*/, '').trim();
      currentBlockStart = i + 1; // 1-indexed
      currentBlockContent = '';
      continue;
    }
    
    // End of SQL block
    if (inSqlBlock && line === '```') {
      inSqlBlock = false;
      
      if (currentBlockName && currentBlockContent.trim()) {
        const sql = currentBlockContent.trim();
        blocks.push({
          name: currentBlockName,
          content: sql,
          line: currentBlockStart,
          hash: getQueryHash(sql),
        });
      }
      
      continue;
    }
    
    // Inside SQL block
    if (inSqlBlock) {
      currentBlockContent += line + '\n';
    }
  }
  
  return blocks;
}

/**
 * Extract component references from markdown content.
 * Looks for <BarChart data={queryName} ... />
 */
interface ComponentReference {
  name: string;
  dataProp: string;
  line: number;
}

export function extractComponentReferences(content: string): ComponentReference[] {
  const refs: ComponentReference[] = [];
  const lines = content.split('\n');
  
  // Chart components that need data
  const chartComponents = [
    'BarChart', 'LineChart', 'AreaChart', 'BubbleChart', 'ScatterPlot',
    'Histogram', 'PieChart', 'FunnelChart', 'CalendarHeatmap', 'SankeyChart',
    'DataTable', 'BigValue',
  ];
  
  const componentPattern = new RegExp(
    `<(${chartComponents.join('|')})\\s+[^>]*data=\\{([^}]+)\\}`,
    'g',
  );
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    
    while ((match = componentPattern.exec(line)) !== null) {
      refs.push({
        name: match[1],
        dataProp: match[2],
        line: i + 1, // 1-indexed
      });
    }
  }
  
  return refs;
}

// ── Validation Logic ────────────────────────────────────────────────

/**
 * Validate all SQL blocks in a page against the query cache.
 */
export function validateSqlBlocks(
  blocks: SqlBlock[],
  cache: QueryCache,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];
  const validatedBlocks: string[] = [];
  const unvalidatedBlocks: string[] = [];
  const emptyBlocks: string[] = [];
  
  for (const block of blocks) {
    const validated = getValidatedQuery(cache, block.content);
    
    if (!validated) {
      // Query hasn't been validated
      unvalidatedBlocks.push(block.name);
      errors.push({
        type: 'query_not_validated',
        message: `SQL block \`${block.name}\` has not been run via \`duckdb_run_sql\``,
        fixHint: `Run this query first: \`duckdb_run_sql\` with the SQL from line ${block.line}`,
        line: block.line,
        blockName: block.name,
      });
    } else if (validated.rowCount === 0) {
      // Query returned no data
      emptyBlocks.push(block.name);
      errors.push({
        type: 'query_empty',
        message: `SQL block \`${block.name}\` returned 0 rows`,
        fixHint: `Debug the query - check table names, column names, filters. Query was validated at ${new Date(validated.validatedAt).toISOString()}`,
        line: block.line,
        blockName: block.name,
      });
    } else {
      // Query is valid and has data
      validatedBlocks.push(block.name);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sqlBlocks: blocks,
    validatedBlocks,
    unvalidatedBlocks,
    emptyBlocks,
  };
}

/**
 * Validate a page's SQL blocks and component references.
 */
export function validatePageContent(
  content: string,
  cache: QueryCache,
): ValidationResult {
  // Extract SQL blocks
  const sqlBlocks = extractSqlBlocks(content);
  
  // Extract component references
  const componentRefs = extractComponentReferences(content);
  
  // Validate SQL blocks
  const result = validateSqlBlocks(sqlBlocks, cache);
  
  // Check for components referencing non-existent queries
  const sqlBlockNames = new Set(sqlBlocks.map(b => b.name));
  
  for (const ref of componentRefs) {
    if (!sqlBlockNames.has(ref.dataProp)) {
      result.errors.push({
        type: 'missing_data_reference',
        message: `<${ref.name}> references query \`${ref.dataProp}\` which doesn't exist in this page`,
        fixHint: `Add a SQL block named \`${ref.dataProp}\` or change the data prop to reference an existing query`,
        line: ref.line,
        blockName: ref.dataProp,
      });
    }
  }
  
  // Recalculate validity after adding component reference errors
  result.valid = result.errors.length === 0;
  
  return result;
}

// ── SQL Block Content Helpers ───────────────────────────────────────

/**
 * Get the full SQL content for a block (including CTEs from parent blocks).
 * For now, just return the block content. Could be extended to handle
 * WITH clauses that reference other blocks.
 */
export function getBlockSql(block: SqlBlock): string {
  return block.content;
}

/**
 * Check if a SQL block is a simple SELECT (no side effects).
 */
export function isSimpleSelect(sql: string): boolean {
  const normalized = sql.trim().toLowerCase();
  
  // Must start with SELECT or WITH
  if (!normalized.startsWith('select') && !normalized.startsWith('with')) {
    return false;
  }
  
  // Must not contain DML/DDL keywords
  const forbidden = [
    'insert', 'update', 'delete', 'drop', 'create', 'alter',
    'truncate', 'merge', 'exec', 'execute',
  ];
  
  for (const keyword of forbidden) {
    if (normalized.includes(` ${keyword} `) || normalized.startsWith(`${keyword} `)) {
      return false;
    }
  }
  
  return true;
}
