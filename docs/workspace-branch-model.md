# Workspace and Branch Model

Version 1 uses this isolation rule:

```text
one analysis = one Git branch + one Git worktree + one Evidence dev server port + one CMUX workspace
```

## Main checkout

The repository root is the stable checkout for shared tooling and default preview.

- Default branch: `main`
- Default preview port: `3000`
- Local analysis worktrees directory: `.workspaces/`

Do not use the main checkout for analysis-specific dashboard edits once the `new` flow exists.

## Analysis worktrees

Each analysis lives in its own ignored worktree under `.workspaces/<slug>`.

Example:

```text
.workspaces/churn-by-region
branch: analysis/churn-by-region
port: 3100
page: pages/analysis/churn-by-region.md
```

## Branches and slugs

Branch names use:

```text
analysis/<slug>
```

Slug rules:

1. Lowercase.
2. Replace non-alphanumeric runs with `-`.
3. Trim leading/trailing `-`.
4. Use `untitled-analysis` if empty.
5. Append `-2`, `-3`, etc. on collisions.

## Ports

Analysis ports start at `.cmux/evidence.json.analysisBasePort`, currently `3100`.

The `new` command must choose the first unused port and write it into the worktree marker/config before launching CMUX.

## Metadata

Each analysis worktree should have local metadata:

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

This metadata is local runtime state for launchers/extensions and should not be required for production builds.
