# 09 — Pi Extension Tooling Spec

## Purpose

Update Pi-side tooling so the agent understands workspace-local registered data tables.

## Existing foundation

The `duckdb-bi` extension already provides safe DuckDB tools for local BI analysis. It should remain the main data-tool extension.

Current useful tools include:

- `duckdb_run_sql`
- `duckdb_list_tables`
- `duckdb_describe_table`
- `duckdb_sample_rows`
- `duckdb_summarize_table`
- `duckdb_quality_report`
- `duckdb_data_sources`
- `duckdb_join_coverage`

## MVP change

Upgrade `duckdb_data_sources` so registered workspace tables appear as first-class dashboard sources.

New output should include:

```json
{
  "registered_tables": [
    {
      "name": "files.orders",
      "alias": "orders",
      "path": "data/orders.csv",
      "format": "csv",
      "status": "ready",
      "recommended_for_dashboard": true
    }
  ]
}
```

Raw discovered files should remain available but should not be the preferred dashboard source after registration.

## Optional new tool

Add later if needed:

```text
duckdb_refresh_workspace_data
```

Purpose: allow Pi to call the same refresh path as CLI.

Do not duplicate registry logic in TypeScript unless necessary. Prefer invoking the CLI/helper safely.

## Tool safety requirements

Any new or modified tool must preserve:

- readonly query defaults,
- destructive SQL blocking,
- strict path validation,
- no arbitrary shell-string execution,
- outputs under `.pi/duckdb/**`,
- audit logging for query tools.

## Registration reminder

If adding a new tool inside an already registered extension, update:

- `src/constants.ts`,
- `src/register-tools.ts`,
- relevant tests.

No `pi-pkg/package.json` change is needed unless adding a brand-new extension asset.

## Context behavior

Pi should learn this hierarchy:

1. Registered workspace tables: recommended for dashboard.
2. Evidence sources: also valid if present.
3. Raw files: candidates; refresh/register before dashboard use.
4. DuckDB scratch exports: not dashboard source unless explicitly promoted.
