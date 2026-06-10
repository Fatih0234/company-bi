# Workspace Data Registry Refactor — Context Engineered Overview

## 🎯 What This Project Is

**company-bi** (aka LUMEN) is a local-first Evidence BI development environment. An AI agent (Pi) builds Evidence dashboards inside a three-pane CMUX workspace. The three core tools are:

- **Evidence**: Renders dashboards from Markdown + SQL.
- **Pi**: Coding agent that edits pages, writes queries, inspects browser preview.
- **CMUX**: Three-pane workspace (agent terminal, browser preview, dev server).

## 🏗️ Current Architecture

### Workspace Model (Content-Only)
A user-facing analysis workspace is intentionally clean:
```
workspace/
  pages/          # Markdown + SQL pages
  queries/        # Reusable analysis SQL
  reports/        # Report artifacts
  data/           # User-attached data files
  .cmux/          # Workspace metadata
  .pi/            # Symlinked Pi resources
```

Root runtime files (package.json, bin/, scripts/, sources/, node_modules/) are NOT exposed to the workspace.

### Shadow Runtime Model
`ensure_shadow_runtime` creates a generated Evidence runtime for content-only workspaces:
- Symlinks: evidence.config.yaml, package.json, package-lock.json, sources, scripts, bin, pi-pkg, data
- Links workspace pages/queries/reports from content workspace
- Links workspace data as `workspace-data`
- Generates shadow `.cmux/evidence.json`

### Current Data Model (TLC-Specific)
The current data source is TLC taxi data:
```
sources/tlc/connection.yaml
sources/tlc/trips.sql    # reads data/tlc/raw/yellow/*.parquet
sources/tlc/zones.sql    # reads data/tlc/reference/taxi_zone_lookup.csv
```
This is what needs to be demoted to an optional example.

### Pi Package Structure
```json
{
  "pi": {
    "extensions": ["evidence-context.ts", "pi-ask-user", "analysis-intention", "duckdb-bi", "lumen-bi", "evidence-health-check.ts", "evidence-quality-guard"],
    "skills": ["evidence", "evidence-dashboard", "evidence-dashboard-review", "evidence-bi-thinking", "evidence-slides", "data-discovery", "cmux-workspace", "cmux-browser", "cmux-pi", "cmux-diagnostics", "ask-user"],
    "prompts": ["evidence-dashboard.md", "slides-from-report.md", "slides-storyboard.md", "slides-review.md"],
    "themes": ["lumen-bi-midnight.json"]
  }
}
```
**Rule**: Every new extension, skill, prompt, or theme must be registered here.

### DuckDB-BI Extension
Already provides safe BI-oriented DuckDB tools:
- `duckdb_run_sql`, `duckdb_list_tables`, `duckdb_describe_table`, `duckdb_sample_rows`, `duckdb_summarize_table`, `duckdb_quality_report`, `duckdb_data_sources`, `duckdb_join_coverage`, `duckdb_export_query`, `duckdb_make_report`, `duckdb_query_audit_log`
- Already discovers data files (.csv, .tsv, .parquet, .json, .jsonl, .duckdb, .db) in `data/`
- Has path validation, safety controls, audit logging
- **Gap**: Discovered files are NOT promoted into stable Evidence source tables

### Evidence-Context Extension
- Scans `sources/*/*.sql` to build a source catalog
- Works for TLC (`tlc.trips`, `tlc.zones`)
- **Gap**: Does NOT understand `.cmux/data-registry.json` or registered workspace file tables

---

## 🎯 What the Refactor Achieves

### Core Concept
Workspace-local files (CSV, Parquet, JSON, etc.) become **registered, stable Evidence source tables** generated into the shadow runtime and surfaced to Pi as the primary data context.

### Target Data Lifecycle
1. User creates workspace, copies files into `data/`
2. `cmux-evidence data refresh` scans workspace data directory
3. Refresh creates/updates `.cmux/data-registry.json`
4. Shadow runtime generates `sources/files/*.sql` from registry
5. Evidence source extraction runs for `files`
6. Pi dynamic context shows registered tables
7. Agent writes page queries using `files.<alias>`
8. Dashboard validates and previews

