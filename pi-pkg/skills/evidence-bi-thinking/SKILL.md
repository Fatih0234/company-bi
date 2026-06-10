---
name: evidence-bi-thinking
description: Use before building or revising an Evidence dashboard/report when deciding the analytical angle, insight candidates, chart ideas, report archetype, narrative arc, filters, drilldowns, and visual hierarchy. This skill is for BI judgment and data storytelling, not Evidence syntax details.
---

# Evidence BI Thinking

Use this skill when an Evidence report needs to feel more useful, analytical, polished, and insight-driven.

This skill answers:

- What is worth showing?
- Which analytical moves should we test?
- What should become a KPI, chart, filter, table, caveat, or drilldown?
- What story should the dashboard tell?
- How do we avoid a generic wall of charts or tables?

This skill does **not** replace the `evidence` skill. After the insight plan is clear, use the `evidence` skill and Evidence docs to verify exact component syntax and props.

---

## Core rule

Do not write Evidence components first.

First produce an **Insight Candidate Scan** and a **Report Design Plan**.

The goal is to make the agent think like a BI analyst before it thinks like an Evidence developer.

---

## When to use

Use this skill when:

- building a new Evidence dashboard or report;
- improving a dashboard that feels bland, shallow, or table-heavy;
- deciding which charts, KPIs, filters, and sections should exist;
- turning draft analysis into a polished report;
- revising a report structure, not just fixing syntax;
- the user asks for a “nice dashboard,” “better report,” “more useful charts,” “story,” “insights,” or “what should we show?”

Do not use this skill for tiny syntax fixes, formatting-only changes, or isolated component prop lookups.

---

## Required output: Insight Candidate Scan

Before writing or revising a report plan, generate candidate analytical moves.

Use this format:

```markdown
## Insight Candidate Scan

| Candidate | Analytical move | Business question | Query shape | Likely Evidence component | Why it matters | Decision |
|---|---|---|---|---|---|---|
| ... | top-N / trend / outlier / distribution / benchmark / etc. | ... | ... | ... | ... | keep / explore / drop |
```

Decision labels:

- `keep` — likely belongs in the polished report;
- `explore` — test in draft first;
- `drop` — possible but not decision-relevant enough.

### Discarded candidates

After the scan, add a section documenting what was considered and dropped:

```markdown
## Discarded Candidates

| Candidate | Why dropped |
|---|---|
| [name] | [reason — not decision-relevant, data insufficient, too noisy, etc.] |
```

If no candidates were dropped, state: "All candidates were kept — the dataset is focused enough that every analytical angle is decision-relevant."

This creates an analytical audit trail. If a stakeholder asks "why didn't you look at X?", the answer is documented.

---

## Required output: Report Design Plan

After the candidate scan, write a concise report plan.

```markdown
## Report Design Plan

### Report archetype
Executive dashboard / diagnostic report / opportunity report / monitoring dashboard / deep dive / entity detail page / other

### Primary question
[One sentence]

### Headline answer to seek
[What the report should help the reader understand or decide]

### Story arc
1. [Top-level answer or KPI]
2. [Main trend or status]
3. [Driver, segment, or comparison]
4. [Deeper analytical move: concentration / outlier / distribution / benchmark / cohort / funnel / etc.]
5. [Drilldown, caveat, or next action]

### Proposed Evidence sections
| Section | Question | Analytical move | Component | Query shape | Why this section exists |
|---|---|---|---|---|---|

### Candidate filters
- [Filter]: [what it controls and why it helps]

### Caveats and assumptions
- [Known caveat]
- [Metric assumption]
```

---

## Analytical move library

Use the move library to generate better chart/report ideas.

Read `references/analysis-moves.md` when the report needs deeper thinking.

Default moves to consider:

