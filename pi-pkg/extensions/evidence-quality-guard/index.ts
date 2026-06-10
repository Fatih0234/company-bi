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
import { extractSqlBlocks, validatePageContent } from './empty-dataset-detector.ts';
import {
  formatCacheStatus,
  formatValidationErrors,
  formatStaticAnalysisErrors,
} from './error-formatter.ts';
import { analyzeEvidenceMarkdown } from './static-analysis.ts';
import type { ValidationResult, RenderingIssue } from './types.ts';

// ── Constants ───────────────────────────────────────────────────────

const EXTENSION_NAME = 'evidence-quality-guard';
const TOOL_NAMES = {
  duckdbRunSql: 'duckdb_run_sql',
  duckdbSummarizeTable: 'duckdb_summarize_table',
  duckdbDescribeTable: 'duckdb_describe_table',
  duckdbQualityReport: 'duckdb_quality_report',
  write: 'write',
  edit: 'edit',
  bash: 'bash',
  read: 'read',
} as const;

// Tools that count as "data profiling"
const PROFILING_TOOLS = new Set([
  TOOL_NAMES.duckdbSummarizeTable,
  TOOL_NAMES.duckdbDescribeTable,
  TOOL_NAMES.duckdbQualityReport,
]);

// Documentation paths that count as "documentation lookup"
const DOC_PATH_PATTERNS = [
  /\.agent\/docs\/evidence-oss\//,
  /evidence\/sites\/docs\/pages\//,
  /SKILL\.md$/,
];

