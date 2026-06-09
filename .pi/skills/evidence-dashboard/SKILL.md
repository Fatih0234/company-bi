---
name: evidence-dashboard
description: Build, revise, inspect, validate, and prepare Evidence dashboards inside a CMUX workspace with a Pi agent, browser preview, and dev server pane. Use when the user asks about Evidence pages, dashboard layout, SQL queries, charts, tables, CMUX preview inspection, analysis workspaces, validation, or publishing.
---

# Evidence Dashboard Skill

Use this skill when working in the company-bi Evidence dashboard workspace.

## First steps

1. Treat the dynamic Evidence context injected by `.pi/extensions/evidence-context.ts` as the default workspace/data context for the current turn.
2. Read `.cmux/workspace.json` if you need durable analysis metadata.
3. Read `.cmux/evidence.json` if you need project commands, preview URL, ports, or edit policy.
4. Use `/evidence-context` when you need to debug or display the generated context.
5. Read `.cmux/pi-context.md` only as a legacy/fallback snapshot if needed.
6. Identify the primary Evidence page from metadata.
7. Inspect relevant files before editing.

## Data Access

- **Page queries** (SQL blocks in `pages/*.md`) MUST use source names: `from trips`, `from zones`
- **Never** use `read_parquet()`, `read_csv()`, or file paths in page queries
- **Source names** are defined in `sources/*/*.sql` — the filename without `.sql` is the table name
- Source details and available columns are in the Dynamic Evidence Context (injected each turn)
- **DuckDB BI tools** (`duckdb_run_sql`) auto-resolve source names too — use them for consistency
- When moving a query from `duckdb_run_sql` to a page, replace file references with source names

## Workspace model

Always read `.cmux/workspace.json` and prefer its `workspaceMode`, `workspaceRoot`, `runtimeRoot`, `shadowRuntimeRoot`, `page`, and `pages` fields over hard-coded path conventions.

The default modern model is **content-only**:

- `workspaceRoot` is the user/agent editing surface.
- `shadowRuntimeRoot` is a generated Evidence app used by the dev server; do not edit it directly.
- `runtimeRoot` owns source connectors, scripts, package files, Pi extensions, and dependencies; treat it as runtime-managed unless the user explicitly asks for app/source changes.
- The content workspace usually contains `pages/index.md`, `pages/draft.md`, `pages/report.md`, plus `queries/`, `reports/`, and `data/`.
- There may be no Git branch or Git worktree for the content workspace.

Legacy analyses may still use the older Git-worktree model:

- one Git branch
- one Git worktree
- one Evidence directory under `pages/analysis/<slug>/`

### Workspace page convention

For content-only workspaces, use the page paths from `.cmux/workspace.json`, usually:

- **Brief page** (`pages/index.md`) — The landing page. Contains the workspace intention, goal, and a `Workspace Pages` map. Always keep this up to date.
- **Draft page** (`pages/draft.md`) — The sandbox. Put messy queries, experiments, and work-in-progress here. No quality standards.
- **Report page** (`pages/report.md`) — The polished dashboard. Move validated findings here. Must be clean, readable, and production-quality.
- **Analysis SQL** (`queries/*.sql`) — Reusable analysis-owned SQL files for this workspace. Use these when SQL should be preserved, reused, reviewed, or eventually published with the analysis.
- **Focused deep-dives** (`pages/[topic].md` or another path recorded in metadata) — Optional focused pages for specific angles.

For legacy Git-worktree analyses, the same logical pages may live under `pages/analysis/<slug>/`.

**Rules:**
- When exploring a new idea or testing a query, work in the **Draft** page from metadata.
- When a finding is validated and ready for the user, move it to the **Report** page from metadata.
- Update the Brief page's `Workspace Pages` table when you create new pages.
- Create new pages in the content workspace unless metadata indicates a legacy analysis directory.

## Default edit policy

Allowed by default:

- `pages/**`
- `queries/**`

Ask before editing:

- `components/**`
- `sources/**`
- `package.json`
- `package-lock.json`

Do not edit:

- `.env*`
- `**/connection.yaml`
- `.github/**`

If the workspace context defines a stricter policy, follow the stricter policy.

## Related skills

Use specialized skills when the task shifts modes:

