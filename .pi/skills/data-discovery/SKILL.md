---
name: data-discovery
description: Discover and explain Evidence sources or project-local data using the DuckDB BI tools. Use when the user asks to "discover", "explore", "understand", "what is in", "explain", "describe", "profile", or "audit" an Evidence source, CSV, Parquet, JSON, or DuckDB file. Runs a repeatable shape → quality → join-coverage → narrative workflow and ends with follow-up questions, not a stats dump.
---

# Data Discovery (DuckDB BI)

Run this workflow when the user wants to understand an Evidence source or unknown data file. In this BI project, **prefer Evidence source SQL first** (`sources/*/*.sql`, exposed as names like `tlc.trips` and `tlc.zones`) because dashboards should be built on semantic sources, not raw files. Fall back to raw CSV/Parquet/JSON/DuckDB files when the source SQL is missing, broken, or the user explicitly asks for raw data. The goal is a **one-paragraph narrative** with cited findings and 2–3 follow-up questions — not a column inventory.

The DuckDB BI tools (`duckdb_*`) are registered by the `duckdb-bi` extension in `.pi/extensions/duckdb-bi/`. Every SQL query they run is logged under `.pi/duckdb/audit/query-log.jsonl` with a `query_id`. **Cite `query_id`s in the narrative so results are reproducible.**

## Workflow

### 1. Orient (skip if context is obvious)

- `duckdb_data_sources` — see Evidence sources, business data files, aliases, and runtime artifact paths. Default `mode: "business"` intentionally ignores generated/internal dirs; use `mode: "all"` only when debugging discovery itself.
- `duckdb_query_audit_log` (limit 20) — don't re-discover what's already been run.

If the user named an Evidence source or file directly, skip this and go to step 2.

### 2. Shape

For each candidate table/source. Prefer names from `evidence_sources` (for example `tlc.trips`) over raw file aliases when the goal is dashboard analysis:

- `duckdb_describe_table` — column names and types.
- `duckdb_sample_rows` (limit 5–10) — semantic content. **Type alone does not tell you what `Zone` means.**
- `duckdb_summarize_table` — distributions, distinct counts, and the `findings` array. **Each `findings[]` entry is a question, not noise.** In particular:
  - `EDGE_CASE_SENTINEL` — flag which column and which values (`N/A`, `Unknown`, …).
  - `DUPLICATE_NAME` — display-name collisions, not data dups. E.g. "Governor's Island" maps to 3 LocationIDs.
  - `POSSIBLE_DIMENSION` / `POSSIBLE_FACT` — heuristic guess at the table's role.
  - `NON_UNIQUE_PRIMARY_KEY` / `PK_GAPS_*` — PK integrity.
  - `CONSTANT_COLUMN` / `LOW_DIVERSITY` — columns that won't help analysis.
  - `HIGH_CARDINALITY_CATEGORICAL` — likely an ID, not a grouping dimension.

### 3. Identify table kind

Surface this as a guess, not a label:

| Kind | Signals | Example |
|---|---|---|
| **Dimension / lookup** | small (<10k rows), mostly text, one numeric PK-like column, no numeric measures | `taxi_zone_lookup` (265 rows, 4 text + 1 INT ID) |
| **Fact / event** | many rows, mix of numeric measures + FK-like columns + a timestamp | `yellow_tripdata_2024_01` (parquet, PULocationID/DOLocationID/fare_amount/…) |
| **Reference / config** | tiny, mostly constants | a feature flag table |
| **Junk / ad-hoc** | duplicates, all-null columns, no consistent schema | flag and ask before continuing |

### 4. Quality

- `duckdb_quality_report` with `key_columns: [<pk>]` for the PK columns identified in step 2.
- For fact tables, also pass `date_columns: [<timestamp_col>]` if one exists.
- Treat findings:
  - `severity: error` → **blocker**, must be resolved before analysis.
  - `severity: warning` → "explain before aggregating."
  - `severity: info` → mention but don't dwell.

### 5. Join coverage (for dimension/lookup tables)

- `duckdb_join_coverage` with `dimension_table`, `key_column`, and either explicit `candidates` or `auto_discover: true`. Prefer explicit Evidence-source candidates when known (for example dimension `tlc.zones` with candidates from `tlc.trips`) so coverage reflects dashboard semantics.
- Read both directions:
  - **Orphans** (fact rows with no dimension match) — usually a stale snapshot or pipeline bug.
  - **Unused dimension rows** — often fine, but sometimes the dim has grown past its consumers.
- If `coverage_pct < 99`, run `duckdb_run_sql` on a sample of orphans to diagnose:
  - Are they `NULL` FKs? (`WHERE fk IS NULL`)
  - Wrong-type joins? (check `key_type` vs `fk_type` in the response)
  - Off-by-one ID shifts? (orphan IDs cluster just above/below the max valid ID?)

