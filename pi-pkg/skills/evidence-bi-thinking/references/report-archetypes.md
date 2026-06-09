# Report Archetypes

Choose an archetype before designing sections. Different report types require different narrative arcs.

---

## 1. Executive dashboard

### Use when

The stakeholder needs a fast, high-level view for decision-making.

### Default story

```text
KPI status → trend → drivers → risks/opportunities → drilldown
```

### Typical sections

1. Goal / scope statement
2. KPI row
3. Main trend
4. Driver breakdown
5. Concentration or risk section
6. Drilldown table
7. Caveats / next actions

### Good components

- `<BigValue>`
- `<LineChart>`
- `<BarChart>`
- `<DataTable>`
- `<Note>` / `<Alert>` for caveats

---

## 2. Diagnostic report

### Use when

Something changed, broke, dropped, spiked, or needs explanation.

### Default story

```text
Symptom → timeline → segment split → driver analysis → likely causes → next checks
```

### Typical sections

1. What changed?
2. When did it change?
3. Where did it change most?
4. Which segment/entity drove the change?
5. What evidence supports possible explanations?
6. What remains uncertain?

### Good components

- `<BigValue>` for change magnitude
- `<LineChart>` for time of change
- `<BarChart>` for drivers
- `<ScatterPlot>` for outliers
- `<DataTable>` for affected entities

---

## 3. Opportunity report

### Use when

The user wants to identify where to act, invest, prioritize, or improve.

### Default story

```text
Opportunity size → ranked targets → high-value segments → constraints → recommended actions
```

### Typical sections

1. Opportunity summary
2. Top opportunities by value
3. Risk/opportunity quadrant
4. Segment comparison
5. Drilldown of recommended targets

### Good components

- `<BigValue>` for total opportunity
- `<BarChart>` for ranked targets
- `<ScatterPlot>` or `<BubbleChart>` for opportunity matrix
- `<DataTable>` for action list

---

## 4. Monitoring dashboard

### Use when

The dashboard will be reused regularly to track health or operations.

### Default story

```text
Current status → recent trend → exceptions → filters → drilldown
```

### Typical sections

1. Current status KPIs
2. Recent trend
3. Exception list
4. Operational filters
5. Detail table

### Good components

- `<BigValue>`
- `<Sparkline>`
- `<LineChart>`
- `<BarChart>`
- `<DataTable>`
- input components

### Design guidance

Monitoring dashboards benefit from stable layout and predictable filters. Do not over-storytell if the user needs repeatable operational scanning.

---

## 5. Deep-dive analysis

### Use when

The user wants to understand a question in depth, not just monitor metrics.

### Default story

```text
Question → finding 1 → evidence → finding 2 → evidence → interpretation → caveats
```

### Typical sections

1. Research question
2. Key finding summary
3. Evidence section per finding
4. Alternative explanations
5. Caveats and next analyses

### Good components

- `<Value>` in narrative
- `<LineChart>`
- `<BarChart>`
- `<Histogram>`
- `<ScatterPlot>`
- `<DataTable>` for appendix/drilldown

---

## 6. Entity detail page

### Use when

A templated page should exist for each customer, product, zone, region, account, campaign, or other entity.

### Default story

```text
Entity overview → trend → peer comparison → important events/details → related records
```

### Typical sections

1. Entity title and status
2. Entity KPIs
3. Trend over time
4. Comparison to peers / average / segment
5. Drilldown table of related rows

### Good components

- `<BigValue>`
- `<LineChart>`
- `<BarChart>`
- `<DataTable>`
- templated pages using route params

---

## 7. Data quality / audit report

### Use when

The goal is to understand data completeness, quality, anomalies, or readiness.

### Default story

```text
Data coverage → missingness → anomalies → affected fields/entities → recommended fixes
```

### Typical sections

1. Data coverage KPIs
2. Missingness by field
3. Time coverage
4. Outlier/anomaly checks
5. Affected rows/entities

### Good components

- `<BigValue>`
- `<BarChart>`
- `<LineChart>`
- `<Histogram>`
- `<DataTable>`

---

## Archetype selection checklist

Ask:

- Is the user trying to monitor, diagnose, decide, explore, or act?
- Is the report for executives, analysts, operators, or customers?
- Should it be fast to scan or deep to read?
- Will the dashboard be reused or is it a one-time analysis?
- Does the user need a polished report page, a draft analysis, or both?

When unsure, default to **deep-dive analysis** for open-ended questions and **executive dashboard** for stakeholder-facing reports.