### Target Source Naming
- Source name: `files`
- Tables referenced as: `files.orders`, `files.customers`, etc.
- Evidence pages use `from files.orders` NOT `read_csv_auto('data/orders.csv')`

### Registry Schema (.cmux/data-registry.json)
```json
{
  "version": 1,
  "sourceName": "files",
  "workspaceRoot": "/absolute/path",
  "updatedAt": "2026-06-09T00:00:00Z",
  "tables": [
    {
      "alias": "orders",
      "qualifiedName": "files.orders",
      "path": "data/orders.csv",
      "format": "csv",
      "sizeBytes": 12345,
      "fingerprint": "size:12345;mtime:2026-06-09T00:00:00Z",
      "status": "ready",
      "columns": [{"name": "order_id", "type": "VARCHAR", "semanticRole": "id"}],
      "rowCount": 1000,
      "warnings": []
    }
  ],
  "warnings": []
}
```

---

## 🔒 Non-Negotiable Invariants (18 rules)

1. **Do not break content-only workspaces** — workspace stays clean
2. **Do not make page SQL use raw file paths** — use `files.<alias>` only
3. **Do not publish raw workspace data** — `data/**` excluded by default
4. **Do not remove TLC/MinIO first** — build new path first, prove it, then demote
5. **Do not manually edit secrets** — never expose/connection files
6. **Keep generated files clearly generated** — header comment, shadow runtime only
7. **Preserve stable aliases** — same path → same alias across refreshes
8. **Do not widen filesystem access** — stay inside workspace/runtime roots
9. **Keep DuckDB tools safe** — readonly, no shell escapes, path validation
10. **Do not break Pi package loading** — register all new assets
11. **Do not over-scope Excel** — MVP: CSV, TSV, Parquet, JSON, JSONL only
12. **Empty workspaces must remain valid** — no crash, helpful message
13. **Registry is not source of truth** — actual files are; registry is derived
14. **Preserve current commands** — new commands are additive
15. **Preserve current tests** — run before/after, fix or update intentionally
16. **Keep docs and prompts aligned** — update all references
17. **Prefer one small phase at a time** — implement, validate, continue
18. **Report back clearly** — files changed, tests run, behavior verified

---

## 📋 Implementation Phases (from 04-file-by-file-refactor-plan.md)

### Phase 1: Registry Schema & Tests
- Define registry schema
- Create test fixtures
- Write unit tests for registry behavior

### Phase 2: Registry Refresh Implementation
- Add constants and helpers to `bin/cmux-evidence`
- Implement `scan_workspace_data_files()`, `refresh_workspace_data_registry()`
- Create `data list` and `data refresh` CLI commands
- Handle empty workspaces, duplicate aliases, missing files

### Phase 3: Shadow Runtime Source Generation
- Implement `generate_workspace_file_sources()`
- Generate `sources/files/connection.yaml` and per-table `.sql` files
- Generated SQL uses `workspace-data/` paths, includes header comment

### Phase 4: Evidence Validation & Build
- Ensure Evidence can build with `files.<alias>` sources
- Create `scripts/ensure_workspace_sources.sh`
- Update `scripts/run_evidence_dev.sh`

### Phase 5: DuckDB/Pi Context Integration
- Add `workspace-data-registry.ts` to duckdb-bi
- Upgrade `duckdb_data_sources` to show registered tables
- Update `evidence-context.ts` to inject registry context

### Phase 6: Skill/Prompt Updates
- Update `evidence-dashboard/SKILL.md` data access rules
- Update `data-discovery/SKILL.md` priority order
- Search and replace TLC/MinIO references in prompts

### Phase 7: Docs/Demo Updates
- Rewrite root README for bring-your-own-files story
- Move TLC to examples/tlc/
- Update demo script

### Phase 8: TLC Demotion
- Move TLC sources/scripts to examples/
- Remove TLC from default startup path

