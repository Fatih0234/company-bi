# DuckDB BI Tool Harness Audit

## 1. Executive summary

The DuckDB BI harness is already a useful, local-first analysis layer for Pi. It exposes 11 `duckdb_*` LLM tools plus a `/data-attach` command from `pi-pkg/extensions/duckdb-bi/src/register-tools.ts`, and it is registered in `pi-pkg/package.json` as `./extensions/duckdb-bi`. The strongest part is the safety and workflow spine: bounded readonly execution, workspace/source resolution, `.pi/duckdb/**` scratch artifacts, audit logging, and skills that push the model from discovery to profiling to quality checks before dashboard authoring.

The biggest opportunity is semantic BI guidance. The current tools can describe, sample, summarize, run SQL, test basic quality, check join coverage, and now validate basic Evidence SQL handoff, but they do not yet produce a workspace-level semantic catalog, metric candidates, grain warnings, time-grain detection, metric validation, or query plans. Those gaps leave too much burden on the LLM when the task shifts from "what columns exist?" to "what is the correct, non-misleading analysis?"

Implementation note: the first quick-win tranche has now been implemented. `duckdb_data_sources` has richer summary/semantic orientation fields, `duckdb_list_tables include_counts` now returns file/source row counts, and `duckdb_validate_evidence_sql` is registered for Evidence page SQL handoff checks. The deeper recommendations below still stand.

Confirmed external context: DuckDB supports rich file readers, profiling primitives such as `SUMMARIZE`, and query inspection with `EXPLAIN`; Evidence page SQL queries data sources by source/table names and extracts data sources to Parquet; Pi extensions can register tools, commands, and lifecycle hooks; CMUX supports workspace/browser surfaces. References used: DuckDB docs, Evidence docs, Pi extension docs, and CMUX docs listed in section 13.

## 2. Current tool inventory