- `evidence-dashboard-review` — use for critique, QA, visual review, product feedback, and "what should improve?" requests. Default to read-only review unless the user asks for edits.
- `evidence-bi-thinking` — use before Phase 4 Report Story Planning when deciding what is worth showing, generating insight candidates, choosing report archetypes, designing narrative arc, and selecting analytical moves such as top-N, top-percent, trend, distribution, outlier, benchmark, funnel, cohort, seasonality, and risk/opportunity views.
- `evidence-data-semantics` — use when defining metrics, interpreting source SQL, choosing measures/dimensions, or making data assumptions.
- `cmux-workspace` — use for caller workspace/pane/surface targeting and non-disruptive CMUX automation.
- `cmux-browser` — use for browser preview inspection, snapshots, screenshots, and visible Evidence error checks.
- `cmux-diagnostics` — use only when CMUX/socket/browser/dev-server behavior appears broken.

## Report Building Workflow

When building an Evidence report (not just exploring in draft), follow these phases in order. Each phase builds on the previous. Do not skip ahead.

### Phase 1: Question Orientation

- Read the workspace brief (`pages/index.md` or `.cmux/workspace.json` intention)
- Understand the stakeholder's question and what they need to decide
- Map the question to available data sources (read `sources/*/*.sql`)
- Use the `data-discovery` skill when profiling tables or checking join coverage
- State what you are going to investigate and why

**Output:** A clear statement of the question, the data available, and the investigation plan.

### Phase 2: Data Analysis (free-form)

- Use DuckDB tools (`duckdb_run_sql`, `duckdb_summarize_table`, `duckdb_describe_table`) to explore the data freely
- Run queries, discover patterns, find outliers, test hypotheses
- This is the creative and analytical phase — go deep, look at every angle
- Work in the **Draft** page for experiments and rough queries
- Test every SQL query through `duckdb_run_sql` before writing it into an Evidence page
- Use Evidence source references (e.g., `FROM tlc.trips`) — the tool resolves them automatically

**Output:** Raw findings, query results, patterns discovered.

### Phase 3: Findings Synthesis

- Summarize key insights in plain language (not SQL, not code)
- Identify what is worth showing in the report vs. what is noise
- Reason through what the data actually says about the question
- Distinguish between verified findings and assumptions
- **[CHECKPOINT: Present findings to the user. Get alignment before proceeding to planning.]**

**Output:** A concise narrative of findings, clearly labeled as verified or assumed.

### Phase 4: Report Story Planning

This is the critical creative phase. Before writing any Evidence page, plan how the report should look.

### Required pre-step: Insight Candidate Scan

Before writing the Report Plan, use `evidence-bi-thinking` to generate an **Insight Candidate Scan**.

Do not merely map existing queries to charts. First ask what would be useful, surprising, decision-relevant, or visually revealing.

Consider analytical moves such as:

- top-N ranking
- top 10% / top-decile contribution
- Pareto / cumulative share
- period-over-period change
- change drivers
- distribution checks
- outlier detection
- segment comparison
- benchmark vs average, median, target, or peer group
- funnel drop-off
- cohort comparison
- seasonality heatmap
- mix shift
- risk/opportunity quadrant
- scoped drilldown table

Write this section in `pages/draft.md` before the Report Plan:

```text
## Insight Candidate Scan

| Candidate | Analytical move | Business question | Query shape | Likely Evidence component | Why it matters | Decision |
|---|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... | keep / explore / drop |
```

Use the scan to decide what belongs in the polished report, what should be explored in draft, and what should be dropped as noise.

**Think about:**
- What is the narrative arc? (lead with the biggest insight, then supporting evidence)
- What chart types best tell each part of the story?
- What layout creates the right visual hierarchy?
- What filters let the reader explore without overwhelming them?
- What KPIs go at the top?

**Charts-first check:** For every data point you plan to show, ask: "Can this be a chart?" If yes, plan a chart. Only use tables for detailed lookup data.

**Write a plan as a section in `draft.md`:**