// Evidence components that require documentation lookup
const EVIDENCE_COMPONENTS = new Set([
  'BarChart', 'LineChart', 'AreaChart', 'BubbleChart', 'ScatterPlot',
  'Histogram', 'PieChart', 'FunnelChart', 'CalendarHeatmap', 'SankeyChart',
  'BigValue', 'DataTable', 'Dropdown', 'ButtonGroup', 'DateRange',
  'Grid', 'Accordion', 'Alert', 'Callout', 'Tabs', 'Tab',
]);

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
  
  // ── Session State ───────────────────────────────────────────────
  // Track profiling, documentation reads, and reviews for enforcement
  const sessionState = {
    profilingCalls: new Set<string>(),  // table names that were profiled
    docReads: new Set<string>(),        // documentation files that were read
    validationCalls: new Set<string>(), // pages that were validated (review activity)
    hasProfiledData: false,             // any profiling call made
    hasReadDocs: false,                 // any doc read made
    hasReviewedDashboard: false,        // any page validation done
  };
  
  // ── Session Start ───────────────────────────────────────────────
  
  pi.on('session_start', async (event, ctx) => {
    stateManager = getStateManager(pi);
    validationEngine = getValidationEngine(pi);
    
    await validationEngine.initialize(ctx);
    
    // Restore profiling/doc/review state from session entries
    for (const entry of ctx.sessionManager.getEntries()) {
      if (entry.type === 'custom' && entry.customType === 'evidence-quality-session') {
        const data = entry.data as { profilingCalls?: string[]; docReads?: string[]; validationCalls?: string[] } | undefined;
        if (data?.profilingCalls) {
          data.profilingCalls.forEach(t => sessionState.profilingCalls.add(t));
          sessionState.hasProfiledData = sessionState.profilingCalls.size > 0;
        }
        if (data?.docReads) {
          data.docReads.forEach(d => sessionState.docReads.add(d));
          sessionState.hasReadDocs = sessionState.docReads.size > 0;
        }
        if (data?.validationCalls) {
          data.validationCalls.forEach(v => sessionState.validationCalls.add(v));
          sessionState.hasReviewedDashboard = sessionState.validationCalls.size > 0;
        }
        break;
      }
    }
    
    if (ctx.hasUI) {
      const stats = stateManager.getStats();
      const profilingCount = sessionState.profilingCalls.size;
      const docCount = sessionState.docReads.size;
      const validationCount = sessionState.validationCalls.size;
      ctx.ui.notify(
        `${EXTENSION_NAME} active (${stats.totalQueries} cached queries, ${profilingCount} profiled tables, ${docCount} doc reads, ${validationCount} pages validated)`,
        'info',
      );
    }
  });
  
  // Persist session state
  function persistSessionState(): void {
    pi.appendEntry('evidence-quality-session', {
      profilingCalls: Array.from(sessionState.profilingCalls),
      docReads: Array.from(sessionState.docReads),
      validationCalls: Array.from(sessionState.validationCalls),
    });
  }
  
  // ── Track duckdb_run_sql Results ────────────────────────────────
  
  pi.on('tool_result', async (event, ctx) => {
    // Only process duckdb_run_sql results
    if (event.toolName !== TOOL_NAMES.duckdbRunSql) {
      return;
    }
    
    // Parse the response
    // event.details contains the actual data object (not content array)
    const response = parseDuckDbResponse(event.details);
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
  
  // ── Track Data Profiling Calls ─────────────────────────────────
  
  pi.on('tool_result', async (event, ctx) => {
    // Track profiling tools (summarize_table, describe_table, quality_report)
    if (PROFILING_TOOLS.has(event.toolName as string)) {
      const table = event.input?.table as string;
      if (table && typeof table === 'string') {
        sessionState.profilingCalls.add(table);
        sessionState.hasProfiledData = true;
        persistSessionState();
        
        if (ctx.hasUI) {
          ctx.ui.notify(
            `✅ Data profiled: ${table} (${sessionState.profilingCalls.size} tables profiled)`,
            'info',
          );
        }
      }
    }
  });
  
  // ── Track Documentation Reads ──────────────────────────────────
  
  pi.on('tool_result', async (event, ctx) => {
    // Track read tool calls to documentation files
    if (event.toolName === TOOL_NAMES.read) {
      const path = event.input?.path as string;
      if (path && typeof path === 'string') {
        // Check if this is a documentation file
        const isDoc = DOC_PATH_PATTERNS.some(pattern => pattern.test(path));
        if (isDoc) {
          sessionState.docReads.add(path);
          sessionState.hasReadDocs = true;
          persistSessionState();
          
          if (ctx.hasUI) {
            ctx.ui.notify(
              `📚 Documentation read: ${path.split('/').pop()} (${sessionState.docReads.size} docs read)`,
              'info',
            );
          }
        }
      }
    }
  });
  
  // ── Validate Page Writes (BEFORE execution) ─────────────────────
  
  /**
   * Validate content that will be written to a page file.
   * Returns null if validation passes, or block response if it fails.
   */
  async function validateContentBeforeWrite(
    filePath: string,
    content: string,
  ): Promise<{ block: boolean; reason?: string } | null> {
    // Only validate .md files in pages/ directories
    if (!filePath.endsWith('.md') || !filePath.includes('/pages/')) {
      return null;
    }
    
    // Extract the filename from the path
    const fileName = filePath.split('/').pop() || '';
    
    // Pages that are exempt from the Insight Candidate Scan check
    const EXEMPT_PAGES = ['draft.md', 'index.md'];
    const isExemptPage = EXEMPT_PAGES.includes(fileName);
    
    // ── Insight Candidate Scan Enforcement ───────────────────────
    // Before writing to any non-exempt page, verify that draft.md
    // contains the required planning sections. This enforces the
    // evidence-bi-thinking workflow: plan first, then build.
    if (!isExemptPage) {
      const pagesDir = filePath.replace(/\/pages\/[^/]+$/, '/pages');
      const draftPath = join(pagesDir, 'draft.md');
      
      if (existsSync(draftPath)) {
        try {
          const draftContent = readFileSync(draftPath, 'utf8');
          const hasInsightScan = draftContent.includes('## Insight Candidate Scan');
          const hasReportPlan = draftContent.includes('## Report Design Plan');
          
          if (!hasInsightScan || !hasReportPlan) {
            const missing = [];
            if (!hasInsightScan) missing.push('## Insight Candidate Scan');
            if (!hasReportPlan) missing.push('## Report Design Plan');
            
            const missingList = missing.map(m => `- ${m}`).join('\n');
            const reason = [
              'PAGE WRITE BLOCKED — Missing required planning sections in draft.md',
              '',
              `Before writing to ${fileName}, you must first create an Insight Candidate Scan and Report Design Plan in pages/draft.md.`,
              '',
              'Missing sections:',
              missingList,
              '',
              'Required workflow:',
              '1. Run evidence-bi-thinking skill to generate insight candidates',
              '2. Write the Report Design Plan to pages/draft.md',
              '3. Get user alignment on the plan',
              '4. Then write to the target page',
              '',
              'See the evidence-dashboard skill for the full workflow.',
            ].join('\n');
            
            return {
              block: true,
              reason,
            };
          }
        } catch {
          // If we can't read draft.md, allow the write to proceed
        }
      } else {
        // draft.md doesn't exist — this is a fresh workspace
        // Allow the write to proceed (first page creation is OK)
      }
    }
    
    // ── Data Profiling Enforcement ──────────────────────────────
    // Before writing to pages with SQL queries, verify that data profiling
    // was performed. This enforces the data-discovery workflow.
    if (!isExemptPage && !sessionState.hasProfiledData) {
      // Check if the page contains SQL blocks (indicating data analysis)
      const hasSqlBlocks = content.includes('```sql');
      if (hasSqlBlocks) {
        return {
          block: true,
          reason: [
            'PAGE WRITE BLOCKED — No data profiling performed',
            '',
            'Before writing pages with SQL queries, you must first profile the data using:',
            '- `duckdb_summarize_table` — for distribution, distinct counts, and findings',
            '- `duckdb_describe_table` — for column names and types',
            '- `duckdb_quality_report` — for data quality issues',
            '',
            'This ensures you understand the data before writing queries.',
            '',
            'Required workflow:',
            '1. Run data-discovery skill to profile the data',
            '2. Understand column types, distributions, and quality issues',
            '3. Then write SQL queries with confidence',
            '',
            'See the data-discovery skill for the full workflow.',
          ].join('\n'),
        };
      }
    }
    
    // ── Documentation Lookup Enforcement ────────────────────────
    // Before writing to pages with Evidence components, verify that
    // documentation was consulted. This prevents guessing component props.
    if (!isExemptPage && !sessionState.hasReadDocs) {
      // Check if the page contains Evidence components
      const componentMatches = content.match(/<(\w+)/g) || [];
      const hasComponents = componentMatches.some(match => {
        const componentName = match.slice(1); // Remove '<'
        return EVIDENCE_COMPONENTS.has(componentName);
      });
      
      if (hasComponents) {
        return {
          block: true,
          reason: [
            'PAGE WRITE BLOCKED — No documentation consulted',
            '',
            'Before writing pages with Evidence components (BarChart, LineChart, BigValue, etc.),',
            'you must first read the component documentation:',
            '',
            '1. Read `.agent/docs/evidence-oss/ROUTES.md` for task-based routing',
            '2. Follow links to specific component documentation',
            '3. Extract exact props, syntax, and patterns',
            '',
            'This prevents guessing component props and getting them wrong.',
            '',
            'Example:',
            '- WRONG: `<BarChart data={query} x=zone y=revenue series=count />` (guessing series prop)',
            '- RIGHT: Read docs → learn series is for categorical grouping → use correctly',
          ].join('\n'),
        };
      }
    }
    
    // Run static analysis (fast, no external dependencies)
    const staticIssues = analyzeEvidenceMarkdown(content);
    const staticErrors = staticIssues.filter(i => i.severity === 'error');
    
    if (staticErrors.length > 0) {
      const errorMessage = formatStaticAnalysisErrors(staticIssues);
      return {
        block: true,
        reason: `PAGE WRITE BLOCKED — Static analysis errors found:\n\n${errorMessage}\n\nFix these issues before writing the file.`,
      };
    }
    
    // Validate SQL blocks against query cache
    const validationResult = validatePageContent(content, stateManager.getCache());
    
    if (!validationResult.valid) {
      const errorMessage = formatValidationErrors(validationResult);
      return {
        block: true,
        reason: `PAGE WRITE BLOCKED — Query validation errors:\n\n${errorMessage}\n\nRun all queries via duckdb_run_sql before writing the page.`,
      };
    }
    
    // All validations passed
    return null;
  }
  
  // Block write/edit tools BEFORE they execute
  pi.on('tool_call', async (event) => {
    // Process write tool
    if (event.toolName === TOOL_NAMES.write) {
      const filePath = event.input?.path;
      const content = event.input?.content;
      
      if (filePath && typeof filePath === 'string' && content && typeof content === 'string') {
        const result = await validateContentBeforeWrite(filePath, content);
        if (result?.block) {
          return { block: true, reason: result.reason };
        }
      }
    }
    
    // Process edit tool
    if (event.toolName === TOOL_NAMES.edit) {
      const filePath = event.input?.path;
      const edits = event.input?.edits;
      
      if (filePath && typeof filePath === 'string' && Array.isArray(edits)) {
        // Read existing file and apply edits to get the final content
        try {
          if (existsSync(filePath)) {
            let content = readFileSync(filePath, 'utf8');
            
            // Apply each edit (simplified - in production you'd use a proper diff library)
            for (const edit of edits) {
              if (edit.oldText && edit.newText) {
                content = content.replace(edit.oldText, edit.newText);
              }
            }
            
            const result = await validateContentBeforeWrite(filePath, content);
            if (result?.block) {
              return { block: true, reason: result.reason };
            }
          }
        } catch {
          // If we can't read the file, allow the edit to proceed
        }
      }
    }
    
    // Process bash tool calls that write to .md files
    if (event.toolName === TOOL_NAMES.bash) {
      const command = event.input?.command || '';
      const targetFiles = extractTargetFilesFromCommand(command);
      
      // For bash, we can't easily predict the output, so we'll validate after
      // The tool_result handler will catch any issues
    }
  });
  
  // Validate AFTER execution (for bash commands and as a fallback)
  pi.on('tool_result', async (event, ctx) => {
    // Process bash tool calls that write to .md files
    if (event.toolName === TOOL_NAMES.bash) {
      const command = event.input?.command || '';
      const targetFiles = extractTargetFilesFromCommand(command);
      
      for (const filePath of targetFiles) {
        if (!filePath.endsWith('.md') || !filePath.includes('/pages/')) {
          continue;
        }
        
        // Read the file that was written
        try {
          if (existsSync(filePath)) {
            const content = readFileSync(filePath, 'utf8');
            const result = await validateContentBeforeWrite(filePath, content);
            if (result?.block) {
              // Can't block after execution, but we can return an error to the LLM
              return {
                content: [{ type: 'text', text: result.reason }],
                isError: true,
              };
            }
          }
        } catch {
          // File read error - ignore
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
      
      // Track this validation as review activity
      sessionState.validationCalls.add(filePath);
      sessionState.hasReviewedDashboard = true;
      persistSessionState();
      
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
  
  // ── Register Dashboard Readiness Checklist Tool ────────────────
  
  pi.registerTool({
    name: 'evidence_dashboard_readiness',
    label: 'Evidence: Dashboard Readiness',
    description:
      'Check if a dashboard workspace is ready for publication. ' +
      'Verifies all quality gates: data profiling, planning, query validation, ' +
      'documentation, and review.',
    promptSnippet: 'Check dashboard readiness before publishing',
    promptGuidelines: [
      'Use evidence_dashboard_readiness to verify all quality gates before marking a dashboard as complete.',
      'Call this tool at the end of a dashboard build to ensure nothing was skipped.',
    ],
    parameters: Type.Object({
      workspacePath: Type.String({ description: 'Path to the workspace root (e.g., /Volumes/T7/projects/company-bi)' }),
    }),
    
    async execute(_toolCallId, params, _signal, onUpdate, ctx) {
      const workspacePath = params.workspacePath;
      const pagesDir = join(workspacePath, 'pages');
      
      onUpdate?.({
        content: [{ type: 'text', text: 'Checking dashboard readiness...' }],
      });
      
      const checks: Array<{ name: string; passed: boolean; details: string }> = [];
      
      // 1. Check data profiling
      checks.push({
        name: 'Data Profiled',
        passed: sessionState.hasProfiledData,
        details: sessionState.hasProfiledData
          ? `${sessionState.profilingCalls.size} tables profiled: ${Array.from(sessionState.profilingCalls).join(', ')}`
          : 'No data profiling performed. Run duckdb_summarize_table or duckdb_describe_table first.',
      });
      
      // 2. Check Insight Candidate Scan
      const draftPath = join(pagesDir, 'draft.md');
      let hasInsightScan = false;
      let hasReportPlan = false;
      if (existsSync(draftPath)) {
        try {
          const draftContent = readFileSync(draftPath, 'utf8');
          hasInsightScan = draftContent.includes('## Insight Candidate Scan');
          hasReportPlan = draftContent.includes('## Report Design Plan');
        } catch {
          // File read error
        }
      }
      checks.push({
        name: 'Insight Candidate Scan',
        passed: hasInsightScan,
        details: hasInsightScan
          ? 'Found in draft.md'
          : 'Missing from draft.md. Run evidence-bi-thinking skill first.',
      });
      checks.push({
        name: 'Report Design Plan',
        passed: hasReportPlan,
        details: hasReportPlan
          ? 'Found in draft.md'
          : 'Missing from draft.md. Write a Report Design Plan to draft.md.',
      });
      
      // 3. Check documentation lookup
      checks.push({
        name: 'Documentation Consulted',
        passed: sessionState.hasReadDocs,
        details: sessionState.hasReadDocs
          ? `${sessionState.docReads.size} docs read`
          : 'No documentation read. Read .agent/docs/evidence-oss/ before building.',
      });
      
      // 4. Check SQL query validation
      const stats = stateManager.getStats();
      checks.push({
        name: 'SQL Queries Validated',
        passed: stats.totalQueries > 0,
        details: stats.totalQueries > 0
          ? `${stats.totalQueries} queries validated`
          : 'No queries validated. Run duckdb_run_sql for all queries first.',
      });
      
      // 5. Check review activity (page validations)
      checks.push({
        name: 'Review Completed',
        passed: sessionState.hasReviewedDashboard,
        details: sessionState.hasReviewedDashboard
          ? `${sessionState.validationCalls.size} pages validated: ${Array.from(sessionState.validationCalls).map(p => p.split('/').pop()).join(', ')}`
          : 'No pages validated. Run evidence_validate_page on key pages first.',
      });
      
      // 6. Check for report.md existence
      const reportPath = join(pagesDir, 'report.md');
      const hasReport = existsSync(reportPath);
      checks.push({
        name: 'Report Page Exists',
        passed: hasReport,
        details: hasReport
          ? 'report.md found'
          : 'No report.md found. Create a polished report page.',
      });
      
      // Calculate overall status
      const allPassed = checks.every(c => c.passed);
      const passedCount = checks.filter(c => c.passed).length;
      
      // Format output
      const lines = [
        '## Dashboard Readiness Checklist',
        '',
        allPassed
          ? '✅ **All checks passed — dashboard is ready for review/publishing**'
          : `⚠️ **${passedCount}/${checks.length} checks passed — not ready yet**`,
        '',
        '### Checks',
        '',
        ...checks.map(c => 
          `- ${c.passed ? '✅' : '❌'} **${c.name}**: ${c.details}`
        ),
        '',
      ];
      
      if (!allPassed) {
        lines.push(
          '### Next Steps',
          '',
          'Fix the failed checks above before publishing.',
          '',
          'Required workflow:',
          '1. Profile data with duckdb_summarize_table',
          '2. Create Insight Candidate Scan in draft.md',
          '3. Create Report Design Plan in draft.md',
          '4. Read component documentation',
          '5. Run all SQL queries via duckdb_run_sql',
          '6. Write polished report to report.md',
          '7. Run evidence-dashboard-review skill',
        );
      }
      
      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        details: {
          allPassed,
          passedCount,
          totalCount: checks.length,
          checks,
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
