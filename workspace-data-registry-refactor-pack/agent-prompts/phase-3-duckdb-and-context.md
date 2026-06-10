# Phase 3 Prompt — DuckDB BI and Dynamic Context

Goal: expose registered workspace tables to Pi tools and dynamic context.

## Files to inspect first

- `pi-pkg/extensions/duckdb-bi/src/tools/data-sources.ts`
- `pi-pkg/extensions/duckdb-bi/src/lib/paths.ts`
- `pi-pkg/extensions/evidence-context.ts`
- `09-pi-extension-tooling-spec.md`
- `10-agent-context-and-skill-refactor-spec.md`

## Files likely to modify/create

- Create: `pi-pkg/extensions/duckdb-bi/src/lib/workspace-data-registry.ts`
- Modify: `pi-pkg/extensions/duckdb-bi/src/tools/data-sources.ts`
- Modify: `pi-pkg/extensions/evidence-context.ts`
- Modify tests if extension test coverage exists

## Task

Make registered tables visible to the agent.

`duckdb_data_sources` should return `registered_tables` with `recommended_for_dashboard: true`.

`evidence-context.ts` should inject a workspace data section with `files.<alias>` tables and rules.

## Do not do

- do not make the tool read raw data into context,
- do not expose absolute paths unless debug mode explicitly needs them,
- do not weaken path safety,
- do not add new unregistered Pi assets unless necessary.

## Acceptance criteria

- Pi context shows registered tables.
- `duckdb_data_sources` distinguishes registered tables from raw files.
- Raw file paths are not recommended for dashboard page SQL.