```
## Report Plan

### Report archetype
Executive dashboard / diagnostic report / opportunity report / monitoring dashboard / deep dive / entity detail page / other

### Primary question
[One sentence — what this report answers]

### Headline answer to seek
[The answer or decision the report should make easier]

### Story arc
1. [Top-level KPI or headline]
2. [Main trend or status]
3. [Driver, segment, or comparison]
4. [Deeper analytical move: concentration / outlier / distribution / benchmark / cohort / funnel / etc.]
5. [Drilldown, caveat, or next action]

### Page: [Title]
**Goal:** [One sentence — what this page delivers to the reader]

### Section 1: [Section Name]
- Component: [BarChart / LineChart / BigValue / etc.]
- Data: [Query name or description]
- Key message: [What the reader should take away]
- Analytical move: [top-N / trend / distribution / benchmark / outlier / etc.]
- Why this section exists: [What decision or understanding it supports]

### Section 2: [Section Name]
- Component: [Chart type]
- Data: [Query]
- Key message: [Insight]
- Analytical move: [top-N / trend / distribution / benchmark / outlier / etc.]
- Why this section exists: [What decision or understanding it supports]

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
- A Report Plan must be based on the Insight Candidate Scan, not just available queries.
- Every planned chart must answer a named question.
- At least one planned section should use a deeper analytical move when the data supports it: concentration, distribution, outlier, benchmark, change driver, cohort, funnel, seasonality, or risk/opportunity analysis.
- Top-N charts should include context such as share of total, change, benchmark, or drilldown when possible.
- Tables should appear after summary charts unless the user explicitly wants table-first analysis.

**Output:** A written plan in `draft.md` with the report skeleton, chart types, data sources, filters, and narrative arc.

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

**Output:** Documentation-verified syntax for every component in your plan.

### Phase 6: Report Creation

Build the report with proper syntax, using your plan and documentation as reference.

**Process:**
1. Write SQL queries for each chart/section — test via `duckdb_run_sql` first
2. Write the Evidence `.md` page following your plan exactly
3. Use documentation-verified syntax from Phase 5
4. Apply the Report Philosophy (insight-first, one sentence per chart, charts as evidence)
5. Make small, focused changes — one section at a time
6. Check the rendered preview in CMUX when possible
7. Fix visible errors before reporting completion

*Quality bar:**
- Every chart has a tested SQL query behind it
- Every component uses verified props (no guessing)
- The narrative leads with insights, not data descriptions
- Filters are purposeful, not decorative
- KPIs at top tell the story at a glance
- Every major chart has a clear reason to exist: question, chart, interpretation, implication.
- The report includes at least one non-obvious analytical angle when supported by the data.
- The page avoids generic chart dumps and table walls.
- Top-level KPIs are contextualized with comparison, share, benchmark, or interpretation where possible.

**Output:** A polished Evidence page that follows the plan, uses correct syntax, and tells the story effectively.

### Workflow summary

```
Phase 1: Question Orientation    → "What are we answering?"
Phase 2: Data Analysis           → "What does the data say?"
Phase 3: Findings Synthesis      → "Here's what I discovered" [CHECKPOINT]
Phase 3.5: Insight Candidate Scan → "Here's what could be worth showing"
Phase 4: Report Story Planning   → "Here's how the report should look" [CHECKPOINT]
Phase 5: Documentation Lookup    → "Here's exactly how to build it"
Phase 6: Report Creation         → "Building it now with full context"
```

Phases 1-3 are analysis. Phase 4 is the bridge between analysis and presentation. Phases 5-6 are building. The checkpoints at Phase 3 and 4 are where you pause and get user alignment before investing in building.

### Revision workflow

For revising an existing dashboard (not building from scratch):
1. Read the current report page and any existing plan in draft.md
2. Understand what the user wants changed and why
3. If the change is small (fix a chart, adjust a filter), make the edit directly
4. If the change is substantial (new section, restructured layout), re-run Phase 4-6 for the affected sections
- If the revision is about making the dashboard more useful, more visual, more analytical, or more story-driven, use `evidence-bi-thinking` before editing. Generate a short Insight Candidate Scan for the affected sections, then revise the plan and implementation.
5. Test SQL changes via `duckdb_run_sql` before writing to pages
6. Check the rendered preview
7. Summarize changes

### What a strong first dashboard includes

- concise title and goal narrative
- KPI row (`<BigValue>`) for the 2-3 most important measures
- one trend over time when time fields exist
- one breakdown by meaningful dimension
- a sorted detail table if drill-down is valuable
- simple filters only when they help answer the question
- visible assumptions for inferred or ambiguous metrics

## Charts-First Philosophy

**Default to charts, not tables.** When building Evidence pages, always ask: "Can this data be visualized?" If yes, use a chart. Tables are for detailed lookup data or when the user explicitly wants tabular format.

### Why charts first?
- Charts deliver more information per pixel than tables
- Patterns, outliers, and comparisons are instantly visible
- Executives and stakeholders scan charts faster than rows
- Charts make dashboards feel alive and professional

### Available chart components (use these liberally):

| Component | Best for | Example use case |
|-----------|----------|------------------|
| `<BarChart>` | Categorical comparisons | Revenue by zone, trips by borough |
| `<LineChart>` | Trends over time | Daily revenue trend, hourly demand curve |
| `<AreaChart>` | Volume trends, stacked comparisons | Cumulative revenue, market share over time |
| `<ScatterPlot>` | Correlation, two-variable analysis | Revenue vs distance, fare vs tip |
| `<BubbleChart>` | Three-variable comparison | Zone revenue (x) vs trips (y) vs avg fare (size) |
| `<Heatmap>` | Two-dimensional patterns | Demand by hour x day-of-week |
| `<Histogram>` | Distribution analysis | Fare distribution, trip distance distribution |
| `<FunnelChart>` | Conversion/flow | Trip completion rates |
| `<BigValue>` | KPI highlights | Total revenue, avg fare, active zones |
| `<Sparkline>` | Inline trends | Trend indicators next to summary numbers |
| `<DataTable>` | Detailed lookup | Only when user needs to see individual rows |

### Decision framework:

1. **Comparing categories?** → `<BarChart>` (sorted descending by value)
2. **Showing trend?** → `<LineChart>` or `<AreaChart>`
3. **Showing distribution?** → `<Histogram>` or `<BoxPlot>`
4. **Correlation between two metrics?** → `<ScatterPlot>`
5. **Three variables at once?** → `<BubbleChart>`
6. **Pattern across two dimensions?** → `<Heatmap>`
7. **Highlighting a single number?** → `<BigValue>` with optional `<Sparkline>`
8. **Detailed rows needed?** → `<DataTable>` (last resort, not default)

### SQL block + chart pattern:

Every chart needs a SQL block. Always pair them:

```sql query_name
SELECT dimension, measure
FROM source
GROUP BY 1
ORDER BY 2 DESC
```

<BarChart data={query_name} x=dimension y=measure />

### Rules:
- **Never output a bare table when a chart would work.** If you're showing top 10 zones by revenue, use BarChart, not DataTable.
- **Tables are for:** detailed drill-down, raw data inspection, or when the dataset has many columns that don't fit a chart.
- **Multiple charts per page is encouraged.** A dashboard with 3-5 charts beats a wall of tables.
- **Always include `<BigValue>` KPIs** at the top for the 2-3 most important numbers.
- **Sort charts logically:** descending by value for bar charts, chronological for time series.
- **Use `color=` for grouping** in bar charts when showing sub-categories.
- **Use `yFmt=` for formatting:** `$#,##0` for currency, `#,##0` for integers, `0.0%` for percentages.