### 6. Narrative summary

The deliverable. Structure:

1. **One-line summary** — kind of table + one-sentence purpose guess. Example: *"NYC TLC zone lookup: 265 rows mapping LocationID → (Borough, Zone, service_zone), with 3 LocationIDs sharing the 'Governor's Island' Zone name and 3 edge-case Borough values."*
2. **Key counts** — row count, distinct PK count, date range if applicable. Cite `query_id`s.
3. **Findings worth attention** — bullet the items from the `findings` arrays that change the user's decisions (edge cases, duplicates, coverage gaps, NULL-heavy columns). Skip noise.
4. **Join coverage** — if applicable, state `coverage_pct` and describe the orphan/unused populations.
5. **Follow-up questions** — 2–3, phrased as choices the user can pick from. E.g. *"Want me to (a) profile the 3 edge-case Borough rows, (b) check the DO-side coverage gap, or (c) move on to a fact-table aggregate?"*

### 7. Persist (optional, encouraged for non-trivial work)

- `duckdb_export_query` to save the orphan population, the duplicate-name list, or any other "save this for later" result. They go under `.pi/duckdb/exports/`.
- `duckdb_make_report` to wrap the narrative + `query_id`s + exports into one Markdown report under `.pi/duckdb/reports/`. Reference the report path at the end of the narrative.
- Treat `.pi/duckdb/**` as local scratch/provenance. Do not use it as the final dashboard deliverable; convert important findings into Evidence-native Markdown/SQL under `pages/` or `queries/` when the user wants them in the dashboard.

## Style rules

- **Story, not stats.** "265 rows, 3 LocationIDs sharing 'Governor's Island', 3 edge-case Boroughs" beats "row_count: 265, column_count: 4".
- **Cite `query_id`s.** Every claim should be traceable to the audit log.
- **Quote exact sentinel values** by name (`N/A`, `Unknown`, …) so the user can decide how to handle them.
- **Don't over-tool.** If a question can be answered from existing findings, answer it. Only run new queries when the existing data doesn't already imply the answer.
- **Ask, don't assume** when the next step is genuinely ambiguous. 2–3 follow-up questions > 1 dictated next move.

## Reference queries

Copy and adapt. These are starting points, not templates to run verbatim.

```sql
-- Duplicate values in a name-like column (dim sanity check)
SELECT Zone, COUNT(*) AS c
FROM taxi_zone_lookup
GROUP BY 1
HAVING c > 1
ORDER BY c DESC;

-- Edge-case sentinels in a categorical column
SELECT Borough, COUNT(*) AS c
FROM taxi_zone_lookup
WHERE UPPER(TRIM(Borough)) IN ('N/A','UNKNOWN','OTHER','TBD','NONE','NULL','-')
GROUP BY 1
ORDER BY c DESC;

-- Join coverage in both directions
SELECT
  (SELECT COUNT(*) FROM yellow_tripdata_2024_01 f LEFT JOIN taxi_zone_lookup d ON f.PULocationID = d.LocationID WHERE d.LocationID IS NULL) AS pu_orphans,
  (SELECT COUNT(*) FROM yellow_tripdata_2024_01 f LEFT JOIN taxi_zone_lookup d ON f.DOLocationID = d.LocationID WHERE d.LocationID IS NULL) AS do_orphans;

-- Spot-check orphan rows (NULL FK? type mismatch? off-by-one?)
SELECT PULocationID, COUNT(*) AS c
FROM yellow_tripdata_2024_01
WHERE PULocationID IS NOT NULL
  AND PULocationID NOT IN (SELECT LocationID FROM taxi_zone_lookup)
GROUP BY 1
ORDER BY c DESC
LIMIT 10;

-- Distinct PK count (for "is this a clean dimension?" check)
SELECT COUNT(DISTINCT LocationID) AS distinct_ids, COUNT(*) AS row_count FROM taxi_zone_lookup;
```

## Quick reference: tools by step

| Step | Tool(s) |
|---|---|
| 1. Orient | `duckdb_data_sources`, `duckdb_query_audit_log` |
| 2. Shape | `duckdb_describe_table`, `duckdb_sample_rows`, `duckdb_summarize_table` |
| 3. Identify kind | (inference from step 2 — no tool) |
| 4. Quality | `duckdb_quality_report` with `key_columns`, `date_columns` |
| 5. Join coverage | `duckdb_join_coverage` with `auto_discover: true` or explicit `candidates` |
| 6. Narrative | (inference + write-up) |
| 7. Persist | `duckdb_export_query`, `duckdb_make_report` |
| Diagnose deep-dives | `duckdb_run_sql` |