| Tool | Source file | Purpose | Parameters | Output shape | Safety behavior | Artifacts written | Tests found | Observed gaps |
|---|---|---|---|---|---|---|---|---|
| `duckdb_run_sql` | `pi-pkg/extensions/duckdb-bi/src/tools/run-sql.ts` | Run one bounded SQL query and return rows. Auto-resolves Evidence source names by injecting CTEs for matching `sources/*/*.sql`. | `sql`, `database`, `readonly`, `max_rows`, `timeout_ms`, `save_full_result`, `result_format` | `{ok, columns, rows, row_count, elapsed_ms, truncated, truncation_reason, result_path, query_id, warnings}` or error | Blocks unsafe SQL via `assertSqlAllowed`; validates file reads; validates database path; timeout and output-byte caps; audited. | Writes full JSON result under `.pi/duckdb/exports/` when requested or truncated. | Smoke test docs; query validation coupling in quality guard tests; Evidence source integration test exercises source resolution. | No `EXPLAIN`; no cost estimate; no semantic warnings; source-reference regex is simple; output columns lack DuckDB types when result has zero rows. |
| `duckdb_list_tables` | `src/tools/list-tables.ts` | List database tables/views and file-backed aliases. | `database`, `include_views`, `include_system`, `include_counts` | `{ok, schemas, elapsed_ms, query_id, query_ids}` | Database path validation through DuckDB runner; audit logs database introspection and optional count queries. | None. | Smoke test docs; `tests/evidence-sources.test.mjs`. | `include_counts` now works, but count queries can be expensive on large file-backed sources; registered registry tables are not surfaced as a distinct preferred group here. |
| `duckdb_describe_table` | `src/tools/describe-table.ts` | Describe columns, types, nullability/defaults, and optional sample values. | `table`, `schema`, `database`, `include_sample_values`, `sample_limit` | `{ok, table, columns[], elapsed_ms, query_id}` | Resolves table/file/Evidence source safely; per-column sample queries are readonly; audited. | None. | Smoke test docs; source resolution tests indirectly. | One query per column for sample values can be expensive; no table-level row count; sample values lack counts or null context. |
| `duckdb_sample_rows` | `src/tools/sample-rows.ts` | Return bounded first/random rows, optionally filtered. | `table`, `schema`, `database`, `limit`, `method`, `where` | `{ok, table, columns, rows, row_count, sampling_method, elapsed_ms, query_id}` | `where` rejects semicolons/comments and blocked ops; max 200 rows; readonly; audited. | None. | Smoke test docs. | Random sampling is `ORDER BY random()`, expensive for large files; no stratified sample or deterministic seed; no warning for first-row bias. |
| `duckdb_summarize_table` | `src/tools/summarize-table.ts` | Profile columns: row count, nulls, distinct counts, numeric stats, date/text stats, top values, interpretation findings. | `table`, `schema`, `database`, `max_top_values`, `include_text_stats`, `include_date_stats` | `{ok, table, row_count, column_count, columns[], findings[], elapsed_ms, query_ids[]}` | Resolves table safely; all queries readonly; each subquery audited. | None. | `tests/findings.test.ts`; smoke test docs. | Executes multiple full-table scans per column; no sampling mode; no histograms/quantiles beyond median/stddev; no time-grain, metric, or measure/dimension catalog. |
| `duckdb_quality_report` | `src/tools/quality-report.ts` | Detect null-heavy columns, duplicate rows/keys, blanks, high cardinality, date ranges, and negative business values. | `table`, `schema`, `database`, `key_columns`, `date_columns`, `max_top_values` | `{ok, table, row_count, issues[], recommendations[], elapsed_ms, query_ids[]}` | Uses `summarizeTable`; readonly targeted checks; audited. | None. | Smoke test docs. | Only checks named keys; limited metric validation; no grain/aggregation warnings, sample-size warnings, duplicate entity checks, or referential checks. |
| `duckdb_export_query` | `src/tools/export-query.ts` | Run a readonly query and save complete rows as CSV/JSON/JSONL/Markdown. | `sql`, `format`, `output_name`, `database`, `readonly`, `timeout_ms`, `overwrite` | `{ok, path, format, rows, bytes, elapsed_ms, query_id}` or error | Blocks unsafe SQL; validates paths; output names sanitized; output capped at 50 MB; audited. | `.pi/duckdb/exports/<name>.<ext>` | Smoke test docs. | No manifest/provenance sidecar; no sensitivity labeling; no row-limit preview before large export; cannot export DuckDB-native parquet. |
| `duckdb_data_sources` | `src/tools/data-sources.ts` | Orient the agent to registered tables, Evidence sources, data files, databases, runtime dirs, exports, reports, and audit log. | `include_files`, `include_runtime_dirs`, `include_evidence_sources`, `mode` | `{ok, cwd, discovery_mode, artifact_policy, runtime_dir, registered_tables[], evidence_sources[], databases[], files[], exports[], reports[], audit_log_path, runtime_dirs}` | Business mode restricts discovery to `data/` plus Evidence sources; internal dirs excluded by path library; reads registry with size cap. | Creates runtime dirs through `ensureRuntimeDirs`; no data artifacts. | Evidence source discovery tests; smoke docs. | Best orientation tool but still shallow: no semantic roles, no freshness comparison beyond registry fields, no suggested next action per table, and registry `columns`/`rowCount` are often empty. |
| `duckdb_make_report` | `src/tools/make-report.ts` | Write a Markdown BI report from narratives, query IDs, and artifact paths. | `title`, `summary`, `sections[]`, `output_name` | `{ok, report_path, artifact_paths, sections_written}` | Report path constrained to `.pi/duckdb/reports/`; filename sanitized. | `.pi/duckdb/reports/<name>.md` | Smoke test docs. | Not linked to audit log beyond user-supplied query IDs; no structured finding cards; not Evidence-native; no replay manifest. |
| `duckdb_query_audit_log` | `src/tools/query-audit-log.ts` | Read recent query audit entries. | `limit`, `status`, `tool_name`, `since` | `{ok, audit_log_path, entries[]}` | Reads only `.pi/duckdb/audit/query-log.jsonl`; limit capped at 500. | None. | Smoke test docs. | No session grouping, replay plan, query dependency graph, or redaction policy beyond SQL trimming. |
| `duckdb_join_coverage` | `src/tools/join-coverage.ts` | Check dimension/fact join coverage, orphans, unused dimension rows, and key type compatibility. | `dimension_table`, `key_column`, `database`, `candidates[]`, `auto_discover`, `timeout_ms` | `{ok, dimension, candidates_considered[], joins[], findings[], query_ids[], elapsed_ms}` | Safe table resolution; readonly queries; audited; timeout parameter. | None. | `tests/join-coverage.test.mjs`; smoke docs. | Candidate discovery only scans files from `discoverDataFiles`, not registered `files.*` or Evidence source relationships; no composite keys; no duplicate-key inflation warning; no orphan sample export. |
| `duckdb_validate_evidence_sql` | `src/tools/validate-evidence-sql.ts` | Validate SQL before moving it into Evidence pages. Checks readonly safety, raw file reads, source resolution, non-empty results, expected columns, and component handoff warnings. | `sql`, `query_name`, `component_type`, `expected_columns`, `database`, `max_rows_preview`, `timeout_ms`, `save_full_result`, `evidence_mode` | `{ok, evidence_ready, summary, query_id, row_count, columns, rows, issues[], warnings[], next_actions[]}` | Blocks unsafe SQL; forbids raw `read_*` in Evidence mode; runs readonly bounded preview; audits validation. | Optional full JSON result under `.pi/duckdb/exports/` when saved/truncated. | `tests/evidence-sources.test.mjs`. | Initial validator only; it does not yet validate metric grain, join loss, or full chart semantics. |
| `/data-attach` command | `src/tools/data-attach.ts` | macOS file picker to copy data files into workspace and run data refresh. | Slash command args: optional destination | User notification/message, copy results, refresh output | macOS-only picker; supported extensions; refuses non-regular files/symlinks; avoids overwrite; destination is resolved from workspace cwd but not constrained in code to `data/`. | Copies selected files; runs `cmux-evidence data refresh`. | No automated tests found. | Not LLM-callable; destination can be custom; no explicit path-root guard; platform-specific. |