## CMUX preview inspection

When the user asks whether the dashboard looks correct, or after substantial edits:

1. Find the active preview URL from the injected dynamic context, `.cmux/workspace.json`, or `<workspace-helper> preview-url`.
2. Use CMUX browser automation if a browser surface is available.
3. Snapshot or evaluate the page.
4. Look for Evidence build/runtime errors, blank sections, missing data, or obvious layout issues.
5. Report what was visually confirmed and what still requires human judgment.

Use the workspace helper shown in dynamic context first. In content-only workspaces this is usually an absolute runtime helper path because `./bin/cmux-evidence` does not exist in the content workspace.

```bash
<workspace-helper> preview-url
<workspace-helper> preview-open
<workspace-helper> browser-surfaces
<workspace-helper> preview-title <surface-ref>
<workspace-helper> preview-snapshot <surface-ref>
<workspace-helper> preview-screenshot <surface-ref> /tmp/evidence-preview.png
```

When no surface ref is supplied, the preview helpers may auto-detect a single matching browser surface. If multiple browser surfaces exist, pass the explicit `surface:N` ref.

Underlying CMUX commands may include:

```bash
cmux list-pane-surfaces --workspace "$CMUX_WORKSPACE_ID" --json
cmux browser <surface> snapshot --interactive
cmux browser <surface> eval "document.title"
cmux browser <surface> screenshot --out /tmp/evidence-preview.png
```

Use exact commands supported by the installed CMUX version.

## Workspace command habits

Use the project-local Pi commands when they help orient the user:

- `/workspace-status` — current workspace/page/preview/Git/CMUX anchors.
- `/workspace-summary` — brief + detected dashboard state + suggested next step.
- `/workspace-list` — interactive registered workspace selector; opening requires explicit Enter.
- `/workspace-cleanup-plan` — read-only cleanup risk review.

## Validation workflow

Before publishing or declaring completion:

```bash
<workspace-helper> preview-url
<workspace-helper> browser-surfaces
<workspace-helper> preview-snapshot <surface-ref>
<workspace-helper> validate
<workspace-helper> diff
```

Use the helper path shown in dynamic context. If no helper is shown, use the closest project scripts and explain the gap.

## Communication style

- Be concise.
- Prefer concrete dashboard changes over abstract advice.
- State assumptions about metrics, dimensions, and filters.
- Ask before changing shared data sources or dependencies.
- Use CMUX notifications for long-running or blocked work when available.
