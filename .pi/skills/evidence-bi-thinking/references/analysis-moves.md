# Analysis Moves Cookbook

Use this cookbook to generate useful Evidence report ideas before choosing components.

The purpose is to make the agent ask better analytical questions, not merely create charts.

---

## 1. Top-N

### Use when

There is an entity dimension and a value metric.

Examples:

- products by revenue;
- customers by spend;
- zones by trips;
- campaigns by conversions;
- support agents by tickets closed.

### Questions

- Who are the top performers?
- Does the ranking have a steep drop-off?
- Are the top entities stable over time?
- Are top entities high-value because of volume, rate, or both?

### Evidence outputs

- `<BarChart>` sorted descending;
- `<DataTable>` for drilldown;
- `<BigValue>` for top-N share of total.

### Caveat

A top-10 chart without context can be shallow. Add share-of-total, period-over-period change, or benchmark where possible.

---

## 2. Top-percent / top-decile concentration

### Use when

Many entities contribute to a total and the distribution may be skewed.

### Questions

- What share of total value comes from the top 10% of entities?
- Is performance concentrated or broad-based?
- Would losing a small group create risk?
- Should stakeholders focus on the head or long tail?

### Evidence outputs

- `<BigValue>`: top 10% share;
- `<BarChart>`: top entities;
- `<LineChart>`: cumulative contribution curve;
- `<DataTable>`: top-decile entities.

### Query shape

```sql
with entity_value as (
  select
    entity,
    sum(metric) as value
  from source_table
  group by 1
), ranked as (
  select
    *,
    row_number() over (order by value desc) as rn,
    count(*) over () as n,
    sum(value) over () as total_value
  from entity_value
)
select
  sum(value) / max(total_value) as top_10_percent_share
from ranked
where rn <= ceil(n * 0.10)
```

---

## 3. Pareto / cumulative share

### Use when

You want to show how quickly total value accumulates across ranked entities.

### Questions

- How many entities generate 80% of the value?
- Is there a long tail?
- Are top performers disproportionately important?

### Evidence outputs

- `<LineChart>` for cumulative share;
- `<BarChart>` for ranked values;
- `<BigValue>` for number of entities required to reach 80%.

### Query shape

```sql
with entity_value as (
  select entity, sum(metric) as value
  from source_table
  group by 1
), ranked as (
  select
    entity,
    value,
    row_number() over (order by value desc) as rank,
    sum(value) over (order by value desc rows between unbounded preceding and current row) as cumulative_value,
    sum(value) over () as total_value
  from entity_value
)
select
  entity,
  rank,
  value,
  cumulative_value / total_value as cumulative_share
from ranked
order by rank
```

---

## 4. Trend

### Use when

A date/time field exists.

### Questions

- Is the metric increasing, decreasing, seasonal, or volatile?
- What changed recently?
- Are there spikes or drops?
- Does the trend differ by segment?

### Evidence outputs

- `<LineChart>` for time series;
- `<AreaChart>` for stacked volume or mix;
- `<BigValue>` for current value and change;
- `<Sparkline>` for compact trend.

### Query shape

```sql
select
  date_trunc('month', date_col) as month,
  sum(metric) as metric
from source_table
group by 1
order by 1
```

---

## 5. Period-over-period change driver

### Use when

The user needs to know what caused a metric to change.

### Questions

- Which categories drove the increase or decrease?
- Is the change broad-based or concentrated?
- Did volume, rate, or mix drive the change?

### Evidence outputs

- `<BigValue>` for total change;
- `<BarChart>` for driver ranking;
- `<DataTable>` for detailed components.

### Query shape

```sql
with periodized as (
  select
    dimension,
    case
      when date_col >= date '2024-01-01' and date_col < date '2024-02-01' then 'current'
      when date_col >= date '2023-12-01' and date_col < date '2024-01-01' then 'previous'
    end as period,
    sum(metric) as metric
  from source_table
  group by 1, 2
), pivoted as (
  select
    dimension,
    sum(case when period = 'current' then metric else 0 end) as current_metric,
    sum(case when period = 'previous' then metric else 0 end) as previous_metric
  from periodized
  group by 1
)
select
  dimension,
  current_metric,
  previous_metric,
  current_metric - previous_metric as absolute_change,
  (current_metric - previous_metric) / nullif(previous_metric, 0) as percent_change
from pivoted
order by absolute_change desc
```

---

## 6. Segment comparison

### Use when

A category dimension may explain different behavior.

### Questions

