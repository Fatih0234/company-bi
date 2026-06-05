# Step 10: CMUX Evidence Workspace OS Spec

## One-line description

Turn the existing `cmux-evidence` workflow into a small local-first workspace manager for Evidence dashboard creation: every analysis gets a Git worktree, a CMUX workspace, an Evidence preview, a Pi agent with analysis-specific context, and metadata that makes the workspace easy to find, validate, review, and publish.

## Product idea

The project should feel like a lightweight BI workspace operating system running inside CMUX.

A user should not need to remember which branch, port, worktree path, or dashboard page belongs to an analysis. They should be able to create an analysis, reopen it, ask Pi to edit it, inspect the live Evidence preview, validate the result, and prepare a pull request from one consistent workflow.

CMUX is the runtime UI:

- Workspace list and layout.
- Pi agent pane.
- Evidence browser preview pane.
- Dev server/log pane.
- Command Palette actions.
- Sidebar status, progress, logs, and notifications.
- Browser automation so the agent can inspect the rendered dashboard.

Pi is the dashboard authoring assistant:

- Receives dynamic workspace context.
- Knows which page, port, branch, and preview URL are active.
- Knows safe edit boundaries.
- Uses Evidence-specific skill instructions.
- Can inspect the CMUX browser preview before reporting success.

Evidence is the dashboard rendering engine:

- Pages, queries, sources, and components stay normal Evidence files.
- Git branches and worktrees isolate drafts.
- Publishing remains a Git/PR workflow.

## User stories

### Story 1: Create a dashboard analysis

As a technical analyst, I run:

```bash
cmux-evidence new "revenue quality by segment"
```

Expected result:

1. A unique slug is created.
2. A Git branch is created.
3. A Git worktree is created in the configured workspace storage location.
4. An Evidence page is created.
5. A free port is assigned.
6. Workspace metadata is written.
7. Global registry is updated.
8. CMUX opens the three-pane workspace.
9. Pi starts with dynamic Evidence-specific context.

### Story 2: Reopen an existing analysis

As a user, I run:

```bash
cmux-evidence list
cmux-evidence open revenue-quality-by-segment
```

Expected result:

1. The analysis is found from the registry.
2. Its worktree path, branch, page, port, and URL are shown.
3. CMUX opens the analysis workspace again.

### Story 3: Ask Pi to build the dashboard

As a user, I tell Pi:

```text
Create a dashboard showing revenue quality by customer segment and month.
```

Expected result:

1. Pi reads the generated context file.
2. Pi edits the intended Evidence page first.
3. Pi asks before changing shared sources/components.
4. Pi uses CMUX browser automation to inspect the preview.
5. Pi reports what changed and what still needs user judgment.

### Story 4: Validate before publishing

As a user, I run:

```bash
cmux-evidence validate
cmux-evidence diff
```

Expected result:

1. The Evidence app build/check command runs.
2. Git diff is summarized.
3. The current analysis metadata is shown.
4. CMUX status/progress/notifications communicate success or failure.

### Story 5: Prepare a reviewable PR

As a user, I run:

```bash
cmux-evidence publish
```

Expected result:

1. Validation runs first.
2. The diff is shown.
3. The user confirms.
4. A commit is created.
5. Branch is pushed.
6. A GitHub PR is opened or instructions are printed.

## Scope

### In scope now

- Global workspace registry.
- Project-local registry compatibility.
- `cmux-evidence list/open/current/status` commands.
- CMUX Command Palette actions for product-level operations.
- Dynamic Pi context file generated per analysis.
- Project-local Pi skill for Evidence dashboard authoring.
- Browser preview inspection helpers.
- Validation and diff commands.

### Later scope

- Polished standalone UI.
- Hosted multi-user application.
- Background daemon.
- Cross-project search UI.
- Full role-based permissions.
- Production deployment automation.
- Non-technical user onboarding.

## Design principles

### 1. Keep the primitive simple

One analysis equals:

```text
one Git branch
one Git worktree
one Evidence page
one Evidence dev server port
one CMUX workspace
one Pi session/context
one metadata record
```

### 2. Store enough metadata to avoid guessing

Every analysis should have a local metadata file and a registry entry. Commands should read metadata instead of rediscovering branch names, ports, and pages from conventions whenever possible.

### 3. Product actions, not low-level actions

Command Palette entries should be named around user intent:

- `Evidence: New Analysis`
- `Evidence: List Analyses`
- `Evidence: Open Analysis`
- `Evidence: Validate Dashboard`
- `Evidence: Show Diff`
- `Evidence: Publish Draft`

Avoid exposing many implementation details through the palette.

### 4. Pi should be workspace-aware by default

