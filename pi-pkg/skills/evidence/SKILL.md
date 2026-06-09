---
name: evidence
description: Build Evidence BI dashboards with charts, tables, filters, layouts, and KPIs. Use when creating or editing any Evidence component, writing SQL queries for dashboards, or working with Evidence pages. Component details are in the documentation — this skill covers patterns and routing.
---

# Evidence Dashboard Patterns

## Documentation First

Component props, options, and detailed examples are in the OSS documentation. **Never guess props — look them up.**

**Documentation location:** `.agent/docs/evidence-oss/`
- `ROUTES.md` — task-based routing (start here)
- `INDEX.md` — full component map with doc paths

**How to look up a component:**
1. Read `.agent/docs/evidence-oss/ROUTES.md` for the task
2. Follow the link to the specific component doc
3. Read the doc at the OSS repo path
4. Copy the syntax exactly — use `<Component>` tags, not `{% %}` tags

**Source docs path:**
```
/Users/fatihkarahan/.opensrc/repos/github.com/evidence-dev/evidence/main/sites/docs/pages/
```

---

## Core Patterns

### 0. Insight Before Components

Before choosing an Evidence component, ask what the chart or KPI is supposed to reveal.

For substantial dashboard/report work, use `evidence-bi-thinking` before implementation to generate an Insight Candidate Scan and Report Design Plan.

Every major visual should have:

- a question it answers;
- an analytical move such as trend, comparison, concentration, distribution, benchmark, outlier, funnel, cohort, seasonality, or drilldown;
- a reader takeaway;
- a reason it belongs in the report.

Then use this `evidence` skill to implement the chosen components with documentation-verified syntax.

### 1. Charts First

Default to charts, not tables. Ask "can this be a chart?" before using a table.

| Data shape | Component |
|------------|-----------|
| Comparing categories | `<BarChart>` (sort descending) |
| Trend over time | `<LineChart>` or `<AreaChart>` |
| Distribution | `<Histogram>` |
| Correlation (2 vars) | `<ScatterPlot>` |
| Three variables | `<BubbleChart>` |
| Two-dimension patterns | `<Heatmap>` |
| Single KPI number | `<BigValue>` |
| Detailed rows | `<DataTable>` (last resort) |

### 2. KPIs at Top

Start every dashboard page with 2-3 `<BigValue>` cards:

```markdown
<BigValue data={summary} value=total_revenue fmt='$#,##0' title="Total Revenue" />
<BigValue data={summary} value=total_trips fmt='#,##0' title="Total Trips" />
```

### 3. Filters for Interactivity

A dashboard without filters is just a report. Add Dropdown, ButtonGroup, DateRange, or Checkbox inputs.

**Filter pattern:**
```markdown
<Dropdown name=selected_borough data={boroughs} value=borough title="Select Borough" />

```sql filtered_data
SELECT *
FROM source
WHERE borough = '${inputs.selected_borough.value}'
```

<BarChart data={filtered_data} x=zone y=revenue />
```

**Multi-select filter:**
```markdown
<Dropdown name=selected_cats data={categories} value=category multiple=true />

```sql filtered
SELECT * FROM source
WHERE category IN ${inputs.selected_cats.value}
```
```

**Date range filter:**
```markdown
<DateRange name=date_filter data={dates} dates=order_date />

```sql filtered
SELECT * FROM source
WHERE order_date BETWEEN '${inputs.date_filter.start}' AND '${inputs.date_filter.end}'
```
```

### 4. SQL + Component Pairing

Every component needs data from a SQL query. Always pair them:

````markdown
```sql query_name
SELECT dimension, measure
FROM source
GROUP BY 1
ORDER BY 2 DESC
```

<BarChart data={query_name} x=dimension y=measure />
````

### 5. Layout with Grid

Arrange charts side by side:

```markdown
<Grid cols=2>
  <BarChart data={by_zone} x=zone y=revenue />
  <LineChart data={daily} x=date y=revenue />
</Grid>
```

### 6. Value Formatting

Always use `fmt=` for readable numbers:

| Type | Format | Example |
|------|--------|---------|
| Currency | `fmt='$#,##0'` | $1,234 |
| Currency (decimals) | `fmt='$#,##0.00'` | $1,234.56 |
| Percentage | `fmt='0.0%'` | 12.3% |
| Integer | `fmt='#,##0'` | 1,234 |
| Decimal | `fmt='#,##0.00'` | 1,234.56 |

---

## Common Gotchas

1. **All bars same color?** → Use `echartsOptions={{ color: [...] }}` for per-bar colors. `colorPalette` is for series only.
2. **Dropdown not filtering?** → Check `name` prop is set, reference as `inputs.name.value` in SQL.
3. **Multi-select not working?** → Use `IN` operator, no quotes: `WHERE col IN ${inputs.name.value}`
4. **Chart not showing?** → Check SQL query name matches `data={query_name}`.
5. **Grid not working?** → Ensure children are valid components, not raw markdown.
6. **`<` or `&` in text crashes Svelte.** Use "under", "less than", "and", or HTML entities. Code blocks and components are safe.
7. **Dashboard feels generic?** → Do not add random charts. Use `evidence-bi-thinking` to generate insight candidates, choose an analytical move, and then implement the best sections with Evidence components.

---

## Data Semantics

### Safety Boundaries

Allowed by default:
- Read `sources/*/*.sql`
- Read dashboard pages and query files under `pages/**` and `queries/**`
- Read `.cmux/workspace.json` and `.cmux/evidence.json`

Do not read:
- `.env*`, `**/connection.yaml`, credential files

Ask before editing:
- `sources/**`, shared semantic/data-source files

### Metric Reasoning

- Treat inferred column classifications as hints, not facts.
- Verify column names and query definitions from safe SQL files before relying on them.
- Distinguish between: verified source behavior, reasonable inference, business assumption, unknown/needs clarification.
- Do not invent business definitions for metrics (revenue, churn, active user, etc.).
- If a metric can be interpreted multiple ways, ask or present options.
- Put important assumptions into dashboard narrative or the visible Workspace Brief.

### Metric Definition Checklist

For each important metric, identify:
- Business name
- Source query/table
- Calculation
- Time grain
- Filters/exclusions
- Dimensional cuts
- Known caveats

### Query Design Workflow

1. Start from the user question and workspace intention.
2. Identify relevant safe source SQL files.
3. Verify available columns and grains.
4. Define metrics and dimensions explicitly.
5. Write the simplest query that supports the dashboard section.
6. Use names that make Evidence components self-explanatory.
7. Add visible notes when definitions are assumptions.

### Evidence SQL Rules

- SQL fences must be named: ` ```sql query_name `
- Components reference results by name: `data={query_name}`
- Prefer dashboard-ready outputs: one row per chart/table grain.
- Avoid massive detail queries unless filtered or limited.
- Sort tables intentionally.

---

## First Dashboard Template

A strong first dashboard usually includes:

1. Concise title and goal narrative
2. KPI row (`<BigValue>`) for the 2-3 most important numbers
3. One trend over time (`<LineChart>`) when time fields exist
4. One breakdown by meaningful dimension (`<BarChart>`)
5. A sorted detail table (`<DataTable>`) if needed
6. Simple filters only when they help answer the question
7. Visible assumptions for inferred or ambiguous metrics
