# Expected First Dashboard Shape

A good first dashboard from the simple sales data should include:

- KPI cards for total revenue, order count, average order value.
- Monthly revenue trend.
- Revenue by customer segment.
- Revenue by region.
- Optional product category breakdown.
- A short caveat that the fixture data is tiny and not representative.

Evidence page SQL should query:

```sql
from files.orders
join files.customers using (customer_id)
```

It should not query raw CSV paths.