## 3. Current data-analysis workflow

1. User creates or opens a content-only analysis workspace. `README.md` describes `pages/index.md`, `pages/draft.md`, `pages/report.md`, `queries/`, `data/`, `reports/`, and `.cmux/` as the content surface.
2. User drops supported data files into `data/`.
3. `cmux-evidence data refresh` calls `scripts/workspace_data_registry.py`, which scans `data/` to depth 5, creates stable aliases, writes `.cmux/data-registry.json`, and generates `sources/files/<alias>.sql` with `read_csv_auto`, `read_parquet`, or `read_json_auto`.
4. Evidence source extraction can materialize `files.<alias>` for dashboard SQL. The intended page SQL contract is `FROM files.orders`, not raw `read_csv_auto('data/orders.csv')`.
5. Pi receives dynamic context from `evidence-context.ts`, which reads safe metadata and source summaries while intentionally avoiding `.env*` and `connection.yaml`.
6. The agent uses `duckdb_data_sources` to orient, preferring registered `files.<alias>` tables when present.
7. The `data-discovery` skill directs the agent through describe, sample, summarize, quality report, optional join coverage, narrative, and optional exports/reports.
8. Free-form analysis happens with `duckdb_run_sql`; the audit log records query IDs and artifacts.
9. When building dashboards, `evidence-dashboard` requires analysis in draft first, an Insight Candidate Scan, Report Design Plan, query validation through DuckDB, then moving validated findings into `pages/report.md`.
10. `evidence-quality-guard` enforces parts of this workflow by blocking page writes if planning, data profiling, documentation lookup, query validation, empty result checks, or static rendering checks are missing.
11. The agent validates with Evidence build/preview and CMUX browser inspection before publishing.

## 4. Strengths

- Tooling is project-local and registered through `pi-pkg/package.json`, so generated workspaces inherit it through `bin/lumen-pi`.
- The safety baseline is strong: blocked write/destructive SQL keywords, blocked dot commands, single-statement readonly mode, path validation, output limits, timeouts, spawn argument arrays, `-init /dev/null`, and workspace-local artifacts.
- The tools understand Evidence source SQL and content-only roots instead of treating the repo as a single flat checkout.
- `duckdb_data_sources` distinguishes registered dashboard-safe tables from unregistered files and exposes an artifact policy.
- `duckdb_summarize_table` already produces interpretation-oriented findings rather than raw stats only.
- `duckdb_join_coverage` is a high-value BI guardrail that many generic data agents lack.
- The `data-discovery`, `evidence-dashboard`, and `evidence-bi-thinking` skills encode a disciplined workflow: profile before SQL, synthesize before dashboard, charts as analytical moves rather than chart dumps.
- The quality guard closes several common Evidence failure modes: unvalidated SQL, empty result sets, missing planning, guessed component docs, generic titles, and Svelte/HTML syntax hazards.

## 5. Gaps and risks

