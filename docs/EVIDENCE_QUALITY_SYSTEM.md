# Evidence Dashboard Quality System

> **Purpose**: Prevent silent failures in Evidence dashboards. This document captures lessons learned and mandatory validation steps that must be followed when building Evidence pages.

> **Origin**: Created after a silent failure where BarChart components rendered with empty datasets because SQL queries returned no data, but the build succeeded with exit code 0.

---

## Table of Contents

1. [The Problem](#the-problem)
2. [Immediate Solutions](#immediate-solutions)
3. [Build Validation Script](#build-validation-script)
4. [Query Validation Rule](#query-validation-rule)
5. [Screenshot Validation Protocol](#screenshot-validation-protocol)
6. [Common Failure Modes](#common-failure-modes)
7. [Debugging Playbook](#debugging-playbook)
8. [Future Enhancements](#future-enhancements)

---

## The Problem

### Silent Failure Chain

```
1. Agent writes SQL queries in a page
2. Evidence runs them → they return EMPTY datasets
3. BarChart components get empty data → log warnings (not errors)
4. Build completes successfully (exit code 0)
5. Agent checks health → HTTP 200 OK → "everything looks good"
6. Screenshots show static content at top → Agent doesn't scroll to charts
7. Agent ships broken page with confidence
```

### Why It's Dangerous

| What Looks OK | What's Actually Broken |
|---------------|------------------------|
| Build exit code 0 | Charts have no data |
| HTTP 200 status | BarCharts render empty |
| Static content renders | DataTables show headers only |
| No compilation errors | BigValues show no data |

---

## Immediate Solutions

### 1. Build Validation Script

**Location**: `scripts/validate-build.sh`

**Purpose**: Parse build output and fail on empty dataset warnings that Evidence ignores.

**Usage**:
```bash
# From the Evidence template directory
bash scripts/validate-build.sh

# Or from project root
bash /path/to/scripts/validate-build.sh
```

**What It Catches**:
- Empty dataset warnings: `Dataset is empty: query ran successfully, but no data was returned`
- Chart component errors: `Error in Bar Chart`, `Error in DataTable`
- Build failures (non-zero exit codes)

**Output Example**:
```
=== Build Validation Report ===
Build exit code: 0
Empty dataset warnings: 4
Chart component errors: 4

❌ FAIL: 4 empty dataset warnings found
Charts will render with no data. Fix queries before shipping.

Warnings:
Error in Bar Chart: Dataset is empty: query ran successfully, but no data was returned from the database
Error in Bar Chart: Dataset is empty: query ran successfully, but no data was returned from the database
Error in Bar Chart: Dataset is empty: query ran successfully, but no data was returned from the database
Error in Bar Chart: Dataset is empty: query ran successfully, but no data was returned from the database

Command exited code 1
```

---

### 2. Query Validation Rule

**Rule**: Never embed a SQL query in a page without first verifying it returns data.

**Mandatory Steps**:

```
BEFORE writing any <BarChart>, <DataTable>, or <BigValue>:

1. Extract the SQL query from your planned page
2. Run it via duckdb_run_sql with the same database
3. Check row_count > 0
4. If row_count = 0, DEBUG THE QUERY before writing the page
5. Only then write the page component
```

**Why This Works**:
- Catches empty queries at authoring time, not build time
- Forces you to understand why queries return empty
- Prevents "trust the tool"侥幸心理

**Example**:
```sql
-- BAD: Write page first, hope query works
<BarChart data={airport_data} x=Zone y=revenue />

-- GOOD: Verify query first
duckdb_run_sql:
  SELECT zone, SUM(total_amount) as revenue
  FROM zones z JOIN trips t ON z.location_id = t.pickup_location_id
  WHERE z.service_zone = 'Airports'
  GROUP BY zone

-- row_count: 2 ✓ (JFK and LaGuardia)
-- Now write the page
```

---

### 3. Screenshot Validation Protocol

**Rule**: After building, visually confirm every chart renders with data.

**Steps**:

```
1. Open the page in browser
2. Take a FULL PAGE screenshot (not just viewport)
3. Scroll to EVERY chart component
4. For each chart, verify:
   - Bars are visible (not empty axes)
   - Data labels show values
   - Tables have rows (not just headers)
   - BigValues show numbers (not blank)
5. If ANY chart is empty, treat as build failure
```

**Tools**:
```bash
# Take full page screenshot
cmux-evidence preview-screenshot "surface:XX" /tmp/full-page.png --full-page

# Or scroll and take multiple viewport screenshots
cmux-evidence preview-screenshot "surface:XX" /tmp/page-top.png
# ... scroll down ...
cmux-evidence preview-screenshot "surface:XX" /tmp/page-middle.png
```

**What to Look For**:
- ❌ Empty axes with no bars
- ❌ Table headers with zero rows
- ❌ BigValue showing blank or "N/A"
- ❌ "No data available" messages
- ✅ Visible bars with labels
- ✅ Multiple data rows in tables
- ✅ Numbers in BigValue components

---

## Build Validation Script

### Full Script

```bash
#!/bin/bash
# validate-build.sh - Catch silent failures in Evidence builds
# Exit with error if any warnings about empty datasets

BUILD_OUTPUT=$(npm run build 2>&1)
BUILD_EXIT=$?

# Check for empty dataset warnings
EMPTY_WARNINGS=$(echo "$BUILD_OUTPUT" | grep -c "Dataset is empty" || true)

# Check for chart errors
CHART_ERRORS=$(echo "$BUILD_OUTPUT" | grep -c "Error in Bar Chart\|Error in DataTable" || true)

echo "=== Build Validation Report ==="
echo "Build exit code: $BUILD_EXIT"
echo "Empty dataset warnings: $EMPTY_WARNINGS"
echo "Chart component errors: $CHART_ERRORS"

if [ "$EMPTY_WARNINGS" -gt 0 ]; then
    echo ""
    echo "❌ FAIL: $EMPTY_WARNINGS empty dataset warnings found"
    echo "Charts will render with no data. Fix queries before shipping."
    echo ""
    echo "Warnings:"
    echo "$BUILD_OUTPUT" | grep "Dataset is empty"
    exit 1
fi

if [ "$CHART_ERRORS" -gt 0 ]; then
    echo ""
    echo "❌ FAIL: $CHART_ERRORS chart component errors found"
    exit 1
fi

if [ "$BUILD_EXIT" -ne 0 ]; then
    echo ""
    echo "❌ FAIL: Build failed with exit code $BUILD_EXIT"
    exit $BUILD_EXIT
fi

echo ""
echo "✅ PASS: No silent failures detected"
exit 0
```

### Installation

```bash
# Save to project
mkdir -p scripts
chmod +x scripts/validate-build.sh

# Run before every page ship
scripts/validate-build.sh
```

---

## Query Validation Rule

### System Prompt Addition

Add this to agent instructions:

```markdown
## Query Validation Rule

**RULE: Never embed a SQL query in an Evidence page without first verifying it returns data.**

### Before Writing Any Chart Component

1. Extract the SQL query you plan to use
2. Run it via `duckdb_run_sql` tool
3. Check the response for `row_count > 0`
4. If `row_count = 0`:
   - Debug the query (check table names, column names, filters)
   - Verify source definitions match your query syntax
   - Check for case sensitivity issues (e.g., `Zone` vs `zone`)
   - Fix the query until it returns data
5. Only AFTER verifying data exists, write the page component

### Common Issues That Cause Empty Results

| Issue | Symptom | Fix |
|-------|---------|-----|
| Wrong table name | Query returns 0 rows | Check source SQL file for actual table/column names |
| Case mismatch | Query returns 0 rows | Use exact column names from source (e.g., `zone` not `Zone`) |
| Over-restrictive filter | Query returns 0 rows | Remove WHERE clauses and add back incrementally |
| Join failure | Query returns 0 rows | Verify FK relationships and data exists in both tables |
| Empty source | Query returns 0 rows | Check if parquet/CSV files exist and are accessible |

### Validation Checklist

- [ ] SQL query runs successfully via `duckdb_run_sql`
- [ ] Response shows `row_count > 0`
- [ ] Column names match what Evidence expects
- [ ] Query logic makes business sense
- [ ] Results are non-trivial (not just 1-2 rows unless expected)
```

---

## Screenshot Validation Protocol

### Detailed Steps

```
1. BUILD THE PAGE
   - Run npm run build or evidence dev
   - Wait for server to start

2. OPEN IN BROWSER
   - Navigate to the page URL
   - Wait for full render

3. TAKE FULL PAGE SCREENSHOT
   - Use cmux-evidence preview-screenshot with --full-page flag
   - Or manually scroll and capture

4. SCROLL AND INSPECT EACH SECTION
   For each chart/table component:
   - [ ] Is the component visible?
   - [ ] Does it have data (bars, rows, numbers)?
   - [ ] Are there any error messages?
   - [ ] Does the data match what you expected?

5. CHECK FOR COMMON ISSUES
   - Empty BarChart: axes visible but no bars
   - Empty DataTable: headers visible but no rows
   - Empty BigValue: label visible but no number
   - Error messages: "No data", "Dataset is empty"

6. DOCUMENT EVIDENCE
   - Save screenshots showing working charts
   - Note any issues found
   - Fix issues before shipping

7. FINAL VERDICT
   - ALL charts render with data → PASS
   - ANY chart is empty or broken → FAIL (fix first)
```

### Quick Validation Command

```bash
# Build and validate in one step
cd .evidence/template && npm run build && bash scripts/validate-build.sh
```

---

## Common Failure Modes

### 1. Source Name Mismatch

**Problem**: Query references `zones` but source is defined as `tlc.zones`

**Symptom**: Query returns 0 rows

**Fix**: Check source SQL files for actual names:
```sql
-- Check source definition
cat sources/tlc/zones.sql

-- Use correct name in query
SELECT * FROM zones  -- if source defines just "zones"
-- OR
SELECT * FROM tlc.zones  -- if namespaced
```

### 2. Column Case Mismatch

**Problem**: Query uses `Zone` but source defines `zone`

**Symptom**: Query returns 0 rows or column not found error

**Fix**: Use exact column names from source:
```sql
-- Source defines: location_id, borough, zone, service_zone
-- Use lowercase:
SELECT zone, borough FROM zones

-- NOT:
SELECT Zone, Borough FROM zones  -- ❌ Wrong case
```

### 3. Empty Result Set

**Problem**: Query is syntactically correct but returns 0 rows

**Symptom**: Build succeeds, charts render empty

**Fix**: Debug incrementally:
```sql
-- Step 1: Remove all filters
SELECT * FROM zones LIMIT 5

-- Step 2: Add filters back one by one
SELECT * FROM zones WHERE service_zone = 'Airports'

-- Step 3: Check if data exists
SELECT COUNT(*) FROM zones WHERE service_zone = 'Airports'
```

### 4. Join Failure

**Problem**: FK relationships don't match, resulting in 0 joined rows

**Symptom**: Query returns 0 rows despite data in both tables

**Fix**: Verify join keys:
```sql
-- Check if keys exist in both tables
SELECT DISTINCT pickup_location_id FROM trips LIMIT 5
SELECT DISTINCT location_id FROM zones LIMIT 5

-- Verify join works
SELECT COUNT(*) FROM zones z
JOIN trips t ON z.location_id = t.pickup_location_id
```

---

## Debugging Playbook

### When Charts Are Empty

```
1. EXTRACT THE QUERY
   - Copy the SQL from the page markdown

2. RUN VIA DUCKDB_RUN_SQL
   - Use the same database/path as Evidence
   - Check row_count in response

3. IF ROW_COUNT = 0
   - Check table names match source definitions
   - Check column names (case sensitive!)
   - Remove filters and test incrementally
   - Verify data exists in source tables

4. IF ROW_COUNT > 0 BUT CHART EMPTY
   - Check column aliases match chart component expectations
   - Verify data types (strings vs numbers)
   - Check for NULL values in key columns

5. FIX AND REBUILD
   - Make one change at a time
   - Rebuild and validate after each change
```

### Validation Commands

```bash
# Check if query returns data
duckdb_run_sql "SELECT COUNT(*) as cnt FROM zones"

# Check source definition
cat sources/tlc/zones.sql

# Check actual column names
duckdb_run_sql "SELECT * FROM zones LIMIT 1"

# Test join
duckdb_run_sql "SELECT COUNT(*) FROM zones z JOIN trips t ON z.location_id = t.pickup_location_id"

# Run build validation
scripts/validate-build.sh
```

---

## Future Enhancements

### 1. Evidence Plugin: Strict Charts

Build a custom plugin that wraps chart components:

```javascript
// @company-bi/strict-charts
import { BarChart } from '@evidence-dev/core-components';

export function StrictBarChart(props) {
  if (!props.data || props.data.length === 0) {
    throw new Error(
      `BarChart "${props.title}" has empty data. ` +
      `Query returned 0 rows. Fix the query before rendering.`
    );
  }
  return BarChart(props);
}
```

### 2. Post-Build Validation API

Evidence could expose a validation endpoint:

```
GET /api/validation/charts
Response: {
  "charts": [
    { "component": "BarChart", "title": "Airport Revenue", "hasData": true },
    { "component": "DataTable", "title": "Zone Analysis", "hasData": false }
  ],
  "valid": false
}
```

### 3. CI/CD Integration

```yaml
# .github/workflows/validate.yml
- name: Build and validate
  run: |
    cd .evidence/template
    npm run build
    bash scripts/validate-build.sh
```

### 4. Evidence Core Enhancement

Request Evidence to:
- Add `--strict` flag to `npm run build` that fails on warnings
- Add `data-required` prop to chart components
- Add build-time data validation

---

## Appendix: File Locations

| File | Location | Purpose |
|------|----------|---------|
| Build Validation Script | `scripts/validate-build.sh` | Catches empty dataset warnings |
| Quality System Doc | `docs/EVIDENCE_QUALITY_SYSTEM.md` | This document |
| Validation Checklist | `.pi/VALIDATION_CHECKLIST.md` | Quick reference checklist |
| Source SQL Files | `sources/tlc/*.sql` | Data source definitions |
| Evidence Pages | `pages/*.md` | Dashboard pages |

---

## Revision History

| Date | Change | Author |
|------|--------|--------|
| 2024-06-09 | Initial creation after silent failure incident | Agent |
