# Company BI

Company BI is an Evidence dashboard project with a CMUX/Pi workspace workflow for creating reviewable analysis dashboards in isolated Git worktrees.

## What this repo provides

- Evidence app for local BI dashboards
- `cmux-evidence` helper CLI for CMUX workspace launch and analysis lifecycle
- Project-local analysis worktrees under `.workspaces/`
- Per-analysis metadata, Pi context, browser preview helpers, validation, diff, and publish commands
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

This creates a Git worktree and branch:

```text
.workspaces/revenue-quality-by-segment
analysis/revenue-quality-by-segment
```

Each generated workspace gets its own:

- Evidence page in `pages/analysis/<slug>.md`
- `.cmux/workspace.json`
- `.cmux/pi-context.md`
- project-local Evidence dashboard Pi skill
- dedicated dev server port and preview URL

## Common commands

From the root project or an analysis worktree:

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

Inside a generated analysis worktree:

```bash
./bin/cmux-evidence publish
```

Publish is intentionally conservative. It:

1. verifies the directory is an analysis worktree
2. runs validation
3. shows the diff stat
4. requires typing exactly `publish`
5. commits changes
6. pushes the analysis branch
7. opens a GitHub PR when `gh` is available

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
bin/cmux-evidence              # CMUX/Evidence workspace CLI
.cmux/evidence.json            # project workspace configuration
.cmux/cmux.json                # CMUX palette actions
.pi/skills/evidence-dashboard  # project-local Pi skill
.pi/prompts/                   # Pi prompt templates
pages/                         # Evidence pages
sources/                       # Evidence sources
scripts/                       # local data/dev helpers
implementation-docs/           # implementation plan history
```