- Missing workspace-level profiling. The registry defines `DATA_PROFILE_FILENAME` and table fields for `columns`, `rowCount`, and `warnings`, but `refresh_workspace_data_registry(..., profile=False)` preserves old metadata and does not populate new profiles. Evidence: `scripts/workspace_data_registry.py` defines profile paths and fields, while refresh only copies existing `columns`/`rowCount`.
- `duckdb_data_sources` now has a useful orientation summary, profile status, semantic hints, and next actions, but it is still not a full semantic catalog. It does not yet persist table grain, validated measures, or join candidates.
- `duckdb_list_tables.include_counts` now returns row counts, but it can be expensive on large file-backed sources and should expose cost warnings if used broadly.
- Profiling can be expensive. `duckdb_summarize_table` runs describe, count, one profile query, and one top-values query per column, causing many full scans for wide/large files.
- Random sampling can be expensive and biased operationally. `duckdb_sample_rows` uses `ORDER BY random()`, which is simple but costly on large scans, and first-row sampling has no warning.
- Query debugging is weak. `duckdb_run_sql` returns DuckDB errors, but there is no `EXPLAIN`, no plan output, no source rewrite preview, and no suggested fix classifications.
- Metric validation is mostly manual. `duckdb_quality_report` catches duplicate keys, nulls, negative metric-like names, and date parse/future issues, but does not validate numerator/denominator definitions, grain, double-counting after joins, period coverage, or subtotal reconciliation.
- Join support is valuable but narrow. Auto-discovery scans sibling data files by FK name pattern; it does not catalog relationships across registered `files.*` sources, Evidence source SQL, composite keys, bridge tables, duplicate dimension keys, or join row multiplication.
- Evidence handoff is safer after `duckdb_validate_evidence_sql`, which catches raw file reads, empty results, missing expected columns, and simple component warnings. Remaining risks are metric grain mismatch, join loss, row multiplication, and weak metric assumptions.
- Artifact provenance is fragmented. Query IDs are logged, exports are files, and reports cite user-supplied query IDs, but there is no analysis session manifest that ties source registry fingerprint, queries, findings, exports, and final Evidence blocks together.
- The privacy model is mostly good but not fully explicit. Artifacts are local under `.pi/duckdb/**`, but exports can contain arbitrary row-level data, and report-writing has no sensitivity warning, retention policy, cleanup command, or publish guard.
- Validation coverage is uneven. `findings`, Evidence source resolution, and join coverage have tests; run-sql safety, path traversal, export/report path guards, truncation, registry loading, workspace-mode edge cases, and tool output snapshots need broader tests.
- Some documentation is stale or confusing. The extension README still references `.pi/extensions/duckdb-bi/` paths while this repo loads from `pi-pkg/extensions/duckdb-bi/`; `skill-discovery.test.mjs` also references `.pi/skills/data-discovery/SKILL.md`, which can be misleading in the source package layout.

## 6. Recommended target tool architecture

Use small composable tools with LLM-friendly output. Avoid one giant "analyze everything" tool.

Discovery tools:
- Keep `duckdb_data_sources`, but upgrade it into a source catalog with `registered_first`, stale/missing flags, table role hints, available profile status, source SQL handoff notes, and "next recommended tool call".
- Add a registry/profile refresh hook outside the DuckDB extension or a read-only profile status tool that tells the agent what is stale.

Schema/profile tools:
- Keep `describe`, `sample`, `summarize`, and `quality_report`.
- Add `duckdb_profile_workspace` for a bounded, cached scan across registered tables.
- Add `duckdb_classify_table_semantics` for dimensions, measures, IDs, time fields, entity fields, grains, and confidence.

Exploratory SQL tools:
- Keep `run_sql` and `export_query`.
- Add `duckdb_explain_query` for `EXPLAIN`, source resolution preview, and likely performance risks.
- Consider a `sample_method` option that uses DuckDB sampling or deterministic `USING SAMPLE` where appropriate.

Semantic/metric tools:
- Add a metric candidate/validation pair: one proposes metrics from column names/types/profiles, the other validates a concrete metric query for grain, nulls, duplicates, denominators, row counts, and reconciliation.

Join/grain tools:
- Expand `duckdb_join_coverage` or add a separate `duckdb_discover_relationships` to catalog candidate joins across registered tables.
- Add a uniqueness/duplicate checker that validates primary, foreign, and composite keys and reports expected row multiplication.
- Add a time grain detector for date/timestamp columns.

Evidence handoff tools:
- Add `duckdb_validate_evidence_sql` to check proposed page SQL against registered source names, no raw file readers, non-empty results, metric grain warnings, column names expected by Evidence components, and optional chart compatibility.
- Keep Evidence syntax/static/rendering checks in `evidence-quality-guard`; use DuckDB tools for data/SQL semantics.

Provenance/audit tools:
- Keep `query_audit_log`.
- Add session-level summary/replay tooling that groups queries and artifacts by analysis session, registry fingerprint, and final Evidence page block.
- Replace or supplement `make_report` with structured finding-card artifacts that can later be summarized into reports.

What belongs where:
- Pi tools: deterministic data inspection, profiling, validation, exports, query explain, join/grain checks, and structured artifact writes.
- Skills: judgment sequencing, when to ask the user, narrative quality, report archetypes, dashboard design tradeoffs.
- Prompt templates: repeatable high-level workflows such as "build an Evidence dashboard from approved findings".
- Dynamic context: compact current registry, workspace mode, source catalog status, and artifact policy.
- Evidence quality guard: enforcement at page-write/readiness time, especially raw file path bans, query validation, empty datasets, static rendering hazards, and whether required profiles/semantic checks were run.

