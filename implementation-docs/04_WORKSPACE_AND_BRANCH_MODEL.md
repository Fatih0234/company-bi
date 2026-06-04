# Step 04: Workspace and Branch Model

## Goal

Define how isolated analysis workspaces work before implementing `cmux-evidence new`.

The rule for version 1:

```text
one analysis = one Git branch + one Git worktree + one Evidence dev server port + one CMUX workspace
```

## Why Git worktrees

A normal Git checkout can only have one branch checked out at a time. Git worktrees allow multiple working trees to be attached to the same repository, so each analysis can have its own directory and branch while sharing the same Git object database.

This keeps analyses isolated without cloning the entire repository for every analysis.

## Directory model

Main checkout:

```text
company-bi/
  pages/
  sources/
  queries/
  .cmux/
  .pi/
  bin/
  scripts/
```

Analysis worktrees:

```text
company-bi/
  .workspaces/
    churn-by-region/
      pages/
      sources/
      queries/
    q2-revenue/
      pages/
      sources/
      queries/
```

The `.workspaces/` folder is local runtime state and must stay ignored by Git.

## Branch naming convention

Use this branch prefix:

```text
analysis/<slug>
```

Examples:

```text
analysis/churn-by-region
analysis/q2-revenue
analysis/marketing-funnel
```

Optional later extension:

```text
analysis/<user>/<slug>
```

Examples:

```text
analysis/alice/churn-by-region
analysis/bob/q2-revenue
```

For version 1, start with `analysis/<slug>`.

## Slug rules

Given an analysis title:

```text
"Churn by Region!"
```

Create:

```text
churn-by-region
```

Slug algorithm:

1. Lowercase.
2. Replace non-alphanumeric sequences with `-`.
3. Trim leading/trailing `-`.
4. If empty, use `untitled-analysis`.
5. If branch exists, append `-2`, `-3`, etc.

## Port assignment

Each worktree needs a unique local port.

Default main port:

```text
3000
```

Analysis port range:

```text
3100-3199
```

Port assignment algorithm:

1. Read `.cmux/evidence.json`.
2. Start with `analysisBasePort`, default `3100`.
3. Check existing workspace metadata.
4. Pick the first unused port.
5. Write the assigned port into the worktree marker file.

Add this to `.cmux/evidence.json` in the main checkout:

```json
{
  "type": "evidence",
  "port": 3000,
  "agentCommand": "pi",
  "devCommand": "npm run dev",
  "url": "http://localhost:3000",
  "workspaceDir": ".workspaces",
  "analysisBasePort": 3100
}
```

## Workspace metadata

In each worktree, write:

```text
.cmux/workspace.json
```

Example:

```json
{
  "kind": "analysis",
  "slug": "churn-by-region",
  "branch": "analysis/churn-by-region",
  "port": 3100,
  "page": "pages/analysis/churn-by-region.md",
  "createdFrom": "main"
}
```

This file is useful for the launcher and Pi extension, but decide whether it should be committed later. For version 1, prefer not committing it unless needed.

## Worktree creation command

The eventual command will run:

```bash
git worktree add -b analysis/churn-by-region .workspaces/churn-by-region main
```

If `main` is not the correct base branch, use the current branch or configured base branch.

## Worktree lifecycle

### Create

Handled by `cmux-evidence new`.

### List

Manual command for now:

```bash
git worktree list
```

### Remove

Manual command for now:

```bash
git worktree remove .workspaces/churn-by-region
git branch -D analysis/churn-by-region
```

Do not automate destructive cleanup in version 1.

## Main checkout rules

The main checkout is the stable project root.

Do not run analysis edits directly in main after this model is implemented.

Allowed in main:

- Update shared tooling.
- Update docs.
- Update source configuration intentionally.
- Launch default preview.

Analysis edits should happen in `.workspaces/<slug>`.

## Agent editing rules

In an analysis worktree, Pi should prefer editing:

```text
pages/analysis/<slug>.md
queries/<slug>/**
```

Pi should avoid editing:

```text
sources/**/connection.yaml
.env*
package.json
package-lock.json
.github/**
```

Unless the user explicitly asks and confirms.

## Acceptance criteria

This step is complete when the model is documented and the repository has:

```text
.cmux/evidence.json
.workspaces/ ignored
```

and you can manually prove the model:

```bash
git worktree add -b analysis/test .workspaces/test main
cd .workspaces/test
npm run dev -- --port 3100
```

If the exact Evidence dev command does not accept `--port` in your setup, handle port selection through environment variables or generated config in Step 05. The important requirement is that each analysis preview must avoid colliding with the main preview.

## Common mistakes

| Mistake | Fix |
|---|---|
| Creating branches without worktrees | Use worktrees so multiple analyses can be open at once. |
| Using port 3000 for every analysis | Assign unique ports. |
| Editing main directly | Create an analysis worktree first. |
| Automating deletion too early | Keep cleanup manual in version 1. |

## Next step

Continue to `05_NEW_ANALYSIS_COMMAND.md`.
