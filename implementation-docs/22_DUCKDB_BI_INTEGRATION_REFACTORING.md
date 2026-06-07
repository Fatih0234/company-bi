# DuckDB BI Integration Refactoring Analysis

Date: 2026-06-07

## Context

The `duckdb-bi` Pi extension was imported source-only from `/Volumes/T7/sandbox/pi-duckdb` into this Evidence BI agent project. It currently works as a generic project-local DuckDB exploration extension, but it was designed in a sandbox and does not yet understand this repository's Evidence/CMUX conventions.

This document identifies the parts that should be refactored or adapted before treating the tools as first-class BI-agent infrastructure.

## Current imported surface

Extension: `.pi/extensions/duckdb-bi/`

Registered tools:

- `duckdb_run_sql`
- `duckdb_list_tables`
- `duckdb_describe_table`
- `duckdb_sample_rows`
- `duckdb_summarize_table`
- `duckdb_quality_report`
- `duckdb_export_query`
- `duckdb_data_sources`
- `duckdb_make_report`
- `duckdb_query_audit_log`
- `duckdb_join_coverage`

Companion skill: `.pi/skills/data-discovery/SKILL.md`

Runtime artifacts: `.pi/duckdb/{audit,exports,reports,tmp}`; ignored by Git.

## Existing BI-agent project surfaces that overlap

### 1. Evidence context extension

File: `.pi/extensions/evidence-context.ts`

Existing responsibilities:

- Finds Evidence root via `.cmux/evidence.json`.
- Reads `.cmux/evidence.json` and `.cmux/workspace.json`.
- Builds an Evidence source catalog from `sources/*/*.sql`.
- Infers columns, likely time fields, measures, and dimensions from source SQL.
- Reads optional cached profile files:
  - `.cmux/data-context.json`
  - `.cmux/data-profile.json`
- Injects dashboard-agent guidance into the prompt.

Overlap with DuckDB BI:

- `duckdb_data_sources` discovers files, but not Evidence source queries.
- `duckdb_list_tables` exposes file aliases, but not Evidence source names like `tlc.trips` / `tlc.zones` as first-class queryable objects.
- `duckdb_make_report` writes Markdown reports under `.pi/duckdb/reports`, but the Evidence context already has a place to surface cached data profiles under `.cmux`.

### 2. Analysis intention extension

File: `.pi/extensions/analysis-intention/index.ts`

Existing responsibilities:

- Drives interview and saves intent into `.cmux/workspace.json`.
- Re-renders the Evidence analysis page.
- Updates `.cmux/registry.json`.

Overlap with DuckDB BI:

- `data-discovery` produces findings and follow-up questions, but does not feed those findings into the intention/interview state.
- Discovery can reveal dashboard questions, assumptions, and quality limitations that should be available during intention capture.

### 3. Evidence data semantics skill

File: `.pi/skills/evidence-data-semantics/SKILL.md`

Existing responsibilities:

- Guides metric/dimension/source-SQL reasoning.
- Tells the agent to verify source columns and avoid overclaiming.

Overlap with DuckDB BI:

- `data-discovery` is lower-level and data-file oriented.
- `evidence-data-semantics` is dashboard/metric oriented.
- They should be layered rather than competing: DuckDB profiles raw/source-backed data; Evidence semantics turns that into safe dashboard logic.

### 4. CMUX/Evidence workspace policy

File: `.cmux/evidence.json`

Relevant config:

- `allowedAgentPaths`: `pages/**`, `queries/**`
- `askBeforeAgentPaths`: `components/**`, `sources/**`, package files
- `blockedAgentPaths`: `.env*`, `**/connection.yaml`, `.github/**`

Potential mismatch:

- DuckDB tools write `.pi/duckdb/**` directly. This is safe/local and ignored, but it bypasses the mental model that dashboard agents mainly edit pages/queries.
- That is acceptable if `.pi/duckdb/**` is documented as tool-managed scratch/provenance, not dashboard source.

## Main fit problems

### Problem 1: `duckdb_data_sources` scans far too broadly

Current implementation:

