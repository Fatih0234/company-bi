# Step 14: Evidence Dashboard Pi Skill

References: `10_CMUX_EVIDENCE_WORKSPACE_OS_SPEC.md` sections **Pi is the dashboard authoring assistant**, **The rendered preview matters**, and **Success criteria**.

## Goal

Create a project-local Pi skill that teaches Pi how to work inside this Evidence + CMUX dashboard workspace.

The skill should be loaded on demand when the user asks Pi to create, revise, validate, inspect, or publish an Evidence dashboard.

## Why this matters

The dynamic Evidence context extension tells Pi about the current workspace before each user turn. The skill tells Pi the repeatable workflow and domain rules for Evidence dashboard authoring.

Together:

- `.pi/extensions/evidence-context.ts` = current workspace facts, analysis intention, and safe data source catalog.
- `.cmux/workspace.json` = durable analysis metadata used by the extension.
- `.pi/skills/evidence-dashboard/SKILL.md` = durable Evidence + CMUX build/revision workflow instructions.
- `.pi/skills/evidence-dashboard-review/SKILL.md` = read-only BI/product review and QA workflow.
- `.pi/skills/evidence-data-semantics/SKILL.md` = safe metric/source SQL reasoning workflow.

## Create skill directory

```bash
mkdir -p .pi/skills/evidence-dashboard
```

Create:

```text
.pi/skills/evidence-dashboard/SKILL.md
```

## Suggested `SKILL.md`

```md
---
name: evidence-dashboard
description: Build, revise, inspect, validate, and prepare Evidence dashboards inside a CMUX workspace with a Pi agent, browser preview, and dev server pane. Use when the user asks about Evidence pages, dashboard layout, SQL queries, charts, tables, CMUX preview inspection, analysis workspaces, validation, or publishing.
---

# Evidence Dashboard Skill

Use this skill when working in the company-bi Evidence dashboard workspace.

## First steps

1. Treat the injected dynamic Evidence context as the current workspace/data context.
2. Read `.cmux/workspace.json` if durable analysis metadata is needed.
3. Read `.cmux/evidence.json` if project commands, preview URL, ports, or edit policy are needed.
4. Use `/evidence-context` if the generated context needs debugging.
5. Read `.cmux/pi-context.md` only as a legacy/fallback snapshot if needed.
6. Identify the primary Evidence page from metadata.
7. Inspect relevant files before editing.

## Workspace model

One analysis usually maps to:

- one Git branch
- one Git worktree
- one Evidence directory (multiple pages: Brief, Draft, Report)
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

## Dashboard workflow

For dashboard creation or revision:

1. Understand the user's business question.
2. Inspect the current Evidence page.
3. Inspect available sources/queries/schema notes when needed.
4. Propose a short plan before broad edits.
5. Make small changes.
6. Prefer the Draft page as the first edit target for exploration.
7. Use Evidence components idiomatically.
8. Check the rendered preview in CMUX when possible.
9. Fix visible errors before reporting completion.
10. Summarize changed files, assumptions, and next questions.

## CMUX preview inspection

When the user asks whether the dashboard looks correct, or after substantial edits:

1. Find the active preview URL from the injected dynamic context, `.cmux/workspace.json`, or `./bin/cmux-evidence preview-url`.
2. Use CMUX browser automation if a browser surface is available.
3. Snapshot or evaluate the page.
4. Look for Evidence build/runtime errors, blank sections, missing data, or obvious layout issues.
5. Report what was visually confirmed and what still requires human judgment.

Useful commands may include:

```bash
cmux list-pane-surfaces --workspace "$CMUX_WORKSPACE_ID" --json
cmux browser <surface> snapshot --interactive
cmux browser <surface> eval "document.title"
cmux browser <surface> screenshot --path /tmp/evidence-preview.png
```

Use exact commands supported by the installed CMUX version.

## Validation workflow

Before publishing or declaring completion:

```bash
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
```

## Specialized skill split

The implementation now keeps `evidence-dashboard` as the main builder skill and adds two narrower skills:

```text
.pi/skills/evidence-dashboard-review/SKILL.md
.pi/skills/evidence-data-semantics/SKILL.md
```

Use `evidence-dashboard-review` for dashboard critique, visible QA, placeholder detection, metric clarity checks, and recommended improvements. Its default posture is read-only unless the user asks for edits.

Use `evidence-data-semantics` when the task depends on metric definitions, source SQL interpretation, inferred dimensions/measures, or business assumptions. It explicitly preserves the no-secret boundary around `.env*` and `**/connection.yaml`.

Generated workspaces copy these app skills plus the selected CMUX skills that are useful for Evidence dashboard work:

```text
evidence-dashboard
evidence-dashboard-review
evidence-data-semantics
cmux-workspace
cmux-browser
cmux-pi
cmux-diagnostics
```

Broader CMUX customization/settings/keybinding skills are intentionally not copied by default.

## Add references directory later if needed

Only add reference files when they are useful. Possible future files:

```text
.pi/skills/evidence-dashboard/references/evidence-components.md
.pi/skills/evidence-dashboard/references/company-bi-data-model.md
.pi/skills/evidence-dashboard/scripts/find-preview-surface.sh
```

Do not overbuild this now.

## Ensure Pi can discover it

Project-local skills under `.pi/skills/` are bundled by `.pi/package.json` and loaded through the LUMEN launcher:

```bash
./bin/lumen-pi
```

The launcher intentionally disables unrelated global Pi resources, then loads the app-local package with `-e ./.pi`.

## Worktree copying concern

Git worktrees include tracked files, but project-local generated files may differ. Ensure the skill directory is committed in the main repo so new worktrees get it automatically.

If `.pi/skills/evidence-dashboard` is intentionally untracked, then `cmux-evidence new` must copy it into each worktree. Prefer committing it.

## Acceptance criteria

- `.pi/skills/evidence-dashboard/SKILL.md` exists.
- `.pi/skills/evidence-dashboard-review/SKILL.md` exists.
- `.pi/skills/evidence-data-semantics/SKILL.md` exists.
- Each skill has frontmatter with `name` and `description`.
- Descriptions clearly trigger for build/revision, review/QA, and data-semantics work respectively.
- The skill tells Pi to read `.cmux/workspace.json` and `.cmux/pi-context.md`.
- The skill includes safe edit policy.
- The skill includes CMUX browser preview inspection workflow.
- A new worktree contains the skill directory after creation.

## Test plan

```bash
find .pi/skills/evidence-dashboard -maxdepth 2 -type f -print
./bin/cmux-evidence new --print-layout "skill smoke test"
find <workspace-path>/.pi/skills/evidence-dashboard -maxdepth 2 -type f -print
```

Manual Pi test:

1. Start Pi inside an analysis worktree.
2. Ask: `What Evidence dashboard workflow should you follow here?`
3. Confirm Pi references the workspace metadata and preview loop.

## Keep it simple

Do not implement a full Pi extension yet. Start with a skill and prompt template because they are easier to inspect, version, and revise.
