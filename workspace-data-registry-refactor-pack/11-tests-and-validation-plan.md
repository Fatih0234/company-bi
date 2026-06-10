# 11 — Tests and Validation Plan

## Principle

Do not trust this refactor without tests. It touches workspace lifecycle, source generation, Pi context, and publish privacy.

## Existing tests to preserve

Run existing tests before and after changes:

```bash
python -m unittest tests/test_cmux_evidence_content_workspace.py
```

If extension-specific tests exist and you modify the extension, run those too.

## New test file

Create:

```text
tests/test_workspace_data_registry.py
```

## Test fixtures

Create tiny files:

```text
tests/fixtures/workspace-data/orders.csv
tests/fixtures/workspace-data/customers.csv
```

## Required test cases

### 1. Empty workspace refresh succeeds

Steps:

1. Create temp content workspace.
2. Ensure `data/` exists but is empty.
3. Run `cmux-evidence data refresh`.

Expected:

- exit code 0,
- helpful no-files message,
- no traceback,
- no MinIO requirement,
- no TLC requirement.

### 2. CSV registration creates registry

Steps:

1. Copy `orders.csv` into workspace `data/`.
2. Run `data refresh`.

Expected:

- `.cmux/data-registry.json` exists,
- table alias is `orders`,
- qualified name is `files.orders`,
- path is `data/orders.csv`,
- status is `ready`.

### 3. Duplicate aliases are stable

Files:

```text
data/orders.csv
data/archive/orders.csv
```

Expected:

- first alias `orders`,
- second alias `orders_2`,
- rerunning refresh preserves aliases.

### 4. Shadow runtime source files generated

Expected files:

```text
shadow-runtime/sources/files/connection.yaml
shadow-runtime/sources/files/orders.sql
```

Expected not present in content workspace:

```text
workspace/sources/files/orders.sql
```

### 5. Generated source SQL references `workspace-data`

Expected generated SQL contains:

```sql
read_csv_auto('workspace-data/orders.csv')
```

Not acceptable:

```sql
read_csv_auto('/tmp/...')
read_csv_auto('../...')
```

### 6. Missing file marked missing

Steps:

1. Register `data/orders.csv`.
2. Delete file.
3. Refresh.

Expected:

- registry entry remains or missing status is reported,
- status is `missing`,
- generated source SQL for missing table is removed or disabled.

### 7. Publish excludes raw data

Steps:

1. Register data.
2. Write report.
3. Run publish.

Expected:

- report and queries are materialized,
- `data/orders.csv` is not published by default.

### 8. Existing content-only behavior still works

Run existing content workspace tests.

Expected:

- no regressions in workspace creation,
- open layout still has split roots,
- validate repairs shadow runtime,
- diff uses snapshots,
- publish behavior preserved.

## Manual smoke test

```bash
npm install
./bin/cmux-evidence new --no-open "Sales registry smoke"
# copy examples/simple-sales-data/*.csv.example into the new workspace data/ as .csv
./bin/cmux-evidence data refresh
./bin/cmux-evidence open sales-registry-smoke
./bin/cmux-evidence validate
```

## Validation report format

After running tests, report:

```text
Tests run:
- python -m unittest tests/test_cmux_evidence_content_workspace.py
- python -m unittest tests/test_workspace_data_registry.py

Result:
- pass/fail

Failures:
- exact failure text if any
```
