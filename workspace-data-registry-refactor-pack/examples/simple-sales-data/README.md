# Simple Sales Data Example

Use these tiny fixtures to test the workspace data registry refactor.

## Files

- `orders.csv.example`
- `customers.csv.example`

To use in a workspace:

```bash
cp orders.csv.example /path/to/workspace/data/orders.csv
cp customers.csv.example /path/to/workspace/data/customers.csv
/path/to/company-bi/bin/cmux-evidence data refresh
```

Expected tables:

```text
files.orders
files.customers
```

Suggested first user prompt:

```text
Use the registered workspace data to analyze revenue by month, customer segment, and region. Build a draft first and propose a report plan.
```