---

## 📁 Files to Modify

| File | Change |
|------|--------|
| `bin/cmux-evidence` | Add data registry helpers, `data list`, `data refresh` commands |
| `scripts/ensure_workspace_sources.sh` | NEW — generic source bootstrap |
| `scripts/run_evidence_dev.sh` | Update to call generic sources script |
| `scripts/ensure_evidence_sources.sh` | Demote from default path |
| `pi-pkg/extensions/duckdb-bi/src/lib/paths.ts` | Add registry-aware helpers |
| `pi-pkg/extensions/duckdb-bi/src/lib/workspace-data-registry.ts` | NEW — TS registry reader |
| `pi-pkg/extensions/duckdb-bi/src/tools/data-sources.ts` | Add registered tables to output |
| `pi-pkg/extensions/duckdb-bi/src/constants.ts` | Add new tool names if needed |
| `pi-pkg/extensions/duckdb-bi/src/types.ts` | Add registry types |
| `pi-pkg/extensions/evidence-context.ts` | Add registry-aware context |
| `pi-pkg/skills/evidence-dashboard/SKILL.md` | Update data access rules |
| `pi-pkg/skills/data-discovery/SKILL.md` | Update priority order |
| `README.md` | Rewrite for new story |

## 📁 Files to Create

| File | Purpose |
|------|---------|
| `tests/test_workspace_data_registry.py` | Registry behavior tests |
| `tests/fixtures/workspace-data/orders.csv` | Test fixture |
| `tests/fixtures/workspace-data/customers.csv` | Test fixture |
| `scripts/ensure_workspace_sources.sh` | Generic source bootstrap |
| `pi-pkg/extensions/duckdb-bi/src/lib/workspace-data-registry.ts` | TS registry reader |

---

## ⚠️ Key Technical Decisions

1. **Alias Algorithm**: `data/Monthly Sales 2026.csv` → `monthly_sales_2026` (lowercase, non-alpha → `_`, trim, prefix if digit-start, collision suffix `_2`)
2. **Path Rule**: Registry paths are workspace-relative, never absolute
3. **Fingerprint**: `size:<bytes>;mtime:<iso>` for MVP (content hash optional later)
4. **Missing Files**: Keep with `status: "missing"` instead of deleting
5. **Generated SQL Path**: Use `workspace-data/` relative paths (shadow runtime symlink)
6. **MVP Scope**: CSV, TSV, Parquet, JSON, JSONL — NO Excel

---

## 🧪 Test Strategy

### Existing Tests (must preserve)
```bash
python -m unittest tests/test_cmux_evidence_content_workspace.py
```

### New Tests Required
- Empty workspace refresh succeeds (no files)
- CSV registration creates stable alias `files.orders`
- Duplicate aliases are stable (`orders`, `orders_2`)
- Shadow runtime source files generated
- Content workspace does NOT get generated `sources/files`
- Publish excludes raw data
- Missing file handled gracefully
- No MinIO/network/large-file requirements

---

## 🚫 What Must NOT Be Broken

- `cmux-evidence new/open/validate/diff/publish`
- Content-only workspace split root model
- Privacy model (no raw data published)
- Pi package loading (register all new assets)
- Existing test suite
- DuckDB tool safety guarantees

---

## 📊 Current Key CLI Commands

```bash
./bin/cmux-evidence new "Analysis Title"     # Create workspace
./bin/cmux-evidence open <slug>              # Open workspace
./bin/cmux-evidence list                     # List workspaces
./bin/cmux-evidence current                  # Current workspace
./bin/cmux-evidence status                   # Workspace status
./bin/cmux-evidence validate                 # Validate workspace
./bin/cmux-evidence diff                     # Diff workspace
./bin/cmux-evidence publish                  # Publish workspace
./bin/lumen-pi                               # Launch Pi agent
```

### New Commands (MVP)
```bash
./bin/cmux-evidence data list                # Show registered tables
./bin/cmux-evidence data refresh             # Scan files, update registry, generate sources
```