## 7. Proposed new or changed tools

### `duckdb_data_sources` update

- Create/update/remove: update.
- Target file path: `pi-pkg/extensions/duckdb-bi/src/tools/data-sources.ts`.
- Purpose: orient the agent with a semantic, action-oriented catalog.
- Parameters: existing flags plus `include_semantics?: boolean`, `include_profile_status?: boolean`.
- Output JSON shape: `{summary, registered_tables:[{name, alias, status, path, format, sizeBytes, rowCount, columns, semantic_roles, likely_role, profile_status, evidence_ready, warnings, next_actions}], unregistered_files, evidence_sources, artifacts, audit_log_path}`.
- Safety constraints: read registry/source metadata only; do not read `connection.yaml` or data rows.
- Artifact behavior: none.
- Expected tests: registry with ready/stale/missing tables; unregistered file hint; content-only shadow source; output snapshot.
- Why it improves BI analysis: gives the model a preferred table list and the next best step without requiring manual synthesis from raw metadata.

### `duckdb_profile_workspace`

- Create/update/remove: create.
- Target file path: `src/tools/profile-workspace.ts`.
- Purpose: bounded workspace-level profile across registered `files.*` tables.
- Parameters: `tables?: string[]`, `mode?: "fast"|"standard"`, `max_columns_per_table?: number`, `sample_rows?: number`, `timeout_ms?: number`, `refresh_cache?: boolean`.
- Output JSON shape: `{ok, tables:[{name,row_count,column_count,columns:[{name,type,null_pct,distinct_count,role_hint,warnings}], findings}], workspace_findings, profile_path?, query_ids, elapsed_ms, warnings}`.
- Safety constraints: readonly; registered tables preferred; per-table timeout; cap wide-table profiling; warn when sampled.
- Artifact behavior: optional `.cmux/data-profile.json` or `.pi/duckdb/profiles/<session>.json`.
- Expected tests: two-table fixture profile; stale cache; wide table cap; timeout/output warning.
- Why: converts a multi-tool discovery loop into a reliable first-pass map.

### `duckdb_classify_table_semantics`

- Create/update/remove: create.
- Target file path: `src/tools/classify-table-semantics.ts`.
- Purpose: classify dimensions, measures, IDs, dates, entities, candidate grains, and table role.
- Parameters: `table`, `schema?`, `database?`, `profile_query_ids?`, `sample_limit?`.
- Output JSON shape: `{ok, table, likely_table_role:{value,confidence,evidence}, grain_candidates[], ids[], time_fields[], measures[], dimensions[], entity_fields[], warnings[], suggested_next_actions[]}`.
- Safety constraints: readonly; can reuse prior summarize output when supplied; bounded samples only.
- Artifact behavior: none by default; optional profile cache in future.
- Expected tests: fact fixture, dimension fixture, ambiguous table, all-string CSV.
- Why: removes a major source of weak BI behavior: treating every text field as a dimension and every numeric field as a metric.

### `duckdb_generate_metric_candidates`

- Create/update/remove: create.
- Target file path: `src/tools/metric-candidates.ts`.
- Purpose: propose candidate metrics and validation questions.
- Parameters: `table`, `business_question?`, `max_candidates?`, `include_sql?: boolean`.
- Output JSON shape: `{ok, table, candidates:[{metric_name, expression, aggregation, grain, required_filters, caveats, confidence, validation_queries[]}], rejected_columns[]}`.
- Safety constraints: no execution unless validation queries are explicitly run by another tool.
- Artifact behavior: none.
- Expected tests: revenue/quantity fixture, ratio candidate, ID numeric column rejected.
- Why: guides the model away from unvalidated KPIs and accidental counts/sums.

### `duckdb_validate_metric`

- Create/update/remove: create.
- Target file path: `src/tools/validate-metric.ts`.
- Purpose: validate a concrete metric SQL or metric definition before it becomes a KPI/chart.
- Parameters: `metric_name`, `sql` or `{table, expression, aggregation, grain}`, `expected_grain?`, `date_column?`, `dimension_columns?`, `reconcile_to_total?: boolean`.
- Output JSON shape: `{ok, metric, row_count, result_preview, validation:{non_empty, null_risk, duplicate_grain_risk, date_coverage, denominator_risk, reconciliation}, warnings[], query_ids[], suggested_fix_sql?}`.
- Safety constraints: readonly SQL only; row/time/output caps; no raw file paths when `evidence_mode=true`.
- Artifact behavior: optional validation card under `.pi/duckdb/findings/`.
- Expected tests: duplicate key overcount, null denominator, empty metric, raw file path in evidence mode.
- Why: closes the gap between "query runs" and "metric is defensible".

