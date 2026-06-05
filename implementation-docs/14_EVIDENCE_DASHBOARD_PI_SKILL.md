# Step 14: Evidence Dashboard Pi Skill

References: `10_CMUX_EVIDENCE_WORKSPACE_OS_SPEC.md` sections **Pi is the dashboard authoring assistant**, **The rendered preview matters**, and **Success criteria**.

## Goal

Create a project-local Pi skill that teaches Pi how to work inside this Evidence + CMUX dashboard workspace.

The skill should be loaded on demand when the user asks Pi to create, revise, validate, inspect, or publish an Evidence dashboard.

## Why this matters

The dynamic context file tells Pi about the current workspace. The skill tells Pi the repeatable workflow and domain rules for Evidence dashboard authoring.

Together:

- `.cmux/pi-context.md` = current workspace facts.
- `.pi/skills/evidence-dashboard/SKILL.md` = durable Evidence + CMUX workflow instructions.

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

1. Read `.cmux/workspace.json` if it exists.
2. Read `.cmux/pi-context.md` if it exists.
3. Read `.cmux/evidence.json`.
4. Identify the primary Evidence page from metadata.
5. Inspect relevant files before editing.

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

## Dashboard workflow

For dashboard creation or revision:

1. Understand the user's business question.
2. Inspect the current Evidence page.
3. Inspect available sources/queries/schema notes when needed.
4. Propose a short plan before broad edits.
5. Make small changes.
6. Prefer the active analysis page as the first edit target.
7. Use Evidence components idiomatically.
8. Check the rendered preview in CMUX when possible.
9. Fix visible errors before reporting completion.
10. Summarize changed files, assumptions, and next questions.

## CMUX preview inspection

When the user asks whether the dashboard looks correct, or after substantial edits:

1. Find the active preview URL from `.cmux/workspace.json` or `.cmux/pi-context.md`.
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

## Add references directory later if needed

Only add reference files when they are useful. Possible future files:

```text
.pi/skills/evidence-dashboard/references/evidence-components.md
.pi/skills/evidence-dashboard/references/company-bi-data-model.md
.pi/skills/evidence-dashboard/scripts/find-preview-surface.sh
```

Do not overbuild this now.

## Ensure Pi can discover it

Project-local skills under `.pi/skills/` should be discoverable by Pi when launched from the project/worktree. If needed, pass it explicitly in `agentCommand` later:

```bash
pi --skill .pi/skills/evidence-dashboard --append-system-prompt .cmux/pi-context.md
```

Prefer implicit discovery first. Use explicit `--skill` only if discovery is unreliable in generated worktrees.

## Worktree copying concern

Git worktrees include tracked files, but project-local generated files may differ. Ensure the skill directory is committed in the main repo so new worktrees get it automatically.

If `.pi/skills/evidence-dashboard` is intentionally untracked, then `cmux-evidence new` must copy it into each worktree. Prefer committing it.

## Acceptance criteria

- `.pi/skills/evidence-dashboard/SKILL.md` exists.
- The skill has frontmatter with `name` and `description`.
- The description clearly triggers for Evidence dashboard work.
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
