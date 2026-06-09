# Evidence Quality Guard Extension

> Unified extension that prevents silent failures in Evidence dashboards by enforcing validation at multiple checkpoints.

## Problem

Evidence dashboards can fail silently:
1. SQL queries return empty datasets
2. Charts render with no data
3. Build succeeds (exit 0)
4. Health check passes (HTTP 200)
5. Agent ships broken page

## Solution

This extension enforces validation **before** page writes are allowed:

| Checkpoint | What We Check | Enforcement |
|------------|---------------|-------------|
| **Query Validation** | SQL queries must be run via `duckdb_run_sql` | Hard block |
| **Empty Dataset Detection** | Queries must return `row_count > 0` | Hard block |
| **Static Analysis** | No Svelte/HTML rendering issues | Hard block |

## How It Works

```
Agent writes page
       │
       ▼
┌──────────────────┐
│ tool_result      │
│ (write/edit)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│ Extract SQL      │     │ Check query      │
│ blocks from      │────►│ validation cache │
│ page content     │     │                  │
└──────────────────┘     └────────┬─────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
              ┌─────▼─────┐               ┌─────▼─────┐
              │ All valid │               │ Not valid │
              │ and have  │               │ or empty  │
              │ data?     │               │           │
              └─────┬─────┘               └─────┬─────┘
                    │                           │
                    ▼                           ▼
              ┌───────────┐             ┌───────────────┐
              │ Allow     │             │ HARD BLOCK    │
              │ write     │             │ Return error  │
              └───────────┘             └───────────────┘
```

## Installation

### Option 1: Auto-discovery (Recommended)

Copy or symlink the extension to `.pi/extensions/`:

```bash
# From project root
cp -r pi-pkg/extensions/evidence-quality-guard .pi/extensions/

# Or symlink
ln -s ../pi-pkg/extensions/evidence-quality-guard .pi/extensions/
```

### Option 2: Manual loading

```bash
pi -e ./pi-pkg/extensions/evidence-quality-guard/index.ts
```

## Usage

### Workflow

1. **Run your SQL queries** via `duckdb_run_sql`:

```sql
SELECT pickup_date, COUNT(*) as trip_count
FROM trips
GROUP BY pickup_date
```

2. **Verify the query returns data** (row_count > 0)

3. **Write the page** - the extension will:
   - Extract SQL blocks from the page
   - Check each block against the validation cache
   - Block if any query hasn't been validated or returns empty

### Example Error Message

If you try to write a page with unvalidated queries:

```
## Evidence Quality Guard — BLOCKED ❌

The page write was blocked because of validation errors.

### 🔍 Query Not Validated
**Line 15 (daily_metrics):** SQL block `daily_metrics` has not been run via `duckdb_run_sql`
**Fix:** Run this query first: `duckdb_run_sql` with the SQL from line 15

### Required Actions
1. **Run unvalidated queries via `duckdb_run_sql`:**
   - `daily_metrics`

3. **Re-write the page after fixing all issues**
```

### Commands

- `/evidence-quality-status` - Show cache status and stats
- `/evidence-quality-clear-cache` - Clear the query validation cache

### Manual Validation Tool

Use the `evidence_validate_page` tool to check a page before writing:

```
evidence_validate_page path="pages/analysis/my-dashboard.md"
```

## Components

| Component | Purpose |
|-----------|---------|
| `query-validator.ts` | Track and validate SQL queries |
| `empty-dataset-detector.ts` | Extract SQL blocks and detect empty results |
| `static-analysis.ts` | Detect Svelte/HTML rendering issues |
| `validation-engine.ts` | Unified validation pipeline |
| `state-manager.ts` | Persistent state management |
| `error-formatter.ts` | Format error messages |

## Query Cache

The extension maintains a cache of validated queries:

- **Storage**: Persisted in session entries via `pi.appendEntry()`
- **Lifetime**: 24 hours (configurable)
- **Size limit**: 500 queries (oldest evicted when full)