### `duckdb_detect_time_grain`

- Create/update/remove: create.
- Target file path: `src/tools/time-grain.ts`.
- Purpose: identify date range, natural grain, missing periods, partial periods, seasonality candidates, and timezone/date parse risks.
- Parameters: `table`, `date_column`, `database?`, `grains?: ["day","week","month","quarter","year"]`, `timeout_ms?`.
- Output JSON shape: `{ok, table, date_column, min, max, row_count, detected_grain, completeness_by_grain[], partial_period_warnings[], suggested_grouping_sql}`.
- Safety constraints: readonly; cap high-cardinality result output.
- Artifact behavior: none.
- Expected tests: daily complete, monthly gaps, invalid/future dates.
- Why: prevents misleading trend charts and accidental partial-period comparisons.

### `duckdb_discover_relationships`

- Create/update/remove: create.
- Target file path: `src/tools/discover-relationships.ts`.
- Purpose: discover join candidates across registered tables using names, types, uniqueness, and coverage samples.
- Parameters: `tables?: string[]`, `max_candidates_per_table?: number`, `min_name_score?`, `run_coverage?: boolean`.
- Output JSON shape: `{ok, relationships:[{left_table,left_key,right_table,right_key,relationship_type,coverage_pct?,uniqueness,left_role,right_role,confidence,warnings}], skipped[], query_ids[]}`.
- Safety constraints: registered/business tables first; bounded coverage; timeout per candidate.
- Artifact behavior: optional relationship catalog cache.
- Expected tests: customers/orders fixture; type mismatch; duplicate dimension key; composite-key unsupported warning.
- Why: supports serious BI joins without forcing the LLM to guess all relationships.

### `duckdb_check_uniqueness`

- Create/update/remove: create.
- Target file path: `src/tools/check-uniqueness.ts`.
- Purpose: validate uniqueness for primary, foreign, and composite keys and show duplicate examples.
- Parameters: `table`, `columns`, `database?`, `sample_duplicates?: number`.
- Output JSON shape: `{ok, table, columns, row_count, distinct_key_count, duplicate_group_count, duplicate_row_count, is_unique, duplicate_examples[], query_ids[]}`.
- Safety constraints: readonly; example limit cap.
- Artifact behavior: optional export of duplicate examples.
- Expected tests: duplicate sales order ID fixture; composite key; no duplicates.
- Why: prevents double-counting and join multiplication.

### `duckdb_explain_query`

- Create/update/remove: create.
- Target file path: `src/tools/explain-query.ts`.
- Purpose: explain/debug a query before expensive execution or after errors.
- Parameters: `sql`, `database?`, `mode?: "explain"|"explain_analyze"`, `evidence_mode?: boolean`, `timeout_ms?`.
- Output JSON shape: `{ok, resolved_sql_preview, plan_text, referenced_sources[], estimated_risks[], warnings[], query_id?}`.
- Safety constraints: block unsafe SQL; `EXPLAIN_ANALYZE` opt-in; no writes; file path validation.
- Artifact behavior: optional plan text under `.pi/duckdb/audit/`.
- Expected tests: blocked unsafe SQL, raw file path in evidence mode, plan for simple query, timeout.
- Why: improves query debugging and helps control cost.

### `duckdb_validate_evidence_sql`

- Create/update/remove: create.
- Target file path: `src/tools/validate-evidence-sql.ts`.
- Purpose: validate SQL intended for Evidence pages before writing Markdown.
- Parameters: `sql`, `query_name?`, `component_type?`, `expected_columns?`, `evidence_mode?: true`, `max_rows_preview?`.
- Output JSON shape: `{ok, evidence_ready, row_count, columns, issues:[{severity,code,message,line?,fix_hint}], warnings[], suggested_sql?, query_id}`.
- Safety constraints: readonly; forbid raw `read_*` in Evidence mode; require registered source names; run bounded preview.
- Artifact behavior: records validation in quality guard cache if integration allows.
- Expected tests: raw file path blocked, `files.alias` accepted, empty result, missing component columns, unsafe SQL.
- Why: bridges DuckDB exploration and Evidence authoring.

### `duckdb_write_finding_card`

- Create/update/remove: create or replace `duckdb_make_report` for structured findings.
- Target file path: `src/tools/finding-card.ts`.
- Purpose: persist a single verified insight with evidence, caveats, source tables, and query IDs.
- Parameters: `title`, `claim`, `evidence_query_ids`, `source_tables`, `metrics`, `caveats`, `artifact_paths?`, `confidence`.
- Output JSON shape: `{ok, finding_id, path, markdown_path?, json_path?, warnings}`.
- Safety constraints: local `.pi/duckdb/findings/` only; no data row dump unless artifact explicitly referenced.
- Artifact behavior: writes JSON and optional Markdown finding cards.
- Expected tests: path safety, required query IDs, duplicate title naming, markdown escaping.
- Why: makes analysis auditability granular and reusable.

