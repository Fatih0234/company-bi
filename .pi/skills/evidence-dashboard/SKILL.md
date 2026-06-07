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

## Workspace model

One analysis usually maps to:

- one Git branch
- one Git worktree
- one Evidence page
- one Evidence dev server port
- one CMUX workspace
- one browser preview pane
- one Pi agent pane

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
- `evidence-data-semantics` — use when defining metrics, interpreting source SQL, choosing measures/dimensions, or making data assumptions.
- `cmux-workspace` — use for caller workspace/pane/surface targeting and non-disruptive CMUX automation.
- `cmux-browser` — use for browser preview inspection, snapshots, screenshots, and visible Evidence error checks.
- `cmux-diagnostics` — use only when CMUX/socket/browser/dev-server behavior appears broken.

## Dashboard build/revision workflow

For dashboard creation or revision:

1. Understand the user's business question and map it to the workspace intention.
2. Inspect the current Evidence page.
3. Inspect available sources/queries/schema notes when needed; use `evidence-data-semantics` for metric-heavy work.
4. Propose a short plan before broad edits.
5. Make small changes.
6. Prefer the active analysis page as the first edit target.
7. Preserve and update the visible `Workspace Brief` / build checklist on generated analysis pages when the user's goal, scope, or completion state changes.
8. Use Evidence components idiomatically.
9. Check the rendered preview in CMUX when possible.
10. Fix visible errors before reporting completion.
11. Summarize changed files, assumptions, and next questions.

A strong first dashboard usually includes:

- concise title and goal narrative
- KPI row for the most important measures
- one trend over time when time fields exist
- one breakdown by meaningful dimension
- a sorted detail table
- simple filters only when they help answer the question
- visible assumptions for inferred or ambiguous metrics

## CMUX preview inspection

When the user asks whether the dashboard looks correct, or after substantial edits:

1. Find the active preview URL from the injected dynamic context, `.cmux/workspace.json`, or `./bin/cmux-evidence preview-url`.
2. Use CMUX browser automation if a browser surface is available.
3. Snapshot or evaluate the page.
4. Look for Evidence build/runtime errors, blank sections, missing data, or obvious layout issues.
5. Report what was visually confirmed and what still requires human judgment.

Use the project helpers first:

```bash
./bin/cmux-evidence preview-url
./bin/cmux-evidence preview-open
./bin/cmux-evidence browser-surfaces
./bin/cmux-evidence preview-title <surface-ref>
./bin/cmux-evidence preview-snapshot <surface-ref>
./bin/cmux-evidence preview-screenshot <surface-ref> /tmp/evidence-preview.png
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
./bin/cmux-evidence preview-url
./bin/cmux-evidence browser-surfaces
./bin/cmux-evidence preview-snapshot <surface-ref>
./bin/cmux-evidence validate
./bin/cmux-evidence diff
```

If those commands do not exist yet, use the closest project scripts and explain the gap.

## Communication style

- Be concise.
- Prefer concrete dashboard changes over abstract advice.
- State assumptions about metrics, dimensions, and filters.
- Ask before changing shared data sources or dependencies.
- Use CMUX notifications for long-running or blocked work when available.
