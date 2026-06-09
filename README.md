# Company BI

Company BI is an Evidence dashboard project with a CMUX/Pi workspace workflow for creating reviewable analysis dashboards in clean content-only workspaces backed by a hidden Evidence runtime.

## What this repo provides

- Evidence app for local BI dashboards
- `cmux-evidence` helper CLI for CMUX workspace launch and analysis lifecycle
- `pi-full` for full Pi agent runs with CMUX integration
- Clean per-analysis workspaces with `pages/`, `queries/`, `reports/`, and `data/`
- Hidden generated Evidence runtimes for preview/build
- Per-analysis metadata, Pi context, browser preview helpers, validation, content diff, and publish commands
- CMUX Command Palette actions for common Evidence workflows

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

Default local URL:

```text
http://localhost:3000
```

## Open the CMUX workspace

```bash
./bin/cmux-evidence
```

This opens a CMUX workspace with an agent pane, Evidence preview, and dev server pane.

## Create an analysis workspace

```bash
./bin/cmux-evidence new "Revenue Quality by Segment"
```

This creates a clean content workspace and a hidden Evidence runtime:

```text
~/.local/share/lumen-bi/workspaces/company-bi/revenue-quality-by-segment
~/.local/share/lumen-bi/runtime/company-bi/revenue-quality-by-segment
```

Each generated workspace gets its own:

- `pages/index.md` for the brief/workspace map
- `pages/draft.md` for exploration
- `pages/report.md` for the polished publishable report
- `queries/` for reusable analysis SQL
- `reports/` and `data/` for optional local materials
- `.cmux/workspace.json`
- dedicated dev server port and preview URL

After creating a workspace:

1. Explore ideas and rough queries in `pages/draft.md`.
2. Keep reusable SQL in `queries/`.
3. Move validated findings to `pages/report.md`.
4. Use `./bin/cmux-evidence validate` and `./bin/cmux-evidence diff` before publishing.
5. Publish only when the polished report is ready to share.

## Common commands

From the root project or a generated analysis workspace:

```bash
./bin/cmux-evidence list
./bin/cmux-evidence current
./bin/cmux-evidence status
./bin/cmux-evidence preview-url
./bin/cmux-evidence validate
./bin/cmux-evidence diff --stat
```

Browser preview helpers, when running inside CMUX:

```bash
./bin/cmux-evidence preview-open
./bin/cmux-evidence browser-surfaces
./bin/cmux-evidence preview-title [surface-ref]
./bin/cmux-evidence preview-snapshot [surface-ref]
./bin/cmux-evidence preview-screenshot [surface-ref] [path]
```

## Publish an analysis

Inside a generated analysis workspace:

```bash
./bin/cmux-evidence publish
```

Publish is intentionally conservative. In content-only workspaces it:

1. runs validation from the hidden Evidence runtime
2. shows a content diff against the initial or last-published snapshot
3. requires typing exactly `publish`
4. publishes the polished report as `/reports/<slug>/`
5. includes `queries/**`
6. keeps draft notes, local data, DuckDB scratch files, and runtime files private by default
7. prepares a review branch/PR when Git/GitHub are configured

Legacy Git-worktree analyses still use the older commit/push/PR publish flow.

## Local generated state

The following are local-only and ignored by Git:

```text
.workspaces/
.cmux/registry.json
.cmux/workspace.json
.cmux/pr-body.md
.evidence/
build/
node_modules/
```

## Project structure

```text
bin/cmux-evidence                  # CMUX/Evidence workspace CLI
bin/pi-full                        # Full Pi agent runs with CMUX integration

.cmux/evidence.json                # project workspace configuration
.cmux/cmux.json                    # CMUX palette actions

.pi/extensions/evidence-context.ts # Evidence context provider for Pi
.pi/extensions/evidence-health-check.ts  # Evidence build health checker
.pi/extensions/evidence-render-guard.ts  # Render safety guard for Evidence
.pi/extensions/analysis-intention/ # Analysis intention onboarding flow
.pi/extensions/duckdb-bi/          # DuckDB BI tools for data exploration
.pi/extensions/pi-ask-user/        # Interactive user input extension

.pi/skills/evidence/               # Evidence component reference skill
.pi/skills/evidence-bi-thinking/   # BI analysis methodology skill
.pi/skills/evidence-dashboard/     # Evidence dashboard build skill
.pi/skills/evidence-dashboard-review/  # Dashboard review/QA skill
.pi/skills/data-discovery/         # Data source discovery skill
.pi/skills/ask-user/               # Decision handshake skill

.pi/prompts/                       # Pi prompt templates

pages/                             # Evidence pages
sources/                           # Evidence source queries
scripts/                           # local data/dev helpers
implementation-docs/               # implementation plan history

.evidence-bi-skill-refactor-pack/   # skill refactoring artifacts
```
