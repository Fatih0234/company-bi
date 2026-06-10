# 08 — CLI Command Spec

## MVP commands

Implement only these first:

```bash
./bin/cmux-evidence data list
./bin/cmux-evidence data refresh
```

Do not implement `data add`, `data remove`, or Excel import until MVP passes tests.

## `data list`

### Purpose

Show registered workspace data tables.

### Usage

```bash
./bin/cmux-evidence data list
```

### Works from

- content workspace root,
- main project root if it can resolve a current workspace later,
- for MVP, content workspace root is enough.

### Output with no registry

```text
No workspace data registry found.
Add files under data/ and run:
  cmux-evidence data refresh
```

### Output with no files

```text
No workspace data files registered.
Supported formats: csv, tsv, parquet, json, jsonl
Data directory: data/
```

### Output with registered files

```text
Registered workspace data

files.orders
  Path: data/orders.csv
  Format: csv
  Status: ready
  Rows: 12450
  Columns: order_id, customer_id, order_date, revenue, region

files.customers
  Path: data/customers.csv
  Format: csv
  Status: ready
  Rows: 2100
  Columns: customer_id, segment, country, signup_date
```

## `data refresh`

### Purpose

Scan workspace `data/`, update `.cmux/data-registry.json`, generate shadow runtime source SQL, and optionally run Evidence sources.

### Usage

```bash
./bin/cmux-evidence data refresh
```

### Required behavior

1. Locate workspace root.
2. Ensure `data/` exists.
3. Scan supported files.
4. Preserve stable aliases.
5. Write `.cmux/data-registry.json`.
6. Ensure shadow runtime exists.
7. Generate `shadow-runtime/sources/files/*`.
8. Run `npm run sources -- --sources files` if one or more ready tables exist.
9. Print summary.

### Output with registered files

```text
Workspace data refreshed.

Registered tables:
  files.orders     data/orders.csv       ready
  files.customers  data/customers.csv    ready

Generated Evidence source files:
  sources/files/connection.yaml
  sources/files/orders.sql
  sources/files/customers.sql

Next:
  Use files.orders and files.customers in Evidence page SQL.
```

### Output with no files

```text
No workspace data files found.

Add files under:
  data/

Supported formats:
  .csv, .tsv, .parquet, .json, .jsonl

No Evidence source files were generated.
```

### Failure messages

Malformed registry:

```text
Data registry is invalid: <reason>
Fix or remove .cmux/data-registry.json, then run data refresh again.
```

Path safety failure:

```text
Refusing to register data file outside workspace data/: <path>
```

Evidence source failure:

```text
Workspace data registry was updated, but Evidence source extraction failed.
Run with --verbose or inspect the dev server logs.
```

## Later commands, not MVP

```bash
cmux-evidence data add <path>
cmux-evidence data remove <alias>
cmux-evidence data profile
cmux-evidence data doctor
```

Do not implement these until the MVP is complete.
