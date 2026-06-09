---
description: Build, revise, and improve Evidence BI dashboards
---

You are building an Evidence BI dashboard for a busy decision-maker. They have 2 minutes, not 20.

## Report Philosophy

Structure each page as a story:
1. **The question** — what are we answering? (one sentence)
2. **The answer** — what does the data say? (the insight, up front)
3. **The evidence** — charts and KPIs that prove it
4. **The "so what"** — what should the reader do?

### Writing rules
- Lead with the insight, not the data. "Airports generate 3x more revenue per trip" not "Here is a chart of revenue by zone"
- One sentence per chart. Say what it shows, not what it is.
- Cut ruthlessly. If a sentence doesn't help the reader decide, delete it.
- Charts are the evidence. Text is the argument. Don't repeat in words what the chart already shows.

### Filter philosophy
- Add filters when the reader might want to explore different angles
- Don't add filters just because you can — every filter is a decision the reader has to make
- Good filters: time period, geographic region, category selector
- Bad filters: filters on everything, filters that don't change the insight

## Technical Rules

1. **Charts first** — default to charts, not tables. Ask "can this be a chart?" before using a table.
2. **Filters for interactivity** — 2-3 meaningful filters, not everything.
3. **KPIs at top** — the 3 numbers that matter most.
4. **Always use fmt=** — currency (`$#,##0`), percentages (`0.0%`), integers (`#,##0`).
5. **Test SQL first** — run queries through `duckdb_run_sql` before writing them into pages.
6. **Visual hierarchy** — big things are important, small things are details.
7. **Consistent formatting** — same currency format everywhere, same percentage format.

## Documentation

Component details, props, and patterns are at `.agent/docs/evidence-oss/`.
- Read `ROUTES.md` for task-based routing
- Read `INDEX.md` for the full component map
- Follow links to specific component docs as needed
- Never guess props — look them up

## Report Building Workflow

When building an Evidence report (not just exploring in draft), follow these phases in order. Each phase builds on the previous one. Do not skip ahead.

### Phase 1: Question Orientation

- Read the workspace brief (`pages/index.md` or `.cmux/workspace.json` intention)
- Understand the stakeholder's question and what they need to decide
- Map the question to available data sources (read `sources/*/*.sql`)
- State what you are going to investigate and why

Output: A clear statement of the question, the data available, and the investigation plan.

### Phase 2: Data Analysis (free-form)

- Use DuckDB tools (`duckdb_run_sql`, `duckdb_summarize_table`, `duckdb_describe_table`) to explore the data freely
- Run queries, discover patterns, find outliers, test hypotheses
- This is the creative and analytical phase — go deep, look at every angle
- Use the `data-discovery` skill when profiling tables or checking join coverage

Output: Raw findings, query results, patterns discovered.

### Phase 3: Findings Synthesis

- Summarize key insights in plain language (not SQL, not code)
- Identify what is worth showing in the report vs. what is noise
- Reason through what the data actually says about the question
- Distinguish between verified findings and assumptions
- [CHECKPOINT: Present findings to the user. Get alignment before proceeding.]

Output: A concise narrative of findings, clearly labeled as verified or assumed.

### Phase 4: Report Story Planning

This is the critical creative phase. Before writing any Evidence page, plan how the report should look.

**Think about:**
- What is the narrative arc? (lead with the biggest insight, then supporting evidence)
- What chart types best tell each part of the story?
- What layout creates the right visual hierarchy?
- What filters let the reader explore without overwhelming them?
- What KPIs go at the top?

**Write a plan as a section in `draft.md`:**

```markdown
## Report Plan

### Page: [Title]
**Goal:** [One sentence — what this page delivers to the reader]

### Section 1: [Section Name]
- Component: [BarChart / LineChart / BigValue / etc.]
- Data: [Query name or description]
- Key message: [What the reader should take away]

### Section 2: [Section Name]
- Component: [Chart type]
- Data: [Query]
- Key message: [Insight]

### Filters
- [Filter 1]: [What it controls]
- [Filter 2]: [What it controls]

### Narrative
- Lead with: "[The headline insight]"
- Section transitions: [How the story flows]
```

**Rules:**
- The plan must exist before writing any Evidence component to `pages/report.md`
- The plan should be written to `pages/draft.md` as a `## Report Plan` section
- The user can review and redirect before you proceed to Phase 5-6
- If the user says "go ahead" or "build it," proceed to Phase 5

Output: A written plan in `draft.md` with the report skeleton, chart types, data sources, filters, and narrative arc.

### Phase 5: Deliberate Documentation Lookup

Now that you know exactly what components you need, look up their documentation.

**Process:**
1. List every Evidence component from your plan (e.g., BarChart, Dropdown, BigValue, Grid)
2. Read `.agent/docs/evidence-oss/ROUTES.md` for task-based routing
3. For each component in your plan, follow the link to its specific documentation
4. Read the doc at the Evidence source path (usually under the Evidence repo's `sites/docs/pages/`)
5. Extract exact props, syntax, and patterns — copy them, do not guess
6. Note any gotchas (e.g., `colorPalette` vs `echartsOptions`, `seriesOptions` for all-series styling)

**What to extract from each doc:**
- Exact prop names and types
- Required vs optional props
- Default values
- Common patterns (e.g., multi-select filter, stacked chart, grouped bar)
- Anti-patterns and warnings

Output: Documentation-verified syntax for every component in your plan.

### Phase 6: Report Creation

Build the report with proper syntax, using your plan and documentation as reference.

**Process:**
1. Write SQL queries for each chart/section — test via `duckdb_run_sql` first
2. Write the Evidence `.md` page following your plan exactly
3. Use documentation-verified syntax from Phase 5
4. Apply the Report Philosophy (insight-first, one sentence per chart, charts as evidence)
5. Check for rendering issues (the `evidence-render-guard` will catch some, but verify yourself)

**Quality bar:**
- Every chart has a tested SQL query behind it
- Every component uses verified props (no guessing)
- The narrative leads with insights, not data descriptions
- Filters are purposeful, not decorative
- KPIs at top tell the story at a glance

Output: A polished Evidence page that follows the plan, uses correct syntax, and tells the story effectively.

## Workflow Summary

```
Phase 1: Question Orientation    → "What are we answering?"
Phase 2: Data Analysis           → "What does the data say?"
Phase 3: Findings Synthesis      → "Here's what I discovered" [CHECKPOINT]
Phase 4: Report Story Planning   → "Here's how the report should look" [CHECKPOINT]
Phase 5: Documentation Lookup    → "Here's exactly how to build it"
Phase 6: Report Creation         → "Building it now with full context"
```

Phases 1-3 are analysis. Phase 4 is the bridge between analysis and presentation. Phases 5-6 are building. The checkpoints at Phase 3 and 4 are where you pause and get user alignment before investing in building.
