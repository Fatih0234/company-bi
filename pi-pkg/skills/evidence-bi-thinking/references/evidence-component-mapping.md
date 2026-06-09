# Evidence Component Mapping for BI Thinking

Use this reference to map analytical intent to Evidence components.

This file is not a substitute for Evidence documentation. Use the `evidence` skill and docs lookup for exact props and syntax.

---

## KPI and narrative components

### `<BigValue>`

Use for top-level dashboard metrics.

Best for:

- total revenue;
- active users;
- order count;
- conversion rate;
- average order value;
- period-over-period change;
- top-decile share.

Design guidance:

- Put 2–4 BigValues near the top.
- Include context where possible: previous period, target, average, or share of total.
- Avoid KPI rows with numbers that do not help the reader decide anything.

### `<Value>`

Use for inline dynamic numbers inside narrative.

Best for:

- “The top 10% of customers generated `<Value ... />` of revenue.”
- “Median fare was `<Value ... />`, compared with an average of `<Value ... />`.”

Design guidance:

- Use inline values to make prose precise.
- Use explicit formatting.

---

## Comparison components

### `<BarChart>`

Use for category comparisons.

Best for:

- top-N rankings;
- revenue by category;
- change drivers;
- above/below benchmark comparisons;
- segment comparisons.

Design guidance:

- Sort descending for rankings.
- Use horizontal orientation for long labels when supported.
- Add share-of-total context for top-N charts.
- Avoid showing too many categories at once.

### `<DataTable>`

Use for drilldown and detailed lookup.

Best for:

- top entity details;
- exception lists;
- rows requiring action;
- data audit or QA;
- supporting table after a chart.

Design guidance:

- Tables should be scoped, sorted, and purposeful.
- Do not use a raw table when a chart would reveal the pattern faster.

---

## Time-series components

### `<LineChart>`

Use for trends over time.

Best for:

- revenue by day/month;
- active users over time;
- conversion rate over time;
- multi-series trend by segment.

Design guidance:

- Use chronological ordering.
- Add segment series only when it clarifies the story.
- Avoid too many series.

### `<AreaChart>`

Use for volume trends and mix shift.

Best for:

- stacked category contribution over time;
- total volume with composition;
- market/share mix over time.

Design guidance:

- Use when cumulative magnitude matters.
- For pure trend readability, prefer LineChart.

### `<Sparkline>`

Use for compact trend context next to summary metrics.

Best for:

- KPI cards with small trend lines;
- table cells showing mini-trends;
- compact monitoring dashboards.

---

## Distribution components

### `<Histogram>`

Use for distribution of one numeric metric.

Best for:

- fare distribution;
- duration distribution;
- order value distribution;
- revenue per customer distribution.

Design guidance:

- Use when averages might be misleading.
- Pair with BigValues for mean, median, p90, p95.

### `<BoxPlot>`

Use for comparing distributions across groups.

Best for:

- fare distribution by borough;
- response time by team;
- order value by channel.

Design guidance:

- Useful when spread and outliers matter.
- Avoid if the audience is unlikely to understand box plots unless you add explanation.

---

## Relationship components

### `<ScatterPlot>`

Use for relationships between two numeric metrics.

Best for:

- revenue vs volume;
- fare vs distance;
- conversion vs spend;
- quality vs speed.

Design guidance:

- Use to identify clusters, outliers, and quadrants.
- Add filters or drilldown table for interesting points.

### `<BubbleChart>`

Use for three-variable relationships.

Best for:

- x = growth, y = margin, size = revenue;
- x = trips, y = average fare, size = revenue;
- x = conversion, y = cost, size = spend.

Design guidance:

- Use size only when it adds meaning.
- Avoid if too many bubbles overlap.

---

## Pattern and flow components

### `<Heatmap>`

Use for two-dimensional intensity patterns.

Best for:

- hour x weekday;
- category x region;
- cohort x month;
- risk matrix.

Design guidance:

- Great for seasonality and operational patterns.
- Label axes clearly.

### `<CalendarHeatmap>`

Use for daily activity intensity.

Best for:

- daily orders;
- daily incidents;
- daily revenue;
- daily usage.

### `<FunnelChart>`

Use for ordered stage drop-off.

Best for:

- acquisition funnel;
- sales pipeline;
- application funnel;
- support escalation stages.

### `<SankeyDiagram>`

Use for flows between categories.

Best for:

- source → destination flows;
- status transitions;
- channel → conversion paths.

Caveat:

- Only use when flow is central to the story. Sankeys can become visually noisy.

---

## Layout and interaction components

### `<Grid>`

Use for visual layout.

Best for:

- KPI rows;
- side-by-side comparisons;
- chart plus explanatory table.

Design guidance:

- Avoid making every component the same visual weight.
- Put the most important section first.

### Input components

Use filters only when they help the reader answer the question.

Common uses:

- `<Dropdown>` for category/entity filter;
- `<ButtonGroup>` for metric or segment selection;
- `<DateRange>` for time window;
- `<Checkbox>` for include/exclude toggles;
- `<Slider>` for thresholds.

Design guidance:

- Use clear labels and defaults.
- Do not add filters only to make the dashboard feel interactive.
- Put filters near the sections they affect.

---

## Custom ECharts

Use `<ECharts>` only when built-in Evidence components cannot express the intended chart.

Before using custom ECharts, ask:

1. Can a built-in Evidence component do this?
2. Can `echartsOptions` or `seriesOptions` adjust a built-in chart instead?
3. Is the advanced chart worth the added complexity?
4. Will the next maintainer understand it?

Default to built-ins unless the custom visualization is clearly justified.