### `duckdb_analysis_session_summary`

- Create/update/remove: create.
- Target file path: `src/tools/analysis-session-summary.ts`.
- Purpose: summarize/replay analysis activity from audit logs, finding cards, exports, and registry fingerprints.
- Parameters: `since?`, `limit?`, `include_sql?: boolean`, `format?: "json"|"markdown"`.
- Output JSON shape: `{ok, session_id?, sources_used[], queries[], findings[], exports[], unresolved_warnings[], replay_steps[], report_path?}`.
- Safety constraints: redact/truncate SQL and artifact previews; local only.
- Artifact behavior: optional summary under `.pi/duckdb/reports/`.
- Expected tests: audit log grouping, redaction/truncation, missing artifact handling.
- Why: improves reproducibility and handoff to final Evidence reports.

## 8. Tool-result design guidelines

- Put a compact `summary` or `headline` field first for every analysis-heavy tool.
- Use stable structured JSON under `details`; keep rendered text readable but not the only contract.
- Include `warnings[]` with `{severity, code, message, evidence?, suggested_action?}` rather than prose-only caveats.
- Include `next_actions[]` that point to specific tool names and parameters when appropriate.
- Include `confidence` labels for inferred semantics: `high`, `medium`, `low`.
- Distinguish confirmed facts from inferences in output fields.
- Always return `query_ids[]` for any tool that ran SQL.
- Return `source_tables[]` and `source_registry_fingerprints[]` where possible.
- Make row/sample limits explicit: `sampled`, `sample_method`, `max_rows`, `truncated`, `total_row_count_known`.
- For large data, include `cost_notes[]`: full scan, sampled, approximate, timeout risk.
- Include artifact paths in a top-level `artifacts[]` array with type, local path, row count, and sensitivity note.
- Preserve Evidence compatibility hints: `evidence_ready`, `uses_registered_sources`, `raw_file_reference_detected`.
- Prefer arrays of named objects over maps when order and ranking matter.

## 9. Safety, privacy, and cost controls

Current controls:
- Readonly SQL by default with blocked destructive keywords and DuckDB dot commands.
- Single-statement readonly mode.
- File reads are constrained to approved workspace/runtime roots.
- DuckDB database path is constrained to the project root unless `:memory:`.
- Exports and reports are constrained to `.pi/duckdb/exports/` and `.pi/duckdb/reports/`.
- Audit logs are workspace-local under `.pi/duckdb/audit/query-log.jsonl`.
- Direct query output is row-limited and byte-limited; full results are saved only when requested or truncation occurs.
- DuckDB runs via `spawn()` argument arrays with `shell: false`, `-batch`, `-no-stdin`, and `-init /dev/null`.
- Content-only config separates workspace root, runtime root, and shadow runtime root.
- Evidence context avoids `.env*` and `connection.yaml`.

Needed controls:
- Make `.pi/duckdb/**` publish exclusion explicit in publish validation.
- Add sensitivity warnings to exports and reports because they can contain row-level data.
- Add cleanup/list/delete commands or documented retention policy for scratch artifacts.
- Add query-plan warnings and sampling options for wide/large files.
- Add explicit raw-file path validation for Evidence-intended SQL.
- Add sample-size, missingness, high-cardinality, join-loss, row-multiplication, partial-period, and aggregation-grain warnings in semantic tools.
- Avoid passing full `process.env` to DuckDB if not needed; at minimum document why it is acceptable.
- Add tests proving `.env*`, `connection.yaml`, and arbitrary absolute paths are not read or exposed by discovery/context tools.

## 10. Testing and validation plan

Current validation commands:
- `cd pi-pkg/extensions/duckdb-bi && npm test`
- `node --experimental-strip-types --test tests/findings.test.ts`
- `node --test tests/join-coverage.test.mjs`
- `node --test tests/evidence-sources.test.mjs`
- `node --test tests/skill-discovery.test.mjs`
- `cd pi-pkg/extensions/evidence-quality-guard && node --experimental-strip-types --test tests/static-analysis.test.ts tests/query-validator.test.ts tests/empty-dataset-detector.test.ts`