- Which segments are above or below average?
- Does the overall trend hide segment differences?
- Which segment deserves attention?
- Should the reader be able to filter by segment?

### Evidence outputs

- grouped or stacked `<BarChart>`;
- multi-series `<LineChart>`;
- `<Dropdown>` or `<ButtonGroup>` for interaction;
- `<DataTable>` for segment summary.

---

## 7. Distribution check

### Use when

The report uses averages, rates, amounts, durations, distances, or other measures where spread matters.

### Questions

- Is the average representative?
- Is the median different from the mean?
- Are there long tails or outliers?
- Should we show p50, p90, or p95?

### Evidence outputs

- `<Histogram>`;
- `<BoxPlot>`;
- `<BigValue>` for mean, median, p90;
- `<DataTable>` for extreme values.

### Query shape

```sql
select
  avg(metric) as avg_metric,
  median(metric) as median_metric,
  quantile_cont(metric, 0.9) as p90_metric,
  quantile_cont(metric, 0.95) as p95_metric
from source_table
where metric is not null
```

---

## 8. Outlier detection

### Use when

Entities vary widely and unusual combinations may be important.

### Questions

- Which entities are unusually high or low?
- Which are high-value but underperforming?
- Which are low-volume but high-growth?
- Which points deserve investigation?

### Evidence outputs

- `<ScatterPlot>`;
- `<BubbleChart>`;
- `<DataTable>` for outlier list;
- `<Alert>` or narrative caveat for interpretation.

### Query shape

```sql
select
  entity,
  count(*) as volume,
  sum(value_metric) as value,
  avg(rate_metric) as rate
from source_table
group by 1
having count(*) >= 10
```

---

## 9. Benchmark comparison

### Use when

A metric needs context.

### Questions

- How does each entity compare to the average, median, target, or peer group?
- Which groups are meaningfully above or below baseline?
- Are differences large enough to matter?

### Evidence outputs

- `<BarChart>` sorted by difference from benchmark;
- `<BigValue>` for benchmark value;
- reference lines or annotations where supported;
- `<DataTable>` for benchmark deltas.

---

## 10. Funnel / stage drop-off

### Use when

The data has ordered statuses, steps, lifecycle stages, or conversion steps.

### Questions

- Where is the largest drop-off?
- Which stage limits the final outcome?
- Does drop-off vary by segment?

### Evidence outputs

- `<FunnelChart>`;
- `<BarChart>` for conversion by segment;
- `<DataTable>` for stage metrics.

---

## 11. Cohort comparison

### Use when

Entities have a start date, signup date, acquisition date, first transaction date, or cohort field.

### Questions

- Do newer cohorts behave differently from older cohorts?
- Does retention or value decay over time?
- Which cohort is strongest?

### Evidence outputs

- `<LineChart>` by cohort;
- `<Heatmap>` for cohort x age;
- `<DataTable>` for cohort summary.

---

## 12. Seasonality / calendar pattern

### Use when

Time can be broken into hour, weekday, week, month, or season.

### Questions

- Are there repeating time patterns?
- Which hours/days/months are strongest?
- Are anomalies actually seasonal?

### Evidence outputs

- `<Heatmap>` for hour x weekday;
- `<CalendarHeatmap>` for daily intensity;
- `<LineChart>` for weekly/monthly trend.

---

## 13. Mix shift

### Use when

Composition changes over time.

### Questions

- Is growth driven by one category?
- Is the business mix changing?
- Are shares moving even when totals are stable?

### Evidence outputs

- stacked `<AreaChart>`;
- stacked `<BarChart>`;
- `<LineChart>` for share over time.

---

## 14. Risk/opportunity quadrant

### Use when

Two metrics create an action matrix.

Examples:

- high revenue + low margin = risk;
- high demand + low supply = opportunity;
- high cost + low conversion = waste;
- high growth + low volume = emerging opportunity.

### Evidence outputs

- `<ScatterPlot>`;
- `<BubbleChart>`;
- `<DataTable>` filtered to priority quadrant.

---

## 15. Drilldown

### Use when

The reader needs to act on specific entities after seeing the summary.

### Questions

- Which rows should someone inspect?
- What columns are needed to take action?
- Should the table be filtered to exceptions, top entities, or selected segment?

### Evidence outputs

- `<DataTable>` with search/sort;
- row links to templated pages;
- scoped table, not raw everything.

### Rule

A drilldown table should usually follow a chart or KPI. Do not lead with raw rows unless the user specifically asks for a table-first report.