| Move | Use when | Evidence components |
|---|---|---|
| Top-N | entity dimension + value metric | BarChart, DataTable |
| Top-percent / top decile | many entities + skewed value | BigValue, BarChart, LineChart |
| Pareto / cumulative share | long-tail distribution | BarChart, LineChart |
| Trend | time field exists | LineChart, AreaChart |
| Change driver | comparing periods | BigValue, BarChart, DataTable |
| Segment comparison | meaningful category dimension | BarChart, LineChart, Dropdown |
| Distribution check | averages may hide spread | Histogram, BoxPlot, BigValue |
| Outlier detection | entity-level metrics vary widely | ScatterPlot, BubbleChart, DataTable |
| Benchmark | compare to median/average/target | BarChart, BigValue, reference annotations |
| Funnel | ordered stages/statuses exist | FunnelChart |
| Cohort | start period / cohort field exists | LineChart, Heatmap |
| Seasonality | time has hour/day/week/month patterns | Heatmap, LineChart |
| Mix shift | composition changes over time | AreaChart, stacked BarChart |
| Risk/opportunity quadrant | two measures create action matrix | ScatterPlot, BubbleChart |
| Drilldown | user needs details after summary | DataTable |

---

## Chart idea checklist

For each dataset, ask:

- What is the main measure?
- What are the most meaningful dimensions?
- Is there a time field?
- Are there entities such as customers, products, zones, reps, accounts, users, vendors, or campaigns?
- Are there stages, statuses, categories, or funnels?
- Can we compare current vs previous period?
- Can we compare against average, median, target, or peer group?
- Is the total concentrated in a small number of entities?
- Would top 10, top 10%, or top-decile contribution reveal something?
- Is the average misleading because the distribution is skewed?
- Are there outliers worth calling out?
- Are there segments that behave differently from the overall trend?
- Would a filter help the reader make a decision, or is it decorative?
- What drilldown table is actually useful after the charts?

---

## Evidence component mapping

Use Evidence-native components by default.

Detailed mapping is in `references/evidence-component-mapping.md`.

Quick mapping:

| Need | Component |
|---|---|
| top KPI | `<BigValue>` |
| inline metric in prose | `<Value>` |
| category comparison | `<BarChart>` |
| trend over time | `<LineChart>` |
| stacked or volume trend | `<AreaChart>` |
| distribution | `<Histogram>` or `<BoxPlot>` |
| relationship/correlation | `<ScatterPlot>` |
| three-variable relationship | `<BubbleChart>` |
| two-dimensional pattern | `<Heatmap>` |
| conversion/dropoff | `<FunnelChart>` |
| flow | `<SankeyDiagram>` |
| compact trend indicator | `<Sparkline>` |
| detailed drilldown | `<DataTable>` |
| unsupported advanced chart | `<ECharts>` only after built-ins are insufficient |

---

## Visual hierarchy rules

A strong Evidence report should usually:

1. Start with the business question or dashboard goal.
2. Show 2–4 top KPIs with context.
3. Put the most decision-relevant chart early.
4. Use one main chart per section.
5. Add one short interpretation sentence per major chart.
6. Put filters near the sections they affect.
7. Use tables after visual summaries, not before.
8. Add caveats near the affected chart or metric.
9. Keep the top of the page useful at a glance.
10. End with implications, drilldown, or next actions when appropriate.

---

## Good chart title rule

Prefer insight titles over descriptive titles.

Weak:

```text
Revenue by Month
```

Better:

```text
Revenue peaked in March before flattening in Q2
```

Weak:

```text
Top Zones
```

Better:

```text
The top 10 zones account for most pickup revenue
```

If the claim is not yet verified, use a neutral exploratory title until the query confirms it.

---

## Anti-pattern guardrail

Read `references/dashboard-anti-patterns.md` when reviewing or improving a bland dashboard.

Common anti-patterns to avoid:

- KPI row with no comparison or context;
- top-N chart without share-of-total context;
- averages without distribution checks;
- wall of DataTables;
- filters that do not change the reader's decision;
- charts selected because they are easy, not because they answer a question;
- narrative that describes the chart but does not interpret it;
- too many sections with equal visual weight;
- unsupported metric assumptions hidden from the reader.

---

## Handoff to Evidence implementation

After the insight plan is complete:

1. Use `evidence-dashboard` for workspace/page workflow.
2. Use `evidence` for exact Evidence component syntax and documentation lookup.
3. Test SQL before writing to the report page.
4. Use `evidence-dashboard-review` after implementation to critique insight quality, visual quality, and runtime quality.

Do not guess Evidence props from this skill. This skill is for thinking, not syntax authority.