Tests to add or expand:
- SQL safety: blocked destructive keywords, comments, dot commands, multi-statements, `COPY`, `INSTALL`, `LOAD`, `ATTACH`, unsafe `where`.
- Path safety: absolute path outside roots, `..`, hidden output names, symlink data files, raw file reads outside approved roots, report/export collisions.
- Source resolution: registered `files.*`, Evidence sources, content-only shadow source SQL rewriting, ambiguous source names, raw file fallback behavior.
- Tool output snapshots: `data_sources`, `summarize_table`, `quality_report`, `join_coverage`, future semantic catalog output.
- Truncation/output caps: row truncation writes result path, byte cap errors, export size cap.
- Workspace-mode tests: content-only workspace with workspace data plus shadow sources plus runtime sources; ensure artifacts write under content workspace.
- Registry tests: alias collision, missing file status, unsupported extensions ignored, profile metadata population once implemented.
- Large-file fixture tests: wide CSV, high-cardinality text, partial dates, null-heavy metrics, sampled profiling.
- Join/grain tests: duplicate dimension keys, duplicate fact grain, composite key warning, orphan sample output, many-to-many join risk.
- Evidence SQL handoff tests: raw `read_csv_auto` rejected, `files.alias` accepted, empty chart query rejected, missing component columns warned.
- Privacy tests: `.env*`, `connection.yaml`, and private local paths are not inspected or emitted.

## 11. Prioritized roadmap

Quick wins:
- Completed: implement `duckdb_list_tables.include_counts` for file-backed and Evidence-source rows.
- Completed: upgrade `duckdb_data_sources` output with `summary`, `next_actions`, registry warnings, semantic hints, and profile status.
- Completed: add `duckdb_validate_evidence_sql` for Evidence handoff validation and raw-file-path checks.
- Add output snapshot tests for the current tools.
- Update stale docs/tests that mention `.pi/` source-package paths when the source of truth is `pi-pkg/`.

Medium improvements:
- Implement `duckdb_profile_workspace` and cache `.cmux/data-profile.json`.
- Implement semantic classifier, uniqueness checker, time grain detector, and query explain/debug helper.
- Integrate semantic check completion into `evidence-quality-guard` before report page writes.
- Add artifact manifests for exports/reports with query IDs, source fingerprints, and sensitivity notes.

Deep architecture changes:
- Build a persistent semantic catalog for registered workspace data.
- Add relationship discovery and metric validation as first-class concepts.
- Add analysis session replay/summary and structured finding cards.
- Connect Evidence preview/build validation with DuckDB validation so empty charts, raw file paths, and metric-grain risks are surfaced together before publishing.

## 12. Acceptance criteria

Better DuckDB BI tooling means:
- A new workspace with files in `data/` yields a clear registered source catalog with table roles, likely grain, IDs, measures, dimensions, time fields, and join candidates.
- An agent can answer "what should I analyze next?" from tool output without inventing metadata.
- Every final KPI/chart query has a validation record: non-empty, registered-source based, grain-aware, and checked for relevant nulls, duplicates, date coverage, and join loss.
- Joins are not trusted until key uniqueness, coverage, and row multiplication risk are checked.
- Large-file operations announce whether they are full scans, sampled, truncated, or approximate.
- Exports and reports are local, traceable, and clearly marked as scratch/provenance rather than publishable dashboard deliverables.
- Evidence page SQL uses registered source names and no raw workspace file readers.
- Regression tests cover safety, source resolution, content-only behavior, truncation, and semantic output shapes.

## 13. Open questions

- Should workspace profiles be stored in `.cmux/data-profile.json`, `.pi/duckdb/profiles/`, or both?
- Should profiling run automatically during `cmux-evidence data refresh`, or only on first Pi analysis to avoid expensive refreshes?
- How much data can be safely profiled by default before asking the user about cost/time?
- Should exports containing row-level data require an explicit sensitivity warning or user confirmation?
- Should `/data-attach` allow destinations outside `data/`, or should it be constrained to workspace data roots?
- Should semantic catalog fields become part of the registry contract consumed by Evidence context?
- How should the quality guard know that a metric validation or grain validation is sufficient for a given page query?
- Should DuckDB extension loading remove ambient environment variables, or is inheriting `process.env` required for local usage?

References:
- DuckDB docs: `read_csv/read_parquet/read_json`, multiple file reading, `SUMMARIZE`, and `EXPLAIN` are documented at <https://duckdb.org/docs/>.
- Evidence docs: DuckDB data sources and page SQL query behavior are documented at <https://docs.evidence.dev/core-concepts/data-sources/duckdb> and <https://docs.evidence.dev/core-concepts/queries>.
- Pi extension docs: tool/command/lifecycle extension model is documented at <https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md>.
- CMUX docs/source: workspace/browser surface model is documented at <https://cmux.com/docs/concepts> and <https://github.com/manaflow-ai/cmux>.
