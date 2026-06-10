# 02 — Target Architecture

## Target design in one sentence

Workspace-local files become registered, stable Evidence source tables generated into the shadow runtime and surfaced to Pi as the primary data context.

## Target runtime diagram

```text
┌─────────────────────────────────────────────────────────────┐
│ Content Workspace                                            │
│                                                             │
│  pages/                                                     │
│    index.md        brief / intention / workspace map         │
│    draft.md        exploration sandbox                       │
│    report.md       polished report                           │
│  queries/          reusable analysis SQL                     │
│  reports/          report artifacts / slides later            │
│  data/             user-attached data files                   │
│    orders.csv                                               │
│    customers.parquet                                         │
│  .cmux/                                                     │
│    workspace.json                                            │
│    evidence.json                                             │
│    data-registry.json                                        │
│    data-profile.json                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
             │
             │ cmux-evidence data refresh
             ▼
┌─────────────────────────────────────────────────────────────┐
│ Shadow Evidence Runtime                                      │
│                                                             │
│  package.json -> root package                                │
│  node_modules -> root node_modules                           │
│  pages -> workspace/pages                                    │
│  queries -> workspace/queries                                │
│  reports -> workspace/reports                                │
│  workspace-data -> workspace/data                            │
│  sources/                                                    │
│    files/                                                    │
│      connection.yaml                                         │
│      orders.sql                                              │
│      customers.sql                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
             │
             │ npm run sources -- --sources files
             ▼
┌─────────────────────────────────────────────────────────────┐
│ Evidence                                                     │
│                                                             │
│  files.orders                                                │
│  files.customers                                             │
│                                                             │
│  Markdown page SQL reads stable source names.                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
             ▲
             │ dynamic context + tools
┌─────────────────────────────────────────────────────────────┐
│ Pi / duckdb-bi                                               │
│                                                             │
│  discovers files                                             │
│  refreshes registry                                          │
│  profiles tables                                             │
│  injects registered table context                            │
│  writes Evidence pages                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Core data lifecycle

1. Workspace is created with empty `data/`.
2. User copies files into `data/`.
3. `cmux-evidence data refresh` scans the workspace data directory.
4. Refresh creates/updates `.cmux/data-registry.json`.
5. Refresh optionally creates/updates `.cmux/data-profile.json`.
6. Shadow runtime generates `sources/files/*.sql` from the registry.
7. Evidence source extraction runs for `files`.
8. Pi dynamic context shows registered tables.
9. Agent writes page queries using `files.<alias>`.
10. Dashboard validates and previews.

## Source naming convention

The initial generated Evidence source should be named `files`.

Registered tables should be referenced as:

```text
files.<alias>
```

Examples:

```text
files.orders
files.customers
files.web_events
files.products_2
```

## Alias rules

- Lowercase by default.
- Replace non-alphanumeric characters with underscores.
- Strip leading/trailing underscores.
- If alias starts with a digit, prefix `table_`.
- If alias collides, append `_2`, `_3`, etc.
- Alias stability matters. The same file path should retain the same alias across refreshes unless there is a conflict that cannot be resolved otherwise.

## Generated source SQL examples

For `data/orders.csv`:

```sql
-- Generated by cmux-evidence data refresh. Do not edit by hand.
select *
from read_csv_auto('workspace-data/orders.csv')
```

For `data/customers.parquet`:

```sql
-- Generated by cmux-evidence data refresh. Do not edit by hand.
select *
from read_parquet('workspace-data/customers.parquet')
```

For `data/events.jsonl`:

```sql
-- Generated by cmux-evidence data refresh. Do not edit by hand.
select *
from read_json_auto('workspace-data/events.jsonl')
```

## Design boundaries

User-editable:

```text
pages/**
queries/**
reports/**
data/**
.cmux/data-registry.json only through commands/tools
.cmux/data-profile.json only through commands/tools
```

Runtime-generated:

```text
shadow-runtime/sources/files/**
shadow-runtime/.evidence/**
.pi/duckdb/**
```

Human-controlled implementation surfaces:

```text
bin/**
scripts/**
pi-pkg/extensions/**
pi-pkg/skills/**
package.json
package-lock.json
```

## Publish model

Default publish keeps current privacy:

- publish `pages/report.md`,
- publish `queries/**`,
- do not publish raw `data/**`,
- do not publish `.pi/duckdb/**`,
- do not publish `.cmux/data-profile.json` unless explicitly designed later.

Later optional modes can be added:

```bash
cmux-evidence publish --include-data
cmux-evidence publish --include-extracts
```

Do not implement these optional modes in the MVP.
