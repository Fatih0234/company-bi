# Company BI — LUMEN

> A local-first BI development environment where an AI agent builds
> Evidence dashboards inside a three-pane workspace. Ask questions in
> natural language, explore data with DuckDB, and see live dashboard
> results — all in one workspace.

## What is this?

Company BI combines three tools into a single workspace:

- **Evidence** renders dashboards from Markdown + SQL
- **Pi** is a coding agent that edits pages, writes queries, and inspects the browser preview
- **CMUX** provides the three-pane workspace: Pi agent | browser preview | dev server

You describe what you want to analyze. The agent explores your data,
builds charts and KPIs, and you see the results live. When the dashboard
is ready, you publish it.

The data behind the project is a slice of NYC TLC taxi trip data (yellow
+ green), with a zones lookup, synced from a local MinIO bucket via DuckDB.

## How it works

### The workspace

When you create an analysis, you get a clean content workspace:

```text
pages/index.md      ← workspace brief and goal
pages/draft.md      ← private exploration sandbox
pages/report.md     ← polished dashboard (published)
queries/             ← reusable analysis SQL
data/                ← local input files
reports/             ← published report output
```

The Evidence app, node_modules, extensions, and runtime code live in a
separate hidden directory. You never see or edit them.

### The workflow

```text
1. Create    → cmux-evidence new "Revenue by Zone"
2. Explore   → agent queries data, you see charts in the browser
3. Refine    → agent builds draft, you give feedback
4. Publish   → cmux-evidence publish (report + queries → review branch)
```

### The three-pane workspace

```text
┌─────────────┬──────────────────────┐
│ Pi Agent    │ Evidence Preview     │
│ (terminal)  │ (browser)            │
│             ├──────────────────────┤
│             │ Evidence Dev Server  │
│             │ (terminal/logs)      │
└─────────────┴──────────────────────┘
```

The agent can see the browser preview and validate rendering before
telling you the dashboard is ready.

## What makes this different

### Insight-first methodology

Before writing any chart, the agent generates an Insight Candidate Scan
— a structured list of analytical moves (trend, distribution, outlier,
benchmark, funnel, cohort) with business questions, query shapes, and
decisions on what to keep, explore, or drop. Then it writes a Report
Design Plan. Charts come last.

### Quality guards that prevent silent failures

Evidence dashboards fail silently more often than they crash. The build
succeeds, exit code is 0, but charts render empty because SQL returned
no data. The quality guard extension catches this:

- **Query validation** — SQL must be tested via DuckDB before page writes
- **Empty dataset detection** — queries must return rows
- **Static analysis** — catches Svelte/HTML rendering issues (dangerous `<` in text, invalid HTML entities, component prop mismatches)
- **Rendering guard** — detects Vite error overlays and broken builds before taking screenshots

### Content-only workspaces

Each analysis is a clean content directory. No Git branch, no full
project checkout. The user edits pages and queries. The runtime is
generated and disposable. Publishing materializes only the report and
queries — drafts, local data, and scratch files stay private.

### Agent-visible preview

The agent can inspect the Evidence browser preview: take snapshots,
detect rendering errors, validate chart appearance. This closes the loop
between "I wrote a chart" and "the chart looks right."

## Commands

### Create and open

```bash
./bin/cmux-evidence new "Analysis Title"    # create workspace + open in CMUX
./bin/cmux-evidence open <slug>             # reopen an existing workspace
./bin/cmux-evidence list                    # list all workspaces
```

### Inside a workspace

```bash
./bin/cmux-evidence validate                # check build health
./bin/cmux-evidence diff                    # content diff
./bin/cmux-evidence publish                 # publish report for review
```

### Browser preview (inside CMUX)

```bash
./bin/cmux-evidence preview-url             # get preview URL
./bin/cmux-evidence preview-screenshot <surface-ref> /tmp/preview.png
```

## Project structure

```text
bin/
  cmux-evidence              CLI — workspace lifecycle (new/open/validate/publish)
  pi-full                    Pi agent launcher (local + global resources)
  lumen-pi                   Pi launcher (isolated, no global resources)

pi-pkg/                      Pi package — extensions, skills, prompts, themes
  extensions/                7 Evidence-aware extensions
  skills/                    15 specialized workflow skills
  prompts/                   Prompt templates
  themes/                    LUMEN midnight theme

sources/                     Evidence source SQL (tlc.trips, tlc.zones)
pages/                       Evidence dashboard pages
scripts/                     Data pipeline and dev helpers

evidence-slides-integration-pack/   Slide generation from BI reports
```

## Extensions

| Extension | What it does |
|-----------|-------------|
| `evidence-context` | Injects workspace state, source catalog, and CMUX anchors into each agent turn |
| `analysis-intention` | Iterative interview to capture the analysis goal, questions, and success criteria |
| `duckdb-bi` | DuckDB tools for safe, audited data exploration |
| `evidence-quality-guard` | Multi-layer validation to prevent silent dashboard failures |
| `evidence-health-check` | Dev server health checker — catches build errors before screenshots |
| `lumen-bi` | LUMEN branded TUI header |
| `pi-ask-user` | Interactive Q&A primitive for high-stakes decisions |

## Skills

| Skill | When to use |
|-------|-------------|
| `evidence-dashboard` | Building or revising an Evidence dashboard (6-phase workflow) |
| `evidence-bi-thinking` | Deciding what charts to build, generating insight candidates |
| `evidence-dashboard-review` | Reviewing and critiquing a dashboard |
| `evidence-slides` | Turning a report into a presentation deck |
| `data-discovery` | Profiling and exploring data sources |
| `ask-user` | Decision gate for high-stakes choices |
| `evidence` | Evidence component patterns and syntax reference |
| `cmux-workspace` | CMUX workspace automation (panes, surfaces, sidebar) |
| `cmux-browser` | Browser automation (snapshot, click, fill, wait) |
| `cmux-settings` | CMUX configuration management |
| `cmux-customization` | Actions, commands, layouts, tab bars, Dock |
| `cmux-keyboard-shortcuts` | Shortcut bindings and templates |
| `cmux-markdown` | Markdown viewer panels with live reload |
| `cmux-pi` | Pi + CMUX integration (session restore, notifications) |
| `cmux-diagnostics` | Health checks for CLI, socket, hooks, settings |

## Prerequisites

- Node.js and npm
- CMUX CLI (`cmux`)
- Pi Coding Agent (`pi`)
- Git
- Optional: GitHub CLI (`gh`) for PR creation

## Install

```bash
npm install
```

## Run the root Evidence app

```bash
npm run dev
```

Opens at <http://localhost:3000>.

## Local generated state

These are local-only and ignored by Git:

```text
.cmux/registry.json
.cmux/workspace.json
.evidence/
build/
node_modules/
```