The launcher should start Pi with dynamic context:

```bash
pi --append-system-prompt .cmux/pi-context.md
```

The user should not need to explain the active page, port, URL, branch, or safe edit policy every time.

### 5. The rendered preview matters

A dashboard is not complete just because files changed. The agent should be able to inspect the browser preview and detect visible Evidence errors.

### 6. Git remains the collaboration model

Drafts live in branches/worktrees. Review happens through diffs and pull requests.

## Proposed file layout

Project root:

```text
company-bi/
  bin/
    cmux-evidence
  .cmux/
    evidence.json
    cmux.json
  .pi/
    skills/
      evidence-dashboard/
        SKILL.md
    prompt-templates/
      evidence-dashboard.md
  implementation-docs/
    10_CMUX_EVIDENCE_WORKSPACE_OS_SPEC.md
    11_GLOBAL_WORKSPACE_REGISTRY.md
    12_CMUX_PALETTE_ACTIONS.md
    13_DYNAMIC_PI_CONTEXT.md
    14_EVIDENCE_DASHBOARD_PI_SKILL.md
    15_BROWSER_PREVIEW_FEEDBACK_LOOP.md
    16_VALIDATE_DIFF_PUBLISH.md
```

Global state:

```text
~/.local/share/cmux-evidence/
  registry.json
  workspaces/
    company-bi/
      revenue-quality-by-segment/
      churn-by-region/
```

## Configuration contract

Extend `.cmux/evidence.json`:

```json
{
  "type": "evidence",
  "projectId": "company-bi",
  "port": 3000,
  "analysisBasePort": 3100,
  "agentCommand": "pi --append-system-prompt .cmux/pi-context.md",
  "devCommand": "npm run dev",
  "url": "http://localhost:3000",
  "workspaceDir": "~/.local/share/cmux-evidence/workspaces/company-bi",
  "registryPath": "~/.local/share/cmux-evidence/registry.json",
  "allowedAgentPaths": ["pages/**", "queries/**"],
  "askBeforeAgentPaths": ["components/**", "sources/**", "package.json", "package-lock.json"],
  "blockedAgentPaths": [".env*", "**/connection.yaml", ".github/**"]
}
```

Keep backward compatibility with the current `.workspaces` default if these fields are missing.

## Metadata contract

Each analysis worktree should contain:

```text
.cmux/workspace.json
.cmux/pi-context.md
```

Example `.cmux/workspace.json`:

```json
{
  "kind": "evidence-analysis",
  "projectId": "company-bi",
  "title": "Revenue Quality by Segment",
  "slug": "revenue-quality-by-segment",
  "branch": "analysis/revenue-quality-by-segment",
  "path": "/Users/example/.local/share/cmux-evidence/workspaces/company-bi/revenue-quality-by-segment",
  "page": "pages/analysis/revenue-quality-by-segment.md",
  "port": 3104,
  "url": "http://localhost:3104/analysis/revenue-quality-by-segment",
  "status": "draft",
  "createdFrom": "main",
  "createdAt": "2026-06-05T00:00:00Z"
}
```

## Step sequence

1. `11_GLOBAL_WORKSPACE_REGISTRY.md` — add registry and global worktree storage.
2. `12_CMUX_PALETTE_ACTIONS.md` — add project-level CMUX palette actions.
3. `13_DYNAMIC_PI_CONTEXT.md` — generate `.cmux/pi-context.md` and launch Pi with it.
4. `14_EVIDENCE_DASHBOARD_PI_SKILL.md` — add an Evidence dashboard Pi skill.
5. `15_BROWSER_PREVIEW_FEEDBACK_LOOP.md` — add helpers for preview inspection.
6. `16_VALIDATE_DIFF_PUBLISH.md` — add validation, diff, and publish workflow.

## Success criteria

This implementation is successful when:

- `cmux-evidence new "example"` creates a globally stored worktree if configured.
- `cmux-evidence list` shows every known analysis for `company-bi`.
- `cmux-evidence open <slug>` reopens an analysis from the registry.
- CMUX Command Palette contains useful `Evidence:*` actions.
- Pi starts with analysis-specific prompt context.
- Pi has an Evidence dashboard skill available.
- The agent can inspect the browser preview through CMUX.
- `cmux-evidence validate` gives a clear pass/fail result.
- `cmux-evidence diff` clearly shows what changed.
- `cmux-evidence publish` is safe, confirm-before-commit, and PR-oriented.

## Non-goals for this implementation series

- Do not build a separate UI application.
- Do not replace Evidence internals.
- Do not make a daemon mandatory.
- Do not create hidden cloud state.
- Do not give the agent unrestricted edit permissions.
- Do not require global installation before the local workflow works.
