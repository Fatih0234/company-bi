# Query Patterns for Evidence BI Thinking

These are conceptual SQL shapes for report planning. Adapt table names, columns, date logic, and metrics to the actual Evidence workspace.

Always test queries before placing them into Evidence pages.

---

## KPI summary

Use for top-level BigValue cards.

```sql
select
  sum(revenue) as total_revenue,
  count(*) as total_records,
  count(distinct customer_id) as customers,
  avg(revenue) as avg_revenue
from source_table
```

---

## Trend over time

```sql
select
  date_trunc('month', date_col) as month,
  sum(metric) as metric
from source_table
group by 1
order by 1
```

---

## Trend by segment

```sql
select
  date_trunc('month', date_col) as month,
  segment,
  sum(metric) as metric
from source_table
group by 1, 2
order by 1, 2
```

---

## Top-N ranking

```sql
select
  entity,
  sum(metric) as metric
from source_table
group by 1
order by metric desc
limit 10
```

---

## Top-N with share of total

```sql
with entity_value as (
  select
    entity,
    sum(metric) as value
  from source_table
  group by 1
), total as (
  select sum(value) as total_value from entity_value
)
select
  entity,
  value,
  value / total_value as share_of_total
from entity_value, total
order by value desc
limit 10
```

---

## Top 10 percent contribution

```sql
with entity_value as (
  select entity, sum(metric) as value
  from source_table
  group by 1
), ranked as (
  select
    *,
    row_number() over (order by value desc) as rn,
    count(*) over () as entity_count,
    sum(value) over () as total_value
  from entity_value
)
select
  sum(value) as top_decile_value,
  max(total_value) as total_value,
  sum(value) / max(total_value) as top_decile_share
from ranked
where rn <= ceil(entity_count * 0.10)
```

---

## Pareto cumulative share

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

## Period-over-period comparison

```sql
with base as (
  select
    dimension,
    case
      when date_col >= date '2024-02-01' and date_col < date '2024-03-01' then 'current'
      when date_col >= date '2024-01-01' and date_col < date '2024-02-01' then 'previous'
    end as period,
    sum(metric) as metric
  from source_table
  where date_col >= date '2024-01-01'
    and date_col < date '2024-03-01'
  group by 1, 2
), pivoted as (
  select
    dimension,
    sum(case when period = 'current' then metric else 0 end) as current_metric,
    sum(case when period = 'previous' then metric else 0 end) as previous_metric
  from base
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

## Distribution summary

```sql
select
  avg(metric) as avg_metric,
  median(metric) as median_metric,
  min(metric) as min_metric,
  max(metric) as max_metric,
  quantile_cont(metric, 0.25) as p25_metric,
  quantile_cont(metric, 0.75) as p75_metric,
  quantile_cont(metric, 0.90) as p90_metric,
  quantile_cont(metric, 0.95) as p95_metric
from source_table
where metric is not null
```

---

## Histogram bins

Use if the Evidence chart does not handle binning automatically or if custom bins are needed.

```sql
select
  floor(metric / 10) * 10 as bin_start,
  count(*) as records
from source_table
where metric is not null
group by 1
order by 1
```

---

## Outlier candidate table

```sql
with entity_metrics as (
  select
    entity,
    count(*) as volume,
    sum(value_metric) as value,
    avg(rate_metric) as rate
  from source_table
  group by 1
), stats as (
  select
    avg(value) as avg_value,
    stddev(value) as sd_value,
    avg(rate) as avg_rate,
    stddev(rate) as sd_rate
  from entity_metrics
)
select
  entity,
  volume,
  value,
  rate,
  (value - avg_value) / nullif(sd_value, 0) as value_z,
  (rate - avg_rate) / nullif(sd_rate, 0) as rate_z
from entity_metrics, stats
where volume >= 10
order by abs((value - avg_value) / nullif(sd_value, 0)) desc
```

---

## Benchmark vs average

```sql
with entity_metrics as (
  select
    entity,
    sum(metric) as metric
  from source_table
  group by 1
), benchmark as (
  select avg(metric) as avg_metric from entity_metrics
)
select
  entity,
  metric,
  avg_metric,
  metric - avg_metric as difference_from_average,
  metric / nullif(avg_metric, 0) - 1 as percent_vs_average
from entity_metrics, benchmark
order by difference_from_average desc
```

---

## Funnel stage counts

```sql
select
  stage,
  count(distinct entity_id) as entities
from source_table
group by 1
order by min(stage_order)
```

---

## Hour x weekday heatmap

```sql
select
  strftime(date_col, '%w') as day_of_week,
  extract(hour from date_col) as hour_of_day,
  count(*) as records
from source_table
group by 1, 2
order by 1, 2
```

---

## Risk/opportunity quadrant

```sql
select
  entity,
  sum(value_metric) as value,
  avg(performance_metric) as performance,
  count(*) as volume
from source_table
group by 1
having count(*) >= 10
```

Interpretation examples:

- high value + low performance = risk;
- high value + high performance = protect/scale;
- low value + high performance = niche strength;
- low value + low performance = deprioritize or investigate.

---

## Scoped drilldown

```sql
select
  entity,
  metric_1,
  metric_2,
  metric_3,
  updated_at
from source_table
where relevant_condition
order by metric_1 desc
limit 100
```

Rule: drilldown tables should be scoped to a decision or action, not raw data dumps.