- Recursively scans from project root to depth 5.
- Excludes only `.git`, `node_modules`, `dist`, `build`, `.next`, `.cache`, and `coverage`.
- Looks for `.csv`, `.tsv`, `.parquet`, `.json`, `.jsonl`, `.duckdb`, `.db`.

Observed in this repo, the current scan sees many non-business artifacts:

- `.agent/**/inventory.json`
- `.cmux/*.json`
- `.evidence/**/query-cache` and generated Parquet files
- `.pi/**/package.json`, test fixtures, themes
- `.workspaces/**` cloned/generated analysis worktrees
- `.lake_seed/**` seed/raw files
- `.minio-data/**` internal object-store metadata

It does find useful files too:

- `data/tlc/raw/green/*.parquet`
- `data/tlc/raw/yellow/*.parquet`
- `data/tlc/reference/taxi_zone_lookup.csv`
- `sources/tlc/trips.sql`
- `sources/tlc/zones.sql` indirectly through context, but not as DuckDB table sources

Impact:

- Agents may profile generated cache files or internal JSON instead of business data.
- Aliases can collide (`package`, `evidence`, `workspace`, `format`, etc.).
- Auto-discovery for joins may consider unrelated files.

Recommended refactor:

- Add Evidence-aware discovery defaults:
  - Prefer include roots: `data/`, maybe `.lake_seed/` only if explicitly requested.
  - Include Evidence source queries from `sources/*/*.sql` as logical sources.
  - Exclude by default: `.agent/`, `.cmux/`, `.evidence/`, `.pi/`, `.workspaces/`, `.minio-data/`, `.lake_seed/` unless opted in.
- Add parameters to `duckdb_data_sources`:
  - `mode`: `business` | `all` | `runtime`
  - `include_roots?: string[]`
  - `exclude_roots?: string[]`
  - `include_evidence_sources?: boolean`
- Return grouped sections instead of one flat file list:
  - `evidence_sources`
  - `data_files`
  - `databases`
  - `runtime_artifacts`
  - `ignored_summary`

Priority: high.

### Problem 2: Evidence source SQL is not first-class in DuckDB tools

Current Evidence sources:

- `sources/tlc/trips.sql`
- `sources/tlc/zones.sql`

These define the semantic tables the dashboard should use. They normalize raw TLC files into clean fields like:

- `service_type`
- `pickup_ts`
- `pickup_date`
- `pickup_location_id`
- `dropoff_location_id`
- `fare_amount`
- `tip_amount`
- `total_amount`
- `trip_minutes`
- `location_id`
- `borough`
- `zone`
- `service_zone`

Current DuckDB BI table resolution only supports:

- direct file paths
- aliases for discovered raw files
- existing DuckDB database tables/views

It does not understand `tlc.trips` as `(<contents of sources/tlc/trips.sql>)`.

Impact:

- The tools encourage raw-file profiling even though dashboards should reason through Evidence sources.
- Join coverage between `tlc.zones` and `tlc.trips` needs explicit file/raw-table thinking instead of source-level thinking.
- Data quality checks may flag problems already filtered or normalized by source SQL.

Recommended refactor:

- Add `EvidenceSourceCatalog` logic shared with or moved out of `evidence-context.ts`.
- Extend `resolveTableSource` to resolve:
  - `tlc.trips`
  - `trips` when unambiguous
  - `sources/tlc/trips.sql`
- Implement source SQL wrapping:
  - `(<source sql>)` as a subquery table source.
- Preserve the source display name and source path in audit entries/results.
- Add tests for `sources/tlc/trips.sql` and `sources/tlc/zones.sql` resolution.

Priority: high.

### Problem 3: Findings are ephemeral and split across audit/report/runtime files

Current finding-related behavior:

- `duckdb_summarize_table`, `duckdb_quality_report`, and `duckdb_join_coverage` return findings in tool responses.
- SQL provenance goes to `.pi/duckdb/audit/query-log.jsonl`.
- Optional reports go to `.pi/duckdb/reports/*.md`.
- Optional exports go to `.pi/duckdb/exports/*`.
- Evidence context can read `.cmux/data-context.json` / `.cmux/data-profile.json`, but DuckDB BI does not write those.

