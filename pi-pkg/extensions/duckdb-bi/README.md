# DuckDB BI Tools for Pi Coding Agent

Project-local Pi Coding Agent extension that exposes safe, structured, BI-oriented DuckDB tools to the model.

This is not a generic DuckDB wrapper. It gives the agent bounded, audited tools for local analysis so it does not improvise fragile shell commands.

## Location

```txt
.pi/extensions/duckdb-bi/
```

Pi auto-discovers project-local extension directories after the project is trusted. You can also test directly:

```bash
pi -e ./.pi/extensions/duckdb-bi/index.ts
```

## Requirements

- Pi Coding Agent
- DuckDB CLI available on `PATH`

Check DuckDB:

```bash
duckdb -version
```

## Registered tools

1. `duckdb_run_sql`
2. `duckdb_list_tables`
3. `duckdb_describe_table`
4. `duckdb_sample_rows`
5. `duckdb_summarize_table` (now returns a `findings` array of interpretation hints)
6. `duckdb_quality_report`
7. `duckdb_export_query`
8. `duckdb_data_sources` (Evidence-aware: lists `sources/*/*.sql` plus business data files)
9. `duckdb_make_report`
10. `duckdb_query_audit_log`
11. `duckdb_join_coverage` (new — check FK coverage in both directions; supports `auto_discover`)

## Safety model

Default behavior is conservative:

- readonly SQL by default
- single-statement SQL only in readonly mode
- blocks destructive SQL keywords such as `DROP`, `DELETE`, `UPDATE`, `INSERT`, `CREATE`, `ALTER`, `COPY`, `INSTALL`, `LOAD`, `ATTACH`, `PRAGMA`, `SET`, and `RESET`
- blocks DuckDB dot commands such as `.system`, `.shell`, `.read`, `.open`, `.output`, and `.once`
- validates DuckDB database/file paths stay inside the project root
- writes exports only under `.pi/duckdb/exports/`
- writes reports only under `.pi/duckdb/reports/`
- records successful, failed, and blocked query attempts in `.pi/duckdb/audit/query-log.jsonl`
- truncates direct query output and saves full results only when requested or useful
- invokes DuckDB through `spawn()` argument arrays, never shell-string concatenation
- uses `-init /dev/null` to avoid hidden `.duckdbrc` side effects

## Runtime directories

```txt
.pi/duckdb/
├── exports/
├── reports/
├── audit/
└── tmp/
```

## Fixture data

Small fixture files are included:

```txt
.pi/extensions/duckdb-bi/tests/fixtures/sales.csv
.pi/extensions/duckdb-bi/tests/fixtures/customers.csv
```

The file-discovery tools expose them through aliases `sales` and `customers` when running in a test root without a `data/` directory, or when `duckdb_data_sources` is called with `mode: "all"`.

## Companion skill: `data-discovery`

A project-local skill at `.pi/skills/data-discovery/SKILL.md` packages the "first pass on an Evidence source or unknown data file" workflow. It auto-loads when the user asks to "discover", "explore", "understand", "what is in", or "audit" data, and walks the agent through orient → shape → identify kind → quality → join coverage → narrative → persist. In this Evidence BI project, it prefers semantic source SQL names such as `tlc.trips` over raw file aliases for dashboard analysis.

The skill cites `query_id`s, leads with a one-line summary, and ends with 2–3 follow-up questions rather than a stats dump. Run `npm test` to validate the skill's frontmatter and the duckdb-* tool names it references.

## Example prompts

```txt
Use duckdb_data_sources to inspect the project data environment.
```

```txt
Use duckdb_run_sql to run SELECT 42 AS answer.
```

```txt
Use DuckDB BI tools to describe, sample, summarize, and quality-check the sales fixture.
```

```txt
Export revenue by region from sales.csv as CSV and create a Markdown BI report.
```

## Automated tests

```bash
npm test
```

Runs `node --test` against:
- `tests/findings.test.ts` — unit tests for the pure findings logic in `src/lib/findings.ts` (all 9 detection codes + `areTypesCompatible` type-checking, with positive and negative cases). Loaded via Node's `--experimental-strip-types`; no transpilation step.
- `tests/join-coverage.test.mjs` — integration test of `duckdb_join_coverage` against the mini fixtures in `tests/fixtures/`. Loaded via jiti with test-only stubs for `@earendil-works/pi-coding-agent` and `typebox` (both are only used at registration time, never at execute time).

Both files run against a real DuckDB CLI; each test creates its own `mkdtemp` project root and cleans up after itself.

## Smoke test checklist

After loading the extension in Pi, ask the agent to run these tool-level checks:

1. `duckdb_run_sql` with `SELECT 42 AS answer;`
2. `duckdb_data_sources` — expect `evidence_sources` for `sources/*/*.sql` and business data files from `data/` by default
3. `duckdb_list_tables` — expect an `evidence_sources` schema when Evidence source SQL exists
4. `duckdb_describe_table` on `sales`
5. `duckdb_sample_rows` on `sales` with limit `5`
6. `duckdb_summarize_table` on `sales`
7. `duckdb_quality_report` on `sales` with `key_columns: ["order_id"]`
8. `duckdb_export_query` for revenue by region
9. `duckdb_make_report` using the query IDs and export path
10. `duckdb_query_audit_log`
11. blocked unsafe SQL: `DROP TABLE sales;`
12. blocked path traversal: export with `output_name: "../bad.csv"`
13. truncation: query more rows than `max_rows`
14. `duckdb_summarize_table` on `taxi_zone_lookup_mini` — expect a `findings` array with `EDGE_CASE_SENTINEL` (Borough N/A/Unknown), `DUPLICATE_NAME` (Zone Governor's Island 3x), `POSSIBLE_DIMENSION` heuristic. Same call against the real `data/taxi_zone_lookup.csv` produces an analogous response.
15. `duckdb_join_coverage` on `taxi_zone_lookup_mini` with `key_column: "LocationID"`, `auto_discover: true` — expect 2 candidates (`pu_prefix`, `do_prefix`), 92.86% forward coverage (1 orphan in the mini fact), `LOW_COVERAGE` warning + `UNUSED_DIMENSION_ROWS` info finding.

## Troubleshooting

### DuckDB not found

Install DuckDB and ensure `duckdb` is on `PATH`.

### Extension not loading

- Verify the path is `.pi/extensions/duckdb-bi/index.ts`.
- Use `pi -e ./.pi/extensions/duckdb-bi/index.ts` for a direct test.
- For auto-discovery, trust the project and use `/reload` or restart Pi.

### CSV aliases not found

Use `duckdb_data_sources` to see discovered file aliases. You can also query files directly:

```sql
SELECT * FROM read_csv_auto('.pi/extensions/duckdb-bi/tests/fixtures/sales.csv') LIMIT 5;
```

## Security note

Pi extensions run locally with your user permissions. Review extension code before loading it, especially code that executes commands, reads files, writes files, or accesses environment variables.