### Cache Operations

- Queries are automatically cached when `duckdb_run_sql` returns results
- Cache survives session restarts
- Use `/evidence-quality-clear-cache` to manually clear

## Configuration

### Environment Variables

None required. The extension uses:

- `duckdb_run_sql` tool for query validation
- Session entries for state persistence

### Customization

Edit `types.ts` to adjust:

- `CACHE_EXPIRY_MS` - Query cache lifetime (default: 24 hours)
- `MAX_CACHED_QUERIES` - Maximum cache size (default: 500)

## Integration with Existing Extensions

This extension replaces:

- `evidence-render-guard.ts` - Static analysis logic moved here
- `scripts/validate-build.sh` - Build validation integrated

Keep:

- `evidence-health-check.ts` - Different purpose (server health)
- `evidence-context.ts` - Different purpose (context provision)

## Testing

### Unit Tests

```bash
cd pi-pkg/extensions/evidence-quality-guard
npm test
```

### Manual Testing

1. **Test unvalidated query block**:
   - Create a page with SQL blocks
   - Don't run queries via `duckdb_run_sql`
   - Try to write the page
   - Expect: Block with "Query Not Validated" error

2. **Test empty query block**:
   - Run a query that returns 0 rows
   - Write a page using that query
   - Expect: Block with "Query Returns No Data" error

3. **Test static analysis issue**:
   - Create a page with `<1` in plain text
   - Try to write the page
   - Expect: Block with "Rendering Issue" error

4. **Test successful write**:
   - Run all queries via `duckdb_run_sql`
   - Verify they return data
   - Write the page
   - Expect: Write succeeds

## Troubleshooting

### "Query Not Validated" but I already ran it

The query hash might not match. Check:
- SQL is exactly the same (whitespace, case, comments)
- Query completed successfully (not blocked by SQL safety)
- Cache hasn't expired

### Extension not loading

Check:
- File is in `.pi/extensions/` or loaded via `-e`
- No TypeScript errors
- Dependencies installed

### Performance issues

The extension is lightweight:
- Static analysis: ~1ms per page
- Query validation: ~0.1ms per query lookup
- No external processes spawned

## Recent Fixes (June 2026)

### Bug Fixes

| Commit | Fix | Root Cause |
|--------|-----|------------|
| `1ccfae7` | Cache persistence across sessions | Singleton retained stale `pi` reference after extension reload on session switch |
| `1ccfae7` | `block.sql` → `block.content` in error messages | `SqlBlock` interface uses `content` property, not `sql` |
| `1ccfae7` | `parseDuckDbResponse` accepts `event.details` | `event.content` is an array of content blocks, not the data object |
| `4296f56` | Intercept `bash` tool for file writes | Agent could bypass validation using `cat > file` via bash |
| `4296f56` | Show exact SQL in error messages | Agent didn't know which SQL to run |
| `5a56241` | Return `content` as array in `tool_result` | Pi expects `[{ type: 'text', text: '...' }]` format |
| `1fdee2e` | Import `getStateManager` function | Missing import caused runtime error |

### SQL Block Name Parsing

The extension now correctly handles `query=` prefixes in SQL blocks:

```markdown
```sql query=service_summary
SELECT ... 
```
```

Previously, the block name was stored as `query=service_summary`. Now it correctly extracts `service_summary`.

### Stricter HTML Tag Validation

All HTML tags (even valid ones like `<div>`) will crash the Svelte renderer in Evidence markdown. The extension now:

- Flags ALL HTML tags as errors (not just invalid ones)
- Only allows Evidence components (e.g., `<DataTable>`, `<BarChart>`)
- Changed severity from `warning` to `error`

### Testing

Run the regression test suite:

```bash
# In workspace the-new-entrants-nyc-playbook16
# Follow pages/quality-guard-test.md step by step
```

## License

MIT
