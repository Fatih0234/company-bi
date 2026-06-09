# Dashboard Anti-Patterns and Quality Gates

Use this reference when a dashboard technically works but feels boring, shallow, cluttered, or not decision-useful.

---

## Anti-pattern: KPI row with no context

### Problem

The page starts with three numbers, but the reader cannot tell whether they are good, bad, improving, or declining.

### Fix

Add one or more:

- previous-period comparison;
- target comparison;
- share of total;
- benchmark vs average/median;
- short interpretation sentence.

---

## Anti-pattern: top 10 without share of total

### Problem

A top-10 chart shows ranking but not importance.

### Fix

Add:

- top 10 share of total;
- top 10% share of total;
- cumulative share/Pareto curve;
- long-tail caveat.

---

## Anti-pattern: average-only analysis

### Problem

The report uses averages where the data may be skewed.

### Fix

Add:

- median;
- p90/p95;
- histogram;
- box plot;
- outlier table.

---

## Anti-pattern: wall of tables

### Problem

The report feels like a spreadsheet dump.

### Fix

Convert tables into:

- KPI row;
- trend chart;
- ranking chart;
- distribution chart;
- drilldown table only after the summary.

---

## Anti-pattern: decorative filters

### Problem

Filters exist but do not help the reader make a better decision.

### Fix

Keep filters only when they answer a meaningful question:

- time window;
- segment/category;
- metric selector;
- threshold;
- entity type.

Remove filters that only add complexity.

---

## Anti-pattern: descriptive chart titles

### Problem

Titles say what the chart is, not what the reader should notice.

Weak:

```text
Revenue by Month
```

Better:

```text
Revenue peaked in March before flattening in Q2
```

### Fix

Use insight titles when the insight is verified. If not yet verified, use a neutral exploratory title.

---

## Anti-pattern: every chart has equal visual weight

### Problem

The reader cannot tell what matters most.

### Fix

Use visual hierarchy:

1. top-level answer;
2. main supporting trend/chart;
3. secondary breakdowns;
4. detail table;
5. caveats.

---

## Anti-pattern: chart chosen because it was easy

### Problem

The chart is technically correct but not useful.

### Fix

For each chart, require:

```text
Question → chart → interpretation → implication
```

If there is no real question, remove or replace the chart.

---

## Anti-pattern: hidden metric assumptions

### Problem

The dashboard uses terms like revenue, churn, active user, conversion, success, or utilization without explaining definitions.

### Fix

Add visible notes:

- source table/query;
- calculation;
- time grain;
- filters/exclusions;
- known caveats.

---

## Anti-pattern: unscoped drilldown table

### Problem

The table contains too many rows or columns and no action path.

### Fix

Scope the table to:

- top entities;
- exceptions;
- selected segment;
- risk/opportunity candidates;
- rows that require action.

---

## Anti-pattern: no empty-state handling

### Problem

Filters can produce blank charts or misleading empty sections.

### Fix

Use conditional rendering and explanatory notes:

```markdown
{#if query_name.length > 0}
  <BarChart data={query_name} x=dimension y=metric />
{:else}
  <Alert status=warning>No data found for the selected filters.</Alert>
{/if}
```

---

# Quality gates

Before a report is considered good, check:

1. Does the top of the page answer the main question?
2. Are KPIs contextualized?
3. Is there a trend when time exists?
4. Is there a meaningful breakdown when dimensions exist?
5. Is there at least one deeper analytical move?
6. Are tables used only for drilldown or detail?
7. Does every chart have a reason to exist?
8. Does the narrative interpret, not just describe?
9. Are assumptions/caveats visible?
10. Would the report help someone decide or act?
