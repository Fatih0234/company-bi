# 14 — Demo Script

This is the target product demo after the refactor.

## Goal

Show that Company BI can start from ordinary business files and produce an Evidence dashboard through an agent workflow.

## Setup

Prepare two small files:

```text
orders.csv
customers.csv
```

Use the examples in `examples/simple-sales-data/` from this pack.

## Demo flow

### 1. Create a workspace

```bash
./bin/cmux-evidence new "Sales performance"
```

Explain:

> This creates a clean analysis workspace. It does not come with a prebuilt database. The workspace is isolated and has its own data folder.

### 2. Attach files

Copy files into the workspace:

```text
data/orders.csv
data/customers.csv
```

Explain:

> For the MVP, attaching data is just putting files in `data/`.

### 3. Refresh/register data

```bash
./bin/cmux-evidence data refresh
```

Expected output:

```text
files.orders
files.customers
```

Explain:

> The files are now stable Evidence tables. The agent can query them without relying on raw file paths.

### 4. Ask Pi to analyze

Prompt:

```text
Use the registered workspace data to analyze revenue by month, customer segment, and region. Build a draft first, then propose a report plan.
```

### 5. Agent profiles data

Expected behavior:

- agent lists registered tables,
- describes columns,
- samples rows,
- checks join key coverage,
- identifies key metrics and dimensions.

### 6. Agent builds report

Expected Evidence content:

- KPI row,
- monthly revenue trend,
- revenue by customer segment,
- region breakdown,
- top customers or orders table,
- caveats.

### 7. Validate and preview

```bash
./bin/cmux-evidence validate
```

Use CMUX browser preview.

### 8. Publish

```bash
./bin/cmux-evidence publish
```

Explain:

> Publishing shares the report and queries, not the raw attached files by default.

## Demo message

The simple explanation:

> This is not trying to be a full enterprise BI platform yet. It is a local-first agent workspace where a user can drop in files, get them registered as analyzable tables, and have an agent build a useful Evidence report.
