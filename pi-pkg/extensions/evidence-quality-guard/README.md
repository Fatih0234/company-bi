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
| **Insight Candidate Scan** | `draft.md` must contain required planning sections | Hard block |
| **Data Profiling** | Data must be profiled before writing SQL queries | Hard block |
| **Documentation Lookup** | Component docs must be read before using components | Hard block |
| **Query Validation** | SQL queries must be run via `duckdb_run_sql` | Hard block |
| **Empty Dataset Detection** | Queries must return `row_count > 0` | Hard block |
| **Static Analysis** | No Svelte/HTML rendering issues | Hard block |
| **Chart Title Quality** | Titles should be insight-first, not descriptive | Warning |
| **Review Completed** | Pages should be validated before publishing | Checklist |

### Insight Candidate Scan Enforcement

Before writing to any page except `draft.md` and `index.md`, the extension verifies that `pages/draft.md` contains:

- `## Insight Candidate Scan`
- `## Report Design Plan`

This enforces the **evidence-bi-thinking** workflow:
1. Generate insight candidates (analytical moves)
2. Write the Report Design Plan to `draft.md`
3. Get user alignment on the plan
4. Then write to the target page

If these sections are missing, the write is blocked with instructions to run the `evidence-bi-thinking` skill first.

### Data Profiling Enforcement

Before writing to pages with SQL queries, the extension verifies that data profiling was performed:

- `duckdb_summarize_table` — for distribution, distinct counts, and findings
- `duckdb_describe_table` — for column names and types
- `duckdb_quality_report` — for data quality issues

This enforces the **data-discovery** workflow:
1. Profile the data first
2. Understand column types, distributions, and quality issues
3. Then write SQL queries with confidence

If no profiling calls are detected, the write is blocked.

### Documentation Lookup Enforcement

Before writing to pages with Evidence components (BarChart, LineChart, BigValue, etc.), the extension verifies that documentation was consulted:

- Read `.agent/docs/evidence-oss/ROUTES.md` for task-based routing
- Follow links to specific component documentation
- Extract exact props, syntax, and patterns

This prevents guessing component props and getting them wrong.

If no documentation reads are detected, the write is blocked.

### Chart Title Quality Check

The extension now checks for generic/descriptive chart titles and encourages insight-first titles:

**Generic titles (flagged as warnings):**
- "Revenue by Zone"
- "Top 10 Areas"
- "Monthly Trends"
- "Distribution of Fares"

**Insight-first titles (preferred):**
- "Airports generate 3x more revenue per trip"
- "East Village leads pickup volume"
- "Revenue peaked in January before declining"

The check also verifies that charts have interpretation text after them explaining the insight.

### Review Before Publishing

The extension tracks page validations as "review activity". Before marking a dashboard as ready, the `evidence_dashboard_readiness` tool checks that at least one page was validated using `evidence_validate_page`.

This ensures the dashboard has been reviewed before publication.

## How It Works

```
Agent writes page
       │
       ▼
┌──────────────────┐
│ tool_call        │
│ (write/edit)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Is target page   │
│ draft.md or      │──── Yes ──► Skip Insight Scan check
│ index.md?        │
└────────┬─────────┘
         │ No
         ▼
┌──────────────────┐
│ Check draft.md   │
│ for required     │
│ planning sections│
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
 Missing   Present
    │         │
    ▼         ▼
┌────────┐ ┌──────────────────┐
│ BLOCK  │ │ Check if page    │
│ with   │ │ has SQL queries  │
│ action │ └────────┬─────────┘
│ items  │          │
└────────┘    ┌─────┴─────┐
              │           │
          Has SQL     No SQL
              │           │
              ▼           ▼
    ┌─────────────┐   Skip
    │ Data        │   profiling
    │ profiled?   │   check
    └──────┬──────┘
           │
      ┌────┴────┐
      │         │
    No        Yes
      │         │
      ▼         ▼
┌──────────┐ ┌──────────────────┐
│ BLOCK    │ │ Check if page    │
│ requires │ │ has components   │
│ profiling│ └────────┬─────────┘
└──────────┘          │
                ┌─────┴─────┐
                │           │
            Has comps   No comps
                │           │
                ▼           ▼
      ┌─────────────┐   Skip
      │ Docs        │   doc check
      │ read?       │
      └──────┬──────┘
             │
        ┌────┴────┐
        │         │
      No        Yes
        │         │
        ▼         ▼
  ┌──────────┐ ┌──────────────────┐
  │ BLOCK    │ │ Extract SQL      │
  │ requires │ │ blocks from      │
  │ docs     │ │ page content     │
  └──────────┘ └────────┬─────────┘
                        │
                        ▼
             ┌──────────────────┐
             │ Check query      │
             │ validation cache │
             └────────┬─────────┘
                      │
             ┌────────┴────────┐
             │                 │
        ┌────▼────┐      ┌────▼────┐
        │ All     │      │ Not     │
        │ valid?  │      │ valid   │
        └────┬────┘      └────┬────┘
             │                │
             ▼                ▼
       ┌──────────┐    ┌───────────┐
       │ Allow    │    │ HARD      │
       │ write    │    │ BLOCK     │
       └──────────┘    └───────────┘
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

### Tools

| Tool | Purpose |
|------|--------|
| `evidence_validate_page` | Validate a single page for query validation and rendering issues |
| `evidence_dashboard_readiness` | Check if a dashboard is ready for publication (all quality gates) |

### Dashboard Readiness Checklist

Run `evidence_dashboard_readiness` at the end of a dashboard build to verify all quality gates:

```
evidence_dashboard_readiness workspacePath="/Volumes/T7/projects/company-bi"
```

Output:
```
## Dashboard Readiness Checklist

✅ **All checks passed — dashboard is ready for review/publishing**

### Checks

- ✅ **Data Profiled**: 3 tables profiled: files.trips, files.zones, files.taxi_zone_lookup
- ✅ **Insight Candidate Scan**: Found in draft.md
- ✅ **Report Design Plan**: Found in draft.md
- ✅ **Documentation Consulted**: 5 docs read
- ✅ **SQL Queries Validated**: 12 queries validated
- ✅ **Report Page Exists**: report.md found
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
