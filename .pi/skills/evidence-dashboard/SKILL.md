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
6. Prefer the **Draft** page as the first edit target for exploration. Work in the **Report** page for polished findings.
7. Preserve and update the visible `Workspace Brief` on the **Brief** page when the user's goal, scope, or completion state changes. Update the `Workspace Pages` table when the page structure changes.
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