Impact:

- Discoveries are not automatically visible in later turns unless the agent remembers to query the audit log or report path.
- Findings do not become part of `.cmux/workspace.json` or the registry.
- Dashboard agents may repeat profiling instead of building on prior findings.

Recommended refactor:

Create a BI analysis memory boundary:

- Keep `.pi/duckdb/audit/query-log.jsonl` as low-level provenance.
- Add a canonical summarized profile artifact, probably one of:
  - `.cmux/data-profile.json` for workspace-visible profile summaries, or
  - `.pi/duckdb/findings.json` for tool-owned state, with evidence-context reading a summary.
- Add a new tool or extend existing tools:
  - `duckdb_save_findings`
  - or `duckdb_make_report(..., update_profile: true)`
- Store structured summaries:
  - source/table name
  - row counts
  - key columns
  - date ranges
  - dimensions/measures
  - findings by severity/code
  - query IDs backing each claim
  - artifact/report paths
  - generated timestamp

Preferred direction:

- Write durable, prompt-safe summaries to `.cmux/data-profile.json` because `evidence-context.ts` already reads that path.
- Keep large exports/reports under `.pi/duckdb`.

Priority: high.

### Problem 4: Runtime artifact policy needs a BI-project convention

Current policy:

- `.pi/duckdb/` is ignored.
- Exports/reports/audit are local runtime artifacts.

Open questions:

- Should generated reports ever be committed into `docs/analysis/` or workspace pages?
- Should report Markdown be only scratch/provenance, or should it be convertible into Evidence page sections?
- Should exports ever be referenced from Evidence pages, or are they only analysis scratch?

Recommended convention:

- `.pi/duckdb/**` = local scratch/provenance, never imported directly into dashboards.
- `.cmux/data-profile.json` = small, durable workspace memory that can be used in prompts.
- `pages/analysis/*.md` and `queries/**` = dashboard deliverables.
- If an export/report is important, the agent should summarize or convert it into Evidence-native SQL/Markdown, not link to `.pi/duckdb` as the final asset.

Priority: medium.

### Problem 5: `duckdb_list_tables` currently gives a misleading table model

Current behavior:

- Lists tables/views from an optional DuckDB database.
- Adds discovered project files under pseudo-schema `project.files`.
- `include_counts` currently does not compute counts for file-backed tables.

Issues for this project:

- Evidence users expect source tables like `tlc.trips`, not arbitrary file aliases.
- File aliases are generated from basenames, so monthly Parquet files can collide conceptually.
- `include_counts` looks available but does not provide counts for file tables.

Recommended refactor:

- Add `evidence_sources` to listed schemas.
- For source/file groups, expose:
  - `name`
  - `source_type`: `evidence_sql` | `file` | `duckdb_table`
  - `path`
  - `recommended_for_dashboard`: boolean
  - optional `row_count` when requested
- Either implement file/source counts or remove/clarify `include_counts`.

Priority: medium-high.

### Problem 6: Source discovery and dynamic context duplicate logic

`evidence-context.ts` already has source-catalog helpers:

- `buildSourceCatalog`
- `inferColumns`
- `classifyColumns`
- `inferEvidenceDatasourcePlugins`

DuckDB BI needs similar information to resolve Evidence sources and rank discovered data.

Recommended refactor:

- Extract shared Evidence workspace helpers into a small project-local module, e.g.:
  - `.pi/lib/evidence-workspace.ts`
  - or `.pi/extensions/shared/evidence-workspace.ts`
- Use it from both:
  - `evidence-context.ts`
  - `duckdb-bi/src/lib/evidence-sources.ts`

Caveat:

- Keep the shared module dependency-light and sync with Pi extension loading constraints.

Priority: medium.

### Problem 7: The skill is generic and raw-file biased

Current `data-discovery` skill says it is for unknown CSV/Parquet/JSON/DuckDB files.

