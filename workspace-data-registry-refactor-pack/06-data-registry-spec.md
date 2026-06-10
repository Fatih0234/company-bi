# 06 — Data Registry Spec

## Purpose

`.cmux/data-registry.json` records workspace-local files as stable analytical tables.

It is the bridge between:

- files under workspace `data/`,
- generated Evidence source SQL under shadow runtime `sources/files/`,
- Pi's dynamic data context,
- DuckDB profiling tools.

## File location

```text
workspace/.cmux/data-registry.json
```

## Ownership

The registry is controlled by CLI/Pi tools, not by manual edits.

Users may read it, but they should not need to edit it by hand.

## MVP schema

```json
{
  "version": 1,
  "sourceName": "files",
  "workspaceRoot": "/absolute/path/to/workspace",
  "updatedAt": "2026-06-09T00:00:00Z",
  "tables": [
    {
      "alias": "orders",
      "qualifiedName": "files.orders",
      "path": "data/orders.csv",
      "format": "csv",
      "sizeBytes": 12345,
      "fingerprint": "sha256:example",
      "status": "ready",
      "columns": [
        {"name": "order_id", "type": "VARCHAR", "semanticRole": "id"},
        {"name": "order_date", "type": "DATE", "semanticRole": "time"},
        {"name": "revenue", "type": "DOUBLE", "semanticRole": "measure"}
      ],
      "rowCount": 1000,
      "warnings": []
    }
  ],
  "warnings": []
}
```

## Required fields

Top-level:

- `version`
- `sourceName`
- `tables`

Table-level:

- `alias`
- `qualifiedName`
- `path`
- `format`
- `status`

## Supported formats in MVP

| Extension | Format value | Generated SQL reader |
|---|---|---|
| `.csv` | `csv` | `read_csv_auto(...)` |
| `.tsv` | `tsv` | `read_csv_auto(..., delim='\t')` or equivalent |
| `.parquet` | `parquet` | `read_parquet(...)` |
| `.json` | `json` | `read_json_auto(...)` |
| `.jsonl` | `jsonl` | `read_json_auto(...)` |

Do not add Excel/XLSX in MVP.

## Status values

- `ready` — file exists and source can be generated.
- `missing` — registry entry exists but file no longer exists.
- `error` — file exists but could not be inspected or source SQL cannot be generated.
- `stale` — fingerprint changed after last profile; source can still be generated but profile should refresh.

## Alias rules

Given a file path:

```text
data/Monthly Sales 2026.csv
```

Generate alias:

```text
monthly_sales_2026
```

Rules:

1. Start with file stem.
2. Lowercase.
3. Replace non-alphanumeric runs with `_`.
4. Trim `_` from edges.
5. If empty, use `data_file`.
6. If first character is a digit, prefix `table_`.
7. Preserve existing alias for the same `path` where possible.
8. Resolve collisions by suffixing `_2`, `_3`, etc.

## Path rules

Registry paths must be workspace-relative.

Allowed:

```text
data/orders.csv
data/raw/customers.parquet
```

Forbidden:

```text
../orders.csv
/Users/name/orders.csv
~/.ssh/id_rsa
.env.local
data/../.env
```

## Fingerprint rules

MVP fingerprint can be based on:

- file size,
- mtime,
- optional content hash for small files.

Recommended field:

```json
"fingerprint": "size:12345;mtime:2026-06-09T12:00:00Z"
```

A content hash is better but may be expensive for large files.

## Column metadata

Column metadata should be best-effort.

Fields:

- `name` — required.
- `type` — optional DuckDB type.
- `semanticRole` — optional: `id`, `time`, `measure`, `dimension`, `unknown`.
- `nullable` — optional.
- `sampleValues` — optional; avoid large values or sensitive-looking data.

Do not overfit semantic inference. Use heuristics only.

## Handling deleted files

Recommendation: keep missing entries in registry with `status: "missing"`.

This helps the agent explain broken pages:

```text
files.orders is registered but data/orders.csv is missing.
```

A future cleanup command can remove missing entries.

## Handling changed files

If file fingerprint changes:

- keep alias stable,
- mark profile stale if profile exists,
- regenerate source SQL if needed,
- update size/fingerprint,
- do not break existing page queries.

## Manual editing policy

Do not ask users to manually edit `.cmux/data-registry.json`.

The correct user flow is:

```bash
cmux-evidence data refresh
```

or an equivalent Pi tool.
