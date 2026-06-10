# Command Output Examples

## `cmux-evidence data refresh` with no files

```text
No workspace data files found.

Add files under:
  data/

Supported formats:
  .csv, .tsv, .parquet, .json, .jsonl

No Evidence source files were generated.
```

## `cmux-evidence data refresh` with files

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

## `cmux-evidence data list`

```text
Registered workspace data

files.orders
  Path: data/orders.csv
  Format: csv
  Status: ready
  Rows: 12450
  Columns: order_id, customer_id, order_date, revenue, region
```
