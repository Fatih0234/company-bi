# DuckDB BI Tools Smoke Test

Run from the project root after copying this extension into the repository.

## Load

```bash
pi -e ./.pi/extensions/duckdb-bi/index.ts
```

Expected: Pi starts without an extension load error and shows DuckDB BI tools loaded.

## Tool checks

Ask Pi to call the tools with these inputs.

### 1. DuckDB availability

Tool: `duckdb_run_sql`

```json
{ "sql": "SELECT 42 AS answer;" }
```

Expected: one row with `answer = 42`.

### 2. Data sources

Tool: `duckdb_data_sources`

```json
{ "include_files": true, "include_runtime_dirs": true }
```

Expected: runtime dirs and fixture files.

### 3. List tables

Tool: `duckdb_list_tables`

```json
{ "include_views": true }
```

Expected: file-backed aliases including `sales` and `customers` under schema `files`.

### 4. Describe sales

Tool: `duckdb_describe_table`

```json
{ "table": "sales" }
```

Expected: columns include `order_id`, `customer_id`, `order_date`, `region`, `channel`, `product`, `quantity`, `unit_price`, and `revenue`.

### 5. Sample sales

Tool: `duckdb_sample_rows`

```json
{ "table": "sales", "limit": 5 }
```

Expected: at most five structured rows.

### 6. Summarize sales

Tool: `duckdb_summarize_table`

```json
{ "table": "sales" }
```

Expected: row count, column count, null count for `order_date`, numeric stats for `quantity`, `unit_price`, and `revenue`, and top values for dimensions.

### 7. Quality report sales

Tool: `duckdb_quality_report`

```json
{ "table": "sales", "key_columns": ["order_id"] }
```

Expected: duplicate `order_id` 8 and missing/null `order_date` are reported.

### 8. Export query

Tool: `duckdb_export_query`

```json
{
  "sql": "SELECT region, SUM(revenue) AS revenue FROM read_csv_auto('.pi/extensions/duckdb-bi/tests/fixtures/sales.csv') GROUP BY region ORDER BY revenue DESC;",
  "format": "csv",
  "output_name": "revenue-by-region"
}
```

Expected: CSV under `.pi/duckdb/exports/` and audit entry with artifact path.

### 9. Make report

Tool: `duckdb_make_report`

```json
{
  "title": "Sales Fixture BI Report",
  "summary": "Smoke-test BI report for the bundled sales fixture.",
  "sections": [
    {
      "heading": "Revenue by region",
      "narrative": "Revenue was grouped by region using the exported support table.",
      "artifact_paths": [".pi/duckdb/exports/revenue-by-region.csv"]
    }
  ],
  "output_name": "sales-fixture-bi-report"
}
```

Expected: Markdown file under `.pi/duckdb/reports/`.

### 10. Audit log

Tool: `duckdb_query_audit_log`

```json
{ "limit": 20 }
```

Expected: prior successful queries and export query.

### 11. Unsafe SQL blocked

Tool: `duckdb_run_sql`

```json
{ "sql": "DROP TABLE sales;" }
```

Expected: blocked with `SQL_BLOCKED`; audit log includes blocked entry.

### 12. Path traversal blocked

Tool: `duckdb_export_query`

```json
{ "sql": "SELECT 1 AS x;", "format": "csv", "output_name": "../bad.csv" }
```

Expected: rejected; no file outside `.pi/duckdb/exports/`.

### 13. Truncation

Tool: `duckdb_run_sql`

```json
{ "sql": "SELECT * FROM range(0, 200) AS t(i);", "max_rows": 10 }
```

Expected: at most 10 rows returned, `truncated: true`, full result path saved.

### 14. Summarize with findings

Tool: `duckdb_summarize_table`

```json
{ "table": "taxi_zone_lookup_mini" }
```

Expected: response includes a top-level `findings` array with at least:
- `EDGE_CASE_SENTINEL` on `Borough` (e.g. "Unknown")
- `DUPLICATE_NAME` on `Zone` (Governor's Island appears 3x, Corona 2x)
- `POSSIBLE_DIMENSION` heuristic info finding
- `EDGE_CASE_SENTINEL` on `service_zone` ("N/A")

The same call against the real `data/taxi_zone_lookup.csv` produces an analogous response; the mini fixture is a small drop-in for smoke-testing without pulling the full 50MB parquet.

### 15. Join coverage with auto_discover

Tool: `duckdb_join_coverage`

```json
{
  "dimension_table": "taxi_zone_lookup_mini",
  "key_column": "LocationID",
  "auto_discover": true,
  "timeout_ms": 30000
}
```

Expected:
- `candidates_considered` is non-empty; the rule should be `pu_prefix` and `do_prefix` against `yellow_tripdata_mini`.
- `joins` array has one entry per candidate with `coverage_pct`, `orphans`, `unused`, `type_compatible`, `key_type`, `fk_type`.
- `findings` includes a `LOW_COVERAGE` warning (mini fact has 1 orphan out of 14) and an `UNUSED_DIMENSION_ROWS` info finding (LocationID 6 'Unknown' is never picked up).
- Audit log contains one entry per underlying DuckDB query (describe + count + forward + reverse per candidate).

For the same call against the real `data/taxi_zone_lookup` / `data/yellow_tripdata_2024-01.parquet` files, the output is analogous: 100% forward coverage on both candidates with 4–5 unused dimension rows.