For this project, the agent often needs to discover an Evidence semantic source, not just a raw file.

Recommended refactor:

- Rename or supplement with an Evidence-specific skill, e.g. `evidence-data-discovery`.
- Update the workflow:
  1. Read current analysis intention.
  2. Inspect Evidence source catalog.
  3. Prefer profiling source SQL outputs (`tlc.trips`, `tlc.zones`).
  4. Fall back to raw files only when source SQL is missing/incorrect.
  5. Persist a summary to `.cmux/data-profile.json`.
  6. Feed dashboard recommendations into `evidence-data-semantics`.

Priority: medium.

### Problem 8: Write behavior should be surfaced to the user/agent

Current `duckdb_run_sql` may save full result JSON if truncated or `save_full_result` is true. `duckdb_export_query` and `duckdb_make_report` write files.

This is safe but should be more explicit in prompts/tools because the BI agent's normal write scope is Evidence pages/queries.

Recommended refactor:

- Tool descriptions should say runtime outputs are local scratch and ignored.
- `session_start` notification should be quieter or more integrated into LUMEN status.
- Add `artifact_policy` to `duckdb_data_sources` response.

Priority: low-medium.

## Proposed target architecture

### Layers

1. **Evidence workspace awareness**
   - Find root.
   - Read `.cmux/evidence.json`, `.cmux/workspace.json`, `evidence.config.yaml`.
   - Catalog `sources/*/*.sql`.

2. **DuckDB execution/profiling**
   - Safe SQL execution and file/source query wrapping.
   - Quality, summarize, sample, describe, join coverage.

3. **BI memory/provenance**
   - Audit log: `.pi/duckdb/audit/query-log.jsonl`.
   - Runtime artifacts: `.pi/duckdb/exports`, `.pi/duckdb/reports`.
   - Prompt-level profile summary: `.cmux/data-profile.json`.

4. **Dashboard agent guidance**
   - `evidence-context.ts` reads source catalog + data profile.
   - `evidence-data-semantics` uses profile findings to design safe dashboards.
   - `data-discovery` becomes Evidence-source-first.

## Suggested phased plan

### Phase 1 — Discovery scoping and Evidence source support

Status: implemented 2026-06-07.

- Added excluded dirs for `.agent`, `.cmux`, `.evidence`, `.pi`, `.workspaces`, `.minio-data` in default business discovery.
- Added include root default: `data/`, with fallback to project root for small/test projects without `data/`.
- Added Evidence source catalog to `duckdb_data_sources`.
- Extended table resolution for names like `tlc.trips`, `tlc.zones`, unambiguous table names, and `sources/<source>/<table>.sql` paths.
- Added tests for Evidence source resolution and noisy-directory exclusion.

### Phase 2 — Findings memory

- Define `.cmux/data-profile.json` schema.
- Add a save/update path from DuckDB findings into that profile.
- Update `evidence-context.ts` rendering to show compact profile highlights instead of raw JSON when possible.
- Decide whether this is done by a new `duckdb_save_findings` tool or an option on report/profile tools.

### Phase 3 — Skill/prompt integration

- Revise `data-discovery` to be Evidence-source-first in this repo.
- Add cross-reference from `evidence-data-semantics` to use DuckDB tools for verification.
- Clarify that `.pi/duckdb` reports are scratch/provenance and Evidence pages are deliverables.

### Phase 4 — Polish and optional report UX

- Consider a `/data-profile` slash command or status card.
- Consider `duckdb_make_report` optionally writing a summary into `docs/analysis/` only with explicit user intent.
- Add docs for artifact lifecycle and cleanup.

## Recommended next decision

Before implementation, choose the first target behavior:

1. **Evidence-source-first discovery**: make `duckdb_data_sources` and table resolution prefer `sources/*/*.sql` and `data/`, excluding generated internals.
2. **Findings memory**: create `.cmux/data-profile.json` and integrate discoveries into dynamic context.
3. **Skill alignment**: rewrite `data-discovery` so it guides agents through Evidence source profiling instead of raw-file profiling.

Recommended order: 1 → 2 → 3.
