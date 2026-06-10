# 10 — Agent Context and Skill Refactor Spec

## Purpose

Teach the Pi agent the new data model so weaker agents stop reaching for TLC or raw file paths.

## `evidence-context.ts` changes

Add registry-aware dynamic context.

### Read files

If present:

```text
.cmux/data-registry.json
.cmux/data-profile.json
```

Read them safely, with max size limits. Do not read raw data files into context.

### Inject context

Example:

```text
## Workspace data

Registered tables:
- files.orders — data/orders.csv, csv, ready, 12,450 rows
  Columns: order_id, customer_id, order_date, revenue, region
- files.customers — data/customers.csv, csv, ready, 2,100 rows
  Columns: customer_id, segment, country, signup_date

Rules:
- Use registered table names like files.orders in Evidence page SQL.
- Do not use read_csv_auto(), read_parquet(), read_json_auto(), or raw file paths in dashboard pages.
- If files exist in data/ but no registered tables exist, run workspace data refresh first.
```

### Missing data behavior

If no registry and no files:

```text
No workspace data registered yet. Ask the user to add files under data/ or run data refresh after files are added.
```

If files exist but registry missing:

```text
Workspace data files are present but not registered. Run cmux-evidence data refresh before building dashboard queries.
```

## `evidence-dashboard/SKILL.md` changes

Update Data Access section.

Required wording:

```text
Evidence page queries MUST use registered workspace table names such as files.orders.
Never use raw file paths or DuckDB file readers directly in dashboard pages.
Use data discovery / registered table context first.
If data files exist but no registered tables are available, refresh/register workspace data before writing report SQL.
```

Keep the six-phase report workflow.

## `data-discovery/SKILL.md` changes

New priority order:

1. Registered workspace tables.
2. Unregistered files in `data/`.
3. Existing Evidence sources.
4. Scratch/exports only if explicitly relevant.

The skill should tell the agent to profile registered tables and ask user clarification for ambiguous business semantics.

## Prompt template changes

Search prompt files for:

- `tlc`
- `MinIO`
- `source names`
- `sources/*/*.sql`
- `read_csv_auto`
- `taxi`

Replace default workflow assumptions with workspace-file registry assumptions.

## Acceptance criteria

- New agent sessions see registered tables.
- Skills tell agents to use `files.<alias>`.
- No default skill/prompt tells agents to use TLC for ordinary workspaces.
- Raw file path reads are treated as internal exploration only, not dashboard implementation.
