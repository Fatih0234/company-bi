# Workspace Data Registry Refactor Pack

This pack is an implementation handoff for refactoring `Fatih0234/company-bi` from a baked-in MinIO/TLC demo data setup into a workspace-local, file-first data workflow.

The goal is not to turn the project into a full enterprise BI connector system yet. The goal is to make the demo and product story much simpler:

> Create a workspace. Put CSV/Parquet/JSON files into the workspace. Refresh/register data. Let Pi analyze those registered tables and build an Evidence report.

## Read this before coding

The implementation agent must read these files first, in this order:

1. `README.md` — this entry point.
2. `03-non-negotiable-invariants.md` — the rules that prevent breaking the repo.
3. `04-file-by-file-refactor-plan.md` — the main implementation map.
4. `06-data-registry-spec.md` — the registry contract.
5. `07-shadow-runtime-source-generation-spec.md` — the Evidence bridge.
6. `11-tests-and-validation-plan.md` — how to prove the refactor works.

Do not begin editing from memory. The current repository has several layers that must remain aligned: CMUX workspace lifecycle, shadow Evidence runtime, Pi extensions, Evidence source generation, DuckDB tools, dashboard skills, and publish privacy.

## What changes conceptually

### Current model

The current repo has a built-in sample domain:

- root `sources/tlc/trips.sql`
- root `sources/tlc/zones.sql`
- MinIO sync helper scripts
- `data/tlc/...` expectations
- page examples that query `tlc.trips` and `tlc.zones`

That works technically, but it makes the demo feel like a preconfigured sample BI environment rather than an agent workspace where a user can attach their own files.

### Target model

Each analysis workspace owns its local files:

```text
workspace/
  pages/
    index.md
    draft.md
    report.md
  queries/
  reports/
  data/
    orders.csv
    customers.csv
  .cmux/
    workspace.json
    evidence.json
    data-registry.json
    data-profile.json
```

The shadow runtime generates Evidence source files from the registry:

```text
shadow-runtime/
  sources/
    files/
      connection.yaml
      orders.sql
      customers.sql
  workspace-data -> symlink/copy to workspace/data
```

Evidence pages query stable names:

```sql
select
  date_trunc('month', order_date) as month,
  sum(revenue) as revenue
from files.orders
group by 1
order by 1
```

They must not use raw file paths like `read_csv_auto('data/orders.csv')` in dashboard pages.

## Why this design is correct

Evidence's data-source model is source/table based: SQL files under `/sources/[source_name]/` create tables that are queryable in Evidence as `[source_name].[query_name]`. Evidence also runs Markdown SQL code fences as page queries, and those page queries can read from configured source tables. Therefore the refactor should generate stable Evidence-compatible source tables rather than asking the agent to paste raw local file reads into page SQL.

Pi is also the right layer for this because the workflow is agentic: discover files, infer schema, profile columns, ask the user about ambiguous semantics, register stable table names, and then build the dashboard. Pi supports project-local extensions, tools, commands, skills, prompts, and packages, and this repo already loads its custom package through `pi-pkg/package.json`.

## Expected final user experience

```bash
./bin/cmux-evidence new "Sales performance"
```

User copies files into the workspace:

```text
data/orders.csv
data/customers.csv
```

User or agent refreshes data:

```bash
./bin/cmux-evidence data refresh
```

The command outputs something like:

```text
Registered workspace data:

files.orders
  Path: data/orders.csv
  Rows: 12,450
  Columns: order_id, customer_id, order_date, revenue, region

files.customers
  Path: data/customers.csv
  Rows: 2,100
  Columns: customer_id, segment, country, signup_date
```

Then the user asks Pi:

> Analyze revenue by customer segment and region.

Pi sees `files.orders` and `files.customers` in dynamic context, profiles the tables with DuckDB, writes Evidence SQL using `files.<alias>` names, and builds the dashboard.

## What the implementation pack contains

```text
workspace-data-registry-refactor-pack/
  README.md
  00-executive-summary.md
  01-current-state-map.md
  02-target-architecture.md
  03-non-negotiable-invariants.md
  04-file-by-file-refactor-plan.md
  05-new-files-to-create.md
  06-data-registry-spec.md
  07-shadow-runtime-source-generation-spec.md
  08-cli-command-spec.md
  09-pi-extension-tooling-spec.md
  10-agent-context-and-skill-refactor-spec.md
  11-tests-and-validation-plan.md
  12-migration-plan.md
  13-rollback-plan.md
  14-demo-script.md
  15-acceptance-criteria.md
  16-risk-register.md
  agent-prompts/
  specs/
  checklists/
  references/
  examples/
```

## Implementation philosophy

Work in small, testable phases:

1. Add registry specs and tests.
2. Add workspace data refresh without deleting TLC yet.
3. Generate shadow runtime `sources/files/*` from the registry.
4. Make Evidence build against `files.<alias>`.
5. Upgrade `duckdb-bi` and `evidence-context` so Pi sees registered tables.
6. Update skills/prompts.
7. Demote TLC/MinIO to an optional example.
8. Update README/demo story.

Important: do not start by deleting TLC. First build the new generic path and prove it works.

## Documentation references used for this pack

- Evidence Data Sources: `https://docs.evidence.dev/core-concepts/data-sources/`
- Evidence SQL Queries: `https://docs.evidence.dev/core-concepts/queries/`
- Evidence CSV Data Source: `https://docs.evidence.dev/core-concepts/data-sources/csv/`
- Pi docs repository path: `earendil-works/pi/packages/coding-agent/docs/`
- Current project repo: `Fatih0234/company-bi`

## Success definition

The refactor is successful when:

- a new workspace can be created with no baked-in business data,
- files dropped into `data/` can be registered,
- registered files become stable Evidence source tables like `files.orders`,
- Pi sees registered tables in context,
- dashboard pages use source table names, not raw file paths,
- Evidence validation/build succeeds,
- raw workspace `data/**` is not published by default,
- existing content-only workspace tests still pass.
