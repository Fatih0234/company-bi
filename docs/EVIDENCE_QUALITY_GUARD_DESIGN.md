# Evidence Quality Guard Extension — Design Document

> **Purpose**: Unified extension that prevents silent failures in Evidence dashboards by enforcing validation at multiple checkpoints.

> **Status**: Implementation complete — ready for testing

---

## Table of Contents

1. [Problem Summary](#problem-summary)
2. [Solution Architecture](#solution-architecture)
3. [Validation Pipeline](#validation-pipeline)
4. [Implementation Details](#implementation-details)
5. [Files to Create/Modify](#files-to-createmodify)
6. [Integration Points](#integration-points)
7. [Error Messages](#error-messages)
8. [Testing Strategy](#testing-strategy)

---

## Problem Summary

### Silent Failure Chain (Current)
```
1. Agent writes SQL queries in a page
2. Evidence runs them → they return EMPTY datasets
3. BarChart components get empty data → log warnings (not errors)
4. Build completes successfully (exit code 0)
5. Agent checks health → HTTP 200 OK → "everything looks good"
6. Screenshots show static content at top → Agent doesn't scroll to charts
7. Agent ships broken page with confidence
```

### Root Cause
No enforcement mechanism exists to ensure:
- SQL queries return data before being embedded in pages
- Charts have valid datasets before rendering
- Build output warnings are treated as failures

---

## Solution Architecture

### Design Principles
1. **Single Unified Extension**: One extension handles all quality checks
2. **Hard Block**: Agent cannot proceed until validation passes
3. **After Page Write**: Intercept `tool_result` for `write`/`edit` on `.md` files
4. **Pre-validation Required**: Agent must run SQL via `duckdb_run_sql` before writing pages

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Evidence Quality Guard                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Query     │    │   Empty     │    │   Static    │     │
│  │  Validator  │    │  Dataset    │    │  Analysis   │     │
│  │             │    │  Detector   │    │  (Existing) │     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            │                                │
│                    ┌───────▼───────┐                        │
│                    │   Validation  │                        │
│                    │    Engine     │                        │
│                    └───────┬───────┘                        │
│                            │                                │
│                    ┌───────▼───────┐                        │
│                    │   Hard Block  │                        │
│                    │   Mechanism   │                        │
│                    └───────────────┘                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Component Details

#### 1. Query Validator
**Purpose**: Ensure SQL queries return data before being embedded in pages

**Mechanism**:
- Track all `duckdb_run_sql` calls and their results (query hash → row count)
- Before allowing page writes, extract SQL blocks from the page
- Check each SQL block against the validated query cache
- Block if any SQL block:
  - Hasn't been run via `duckdb_run_sql`
  - Returned 0 rows when run

**State Storage**:
- Use `pi.appendEntry()` to persist validated query cache
- Query hash = normalized SQL (whitespace collapsed, lowercased)
- Store: `{ queryHash: string, rowCount: number, validatedAt: timestamp }`

#### 2. Empty Dataset Detector
**Purpose**: Catch empty datasets that slip through query validation

**Mechanism**:
- After page write, extract SQL blocks from the written file
- For each SQL block, check if it's in the validated cache
- If not in cache, run it via `duckdb_run_sql` (if tool available)
- Block if any query returns 0 rows

**Fallback**:
- If `duckdb_run_sql` not available, rely on build output parsing
- Parse build output for "Dataset is empty" warnings
- Block if warnings found

#### 3. Static Analysis (Existing)
**Purpose**: Catch Svelte/HTML rendering issues

**Mechanism**:
- Reuse existing `evidence-render-guard.ts` logic
- Detect invalid HTML tags, bad component patterns, `_pct_pct` issues
- Block if issues found

---

## Validation Pipeline

### Pipeline Flow

```
Agent calls write/edit on .md file
           │
           ▼
    ┌──────────────┐
    │ tool_result  │
    │   event      │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐     ┌──────────────┐
    │ Is file a    │─No─►│ Pass through │
    │ .md in       │     │ (no check)   │
    │ pages/?      │     └──────────────┘
    └──────┬───────┘
           │ Yes
           ▼
    ┌──────────────┐
    │ Extract SQL  │
    │ blocks from  │
    │ page content │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐     ┌──────────────┐
    │ All SQL      │─No─►│ BLOCK:       │
    │ blocks in    │     │ "Query not   │
    │ validated    │     │  validated"  │
    │ cache?       │     └──────────────┘
    └──────┬───────┘
           │ Yes
           ▼
    ┌──────────────┐     ┌──────────────┐
    │ All queries  │─No─►│ BLOCK:       │
    │ have         │     │ "Query       │
    │ rowCount>0?  │     │  empty"      │
    └──────┬───────┘     └──────────────┘
           │ Yes
           ▼
    ┌──────────────┐     ┌──────────────┐
    │ Static       │─No─►│ BLOCK:       │
    │ analysis     │     │ "Rendering   │
    │ passes?      │     │  issue"      │
    └──────┬───────┘     └──────────────┘
           │ Yes
           ▼
    ┌──────────────┐
    │ Allow write  │
    │ to proceed   │
    └──────────────┘
```

### Validation Checkpoints

| Checkpoint | Event | Tool | What We Check |
|------------|-------|------|---------------|
| Query Validation | `tool_result` | `duckdb_run_sql` | Record query hash → row count |
| Page Write | `tool_result` | `write`, `edit` | Validate all SQL blocks before allowing |
| Build Output | N/A (manual) | `npm run build` | Parse for empty dataset warnings |

---

## Implementation Details

### Extension Structure

```
pi-pkg/extensions/evidence-quality-guard/
├── index.ts                    # Main entry point
├── query-validator.ts          # SQL query validation logic
├── empty-dataset-detector.ts   # Empty dataset detection
├── static-analysis.ts          # Svelte/HTML analysis (from render-guard)
├── validation-engine.ts        # Unified validation pipeline
├── state-manager.ts            # Query cache and state management
└── error-formatter.ts          # Error message formatting
```

### Key Functions

#### query-validator.ts
```typescript
// Track validated queries
interface ValidatedQuery {
  queryHash: string;
  sql: string;
  rowCount: number;
  columns: string[];
  validatedAt: number;
}

// Record query validation
function recordQueryValidation(sql: string, rowCount: number, columns: string[]): void

// Check if query is validated
function isQueryValidated(sql: string): ValidatedQuery | null

// Get query hash (normalized)
function getQueryHash(sql: string): string
```

#### empty-dataset-detector.ts
```typescript
// Extract SQL blocks from markdown
function extractSqlBlocks(content: string): Map<string, { content: string; line: number }>

// Check if all SQL blocks are validated
function validateSqlBlocks(blocks: Map<string, { content: string; line: number }>): ValidationResult

// Run validation via duckdb_run_sql
async function runQueryValidation(sql: string): Promise<{ rowCount: number; columns: string[] }>
```

#### validation-engine.ts
```typescript
// Main validation pipeline
async function validatePageWrite(
  filePath: string,
  content: string,
  ctx: ExtensionContext
): Promise<ValidationResult>

// Validation result
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

interface ValidationError {
  type: 'query_not_validated' | 'query_empty' | 'static_analysis' | 'build_warning';
  message: string;
  fixHint: string;
  line?: number;
}
```

### State Management

#### Query Cache Storage
```typescript
// Persist validated queries
pi.appendEntry('evidence-query-cache', {
  queries: Map<string, ValidatedQuery>,
  lastUpdated: number
});

// Restore on session start
pi.on('session_start', async (event, ctx) => {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === 'custom' && entry.customType === 'evidence-query-cache') {
      // Restore query cache
    }
  }
});
```

#### Query Validation Tracking
```typescript
// Intercept duckdb_run_sql results
pi.on('tool_result', async (event, ctx) => {
  if (event.toolName === 'duckdb_run_sql') {
    const sql = event.input.sql;
    const result = JSON.parse(event.content);
    recordQueryValidation(sql, result.rowCount, result.columns);
  }
});
```

### Hard Block Mechanism

#### Blocking Page Writes
```typescript
// Intercept write/edit on .md files
pi.on('tool_result', async (event, ctx) => {
  if (event.toolName === 'write' || event.toolName === 'edit') {
    const filePath = event.input.path;
    
    // Only check .md files in pages/
    if (!filePath.endsWith('.md') || !filePath.includes('/pages/')) {
      return; // Pass through
    }
    
    // Read the written content
    const content = readFileSync(filePath, 'utf8');
    
    // Run validation
    const result = await validatePageWrite(filePath, content, ctx);
    
    if (!result.valid) {
      // HARD BLOCK: Return error
      return {
        content: formatErrors(result.errors),
        isError: true
      };
    }
  }
});
```

#### Error Formatting
```typescript
function formatErrors(errors: ValidationError[]): string {
  const lines = [
    '## Evidence Quality Guard — BLOCKED ❌',
    '',
    'The page write was blocked because of validation errors:',
    ''
  ];
  
  for (const error of errors) {
    lines.push(`### ${error.type}`);
    lines.push(`**Line ${error.line || 'N/A'}:** ${error.message}`);
    lines.push(`**Fix:** ${error.fixHint}`);
    lines.push('');
  }
  
  lines.push('### Required Actions');
  lines.push('1. Fix all validation errors above');
  lines.push('2. Re-run any failed SQL queries via `duckdb_run_sql`');
  lines.push('3. Re-write the page');
  
  return lines.join('\n');
}
```

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `pi-pkg/extensions/evidence-quality-guard/index.ts` | Main extension entry point |
| `pi-pkg/extensions/evidence-quality-guard/query-validator.ts` | SQL query validation logic |
| `pi-pkg/extensions/evidence-quality-guard/empty-dataset-detector.ts` | Empty dataset detection |
| `pi-pkg/extensions/evidence-quality-guard/static-analysis.ts` | Svelte/HTML analysis (reused from render-guard) |
| `pi-pkg/extensions/evidence-quality-guard/validation-engine.ts` | Unified validation pipeline |
| `pi-pkg/extensions/evidence-quality-guard/state-manager.ts` | Query cache and state management |
| `pi-pkg/extensions/evidence-quality-guard/error-formatter.ts` | Error message formatting |
| `pi-pkg/extensions/evidence-quality-guard/package.json` | Package metadata and dependencies |

### Modified Files

| File | Change |
|------|--------|
| `pi-pkg/extensions/evidence-render-guard.ts` | Deprecate (replaced by unified extension) |
| `pi-pkg/extensions/evidence-health-check.ts` | Keep as separate tool (health check is different from quality guard) |
| `.pi/extensions/` | Add symlink or copy for auto-discovery |

### Files to Deprecate

| File | Reason |
|------|--------|
| `pi-pkg/extensions/evidence-render-guard.ts` | Logic moved to unified extension |
| `scripts/validate-build.sh` | Functionality integrated into extension |

---

## Integration Points

### 1. duckdb_run_sql Tool
**Requirement**: Agent must use `duckdb_run_sql` to validate queries before writing pages

**Tool Response Structure**:
```typescript
interface DuckDbRunSqlResponse {
  ok: boolean;                    // Whether query succeeded
  columns: string[];              // Column names
  rows: any[];                    // Result rows
  row_count: number;              // Number of rows returned
  elapsed_ms: number;             // Execution time
  truncated: boolean;             // Whether result was truncated
  query_id: string;               // Unique query identifier
  error?: {                       // Error details if failed
    code: string;
    message: string;
  };
}
```

**How it works**:
- Agent calls `duckdb_run_sql` with SQL query
- Extension intercepts `tool_result` and records validation
- Extension stores: `{ queryHash, rowCount, columns, validatedAt }`
- Agent writes page with validated queries
- Extension checks all SQL blocks are validated

**Fallback if duckdb_run_sql unavailable**:
- Extension can run queries directly via DuckDB CLI
- Or rely on build output parsing (less reliable)

### 2. write/edit Tools
**Requirement**: Extension intercepts page writes to validate

**How it works**:
- Agent calls `write` or `edit` on `.md` file
- Extension intercepts `tool_result`
- Extension extracts SQL blocks and validates
- If validation fails, returns `{ isError: true }`

### 3. Build Process
**Requirement**: Parse build output for empty dataset warnings

**How it works**:
- After build completes, extension parses output
- Looks for "Dataset is empty" warnings
- Reports findings to agent

---

## Error Messages

### Query Not Validated
```
## Evidence Quality Guard — BLOCKED ❌

The page write was blocked because SQL queries haven't been validated.

### Query Not Validated
**Line 15:** SQL block `daily_metrics` has not been run via `duckdb_run_sql`
**Fix:** Run this query first: `duckdb_run_sql` with the SQL from lines 15-25

### Required Actions
1. Extract the SQL query from the page
2. Run it via `duckdb_run_sql`
3. Verify `row_count > 0`
4. Re-write the page
```

### Query Empty
```
## Evidence Quality Guard — BLOCKED ❌

The page write was blocked because a SQL query returns no data.

### Query Empty
**Line 15:** SQL block `daily_metrics` returned 0 rows
**Fix:** Debug the query - check table names, column names, filters

### Common Issues
- Wrong table name (check `sources/` directory)
- Case mismatch (DuckDB is case-sensitive)
- Over-restrictive WHERE clause
- Join failure (check foreign keys)

### Required Actions
1. Fix the SQL query
2. Re-run via `duckdb_run_sql` to verify row_count > 0
3. Re-write the page
```

### Static Analysis Issue
```
## Evidence Quality Guard — BLOCKED ❌

The page write was blocked because of rendering issues.

### Rendering Issue
**Line 22:** '<1' will crash the Svelte renderer with 'Expected valid tag name'
**Fix:** Use 'under', 'less than', or '&lt;' instead of '<' in plain text

### Required Actions
1. Fix the rendering issue
2. Re-write the page
```

---

## Testing Strategy

### Unit Tests

1. **Query Validator Tests**
   - Test query hash normalization
   - Test cache storage and retrieval
   - Test validation logic

2. **Empty Dataset Detector Tests**
   - Test SQL block extraction
   - Test validation against cache
   - Test error formatting

3. **Static Analysis Tests**
   - Test HTML tag detection
   - Test component pattern detection
   - Test `_pct_pct` detection

### Integration Tests

1. **Page Write Flow**
   - Test successful write with validated queries
   - Test blocked write with unvalidated queries
   - Test blocked write with empty queries

2. **State Persistence**
   - Test query cache survives session restart
   - Test cache is properly restored

### Manual Testing

1. **Create test page with unvalidated query**
   - Expect: Block with "Query Not Validated" error

2. **Create test page with empty query**
   - Expect: Block with "Query Empty" error

3. **Create test page with rendering issue**
   - Expect: Block with "Rendering Issue" error

4. **Create test page with all validations passing**
   - Expect: Write succeeds

---

## Migration Plan

### Phase 1: Implement Unified Extension
1. Create `evidence-quality-guard` directory
2. Implement core components
3. Add unit tests

### Phase 2: Integration
1. Add to `.pi/extensions/` for auto-discovery
2. Test with existing workspaces
3. Gather feedback

### Phase 3: Deprecation
1. Mark `evidence-render-guard.ts` as deprecated
2. Update documentation
3. Remove `scripts/validate-build.sh`

### Phase 4: Documentation
1. Update `docs/EVIDENCE_QUALITY_SYSTEM.md`
2. Add to agent skills
3. Create user guide

---

## Success Criteria

1. **Agent cannot write pages with unvalidated queries**
   - Hard block prevents proceeding
   - Clear error message explains what to do

2. **Agent cannot write pages with empty queries**
   - Hard block prevents proceeding
   - Clear error message explains what to do

3. **Agent cannot write pages with rendering issues**
   - Hard block prevents proceeding
   - Clear error message explains what to do

4. **Query validation state persists across sessions**
   - Cache survives restart
   - Agent doesn't need to re-validate

5. **Error messages are actionable**
   - Agent knows exactly what to fix
   - Agent knows how to fix it

---

## Open Questions

1. **duckdb_run_sql availability**: What if the tool isn't available?
   - Fallback: Run queries via DuckDB CLI
   - Fallback: Rely on build output parsing

2. **Query normalization**: How to handle SQL variations?
   - Collapse whitespace
   - Lowercase keywords
   - Ignore comments

3. **Cache invalidation**: When to clear the cache?
   - On session start (optional)
   - On explicit `/clear-cache` command
   - Never (persist indefinitely)

4. **Performance impact**: How to minimize overhead?
   - Only check `.md` files in `pages/`
   - Cache query results
   - Run validations in parallel

---

## Revision History

| Date | Change | Author |
|------|--------|--------|
| 2024-06-09 | Initial design document | Agent |
