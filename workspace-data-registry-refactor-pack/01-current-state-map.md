# 01 — Current State Map

This file summarizes the current repo state the implementation agent must understand before editing.

## Repository identity

- Repository: `Fatih0234/company-bi`
- Main branch: `main`
- Purpose: local-first Evidence BI workspaces powered by Pi and CMUX.

## Current product story

The README describes Company BI as a local-first BI development environment where an AI agent builds Evidence dashboards inside a three-pane CMUX workspace. The three core tools are:

- Evidence: renders dashboards from Markdown + SQL.
- Pi: coding agent that edits pages, writes queries, and inspects the browser preview.
- CMUX: three-pane workspace with agent, browser preview, and dev server.

## Current workspace model

`bin/cmux-evidence` creates content-only analysis workspaces. A new content workspace includes:

```text
pages/index.md
pages/draft.md
pages/report.md
queries/
data/
reports/
.cmux/workspace.json
.cmux/evidence.json
.cmux/pi-context.md
```

The user-facing workspace intentionally does not expose root runtime implementation files such as `package.json`, `bin/`, `scripts/`, or `sources/`.

## Current shadow runtime model

`ensure_shadow_runtime` creates a generated Evidence runtime for content-only workspaces.

Current behavior includes:

- symlink/copy root `evidence.config.yaml`, `package.json`, `package-lock.json`,
- symlink/copy root `sources`, `scripts`, `bin`, `pi-pkg`, and `data`,
- symlink workspace `pages`, `queries`, and `reports`,
- link workspace `data` as `workspace-data`,
- write shadow `.cmux/evidence.json`,
- reuse root `.evidence/template/static/data` cache if available.

This is the area where workspace-file source generation must be integrated.

## Current data model

The current root data source is TLC-specific:

```text
sources/tlc/connection.yaml
sources/tlc/trips.sql
sources/tlc/zones.sql
```

`trips.sql` reads:

```text
data/tlc/raw/yellow/*.parquet
data/tlc/raw/green/*.parquet
```

`zones.sql` reads:

```text
data/tlc/reference/taxi_zone_lookup.csv
```

The current scripts can sync TLC data from MinIO. This is the part that should be demoted to an optional example.

## Current scripts

Important scripts:

- `scripts/run_evidence_dev.sh`
- `scripts/ensure_evidence_sources.sh`
- `scripts/sync_tlc_lake_from_minio.sh`
- `scripts/download_tlc_seed_data.py`
- `scripts/upload_tlc_seed_to_minio.sh`

`ensure_evidence_sources.sh` is currently TLC-aware. It checks for TLC local data and MinIO credentials, then runs sources for `tlc`.

## Current Pi package

`pi-pkg/package.json` registers project-local Pi resources:

- extensions: `evidence-context`, `pi-ask-user`, `analysis-intention`, `duckdb-bi`, `lumen-bi`, `evidence-health-check`, `evidence-quality-guard`
- skills: Evidence/dashboard/review/thinking/data-discovery/CMUX/ask-user skills
- prompts: dashboard and slides prompts
- theme: `lumen-bi-midnight`

Repo rule: every new Pi extension, skill, prompt, or theme must be registered in `pi-pkg/package.json`.

## Current `duckdb-bi` foundation

The `duckdb-bi` extension already provides safe BI-oriented DuckDB tools.

Current useful behavior:

- readonly SQL by default,
- destructive SQL blocked,
- path validation,
- audit logs under `.pi/duckdb/audit`,
- exports and reports under `.pi/duckdb`,
- data discovery for `.csv`, `.tsv`, `.parquet`, `.json`, `.jsonl`, `.duckdb`, `.db`,
- content workspaces keep DuckDB cwd at the workspace root so raw `data/...` file reads work during exploration.

Important gap: discovered files are not yet promoted into stable Evidence source tables.

## Current `evidence-context.ts`

The dynamic context extension currently builds a source catalog by scanning `sources/*/*.sql`.

That means it works well for `tlc.trips`, but it does not yet understand `.cmux/data-registry.json` or registered workspace file tables.

## Current dashboard skill

`pi-pkg/skills/evidence-dashboard/SKILL.md` already has the right spirit:

- inspect relevant files before editing,
- test SQL before writing pages,
- use Evidence source names,
- avoid raw file reads in page queries,
- use draft/report/brief conventions,
- validate and preview before completion.

But it is currently biased toward source SQL files and TLC-style data. It needs to be refactored to prefer registered workspace tables.

## Current publish privacy

Tests confirm content workspace publish behavior excludes raw local `data/**` by default. Preserve this.

## What must not be broken

- `cmux-evidence new`
- `cmux-evidence open`
- `cmux-evidence validate`
- `cmux-evidence diff`
- `cmux-evidence publish`
- content-only workspace split root model
- workspace privacy model
- Pi package loading
- existing tests
