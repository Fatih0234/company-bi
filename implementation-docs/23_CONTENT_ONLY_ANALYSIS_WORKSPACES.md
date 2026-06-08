# Step 23: Content-Only Analysis Workspaces

## Goal

Move the long-term analysis model away from full Git worktrees of the runtime/project repository and toward **content-only analysis workspaces** backed by a hidden/generated Evidence runtime.

The user-facing workspace should contain the analysis surface area only: Markdown pages, local data/artifacts, lightweight metadata, and DuckDB reports/exports. Runtime code, Pi extension source, package files, scripts, implementation docs, and dependency folders should remain outside the user's analysis workspace.

## Problem with the current model

`cmux-evidence new` currently creates a Git worktree of the entire project repository under `.workspaces/<slug>`. That gives each analysis a working Evidence app, but it also exposes implementation details that are irrelevant or confusing for an analysis user:

- `bin/`
- `scripts/`
- `implementation-docs/`
- `package.json` / lockfiles
- `.pi/extensions/` source
- `.pi/skills/` implementation assets
- root README/tooling files
- full repo Git state

The current path policy in `.cmux/evidence.json` helps guide the agent, but it is not a hard workspace abstraction. The product should feel like an analysis document workspace, not like a source-code checkout.

## Long-term architecture

Separate the system into three roots:

| Root | Owner | Purpose | User-facing? |
|---|---|---|---|
| Runtime root | LUMEN/CMUX/Evidence package | CLI, Pi package, Evidence template, source connectors, scripts, package deps | No |
| Content workspace root | User/agent | Markdown pages, local data, reports, workspace metadata | Yes |
| Shadow Evidence app root | Runtime manager | Generated Evidence app that renders the content workspace | No |

Example paths:

```text
runtimeRoot
  /Volumes/T7/projects/company-bi

workspaceRoot
  ~/.local/share/lumen-bi/workspaces/company-bi/airport-demand

shadowRuntimeRoot
  ~/.local/share/lumen-bi/runtime/company-bi/airport-demand
```

## Target content workspace layout

```text
workspaceRoot/
  pages/
    index.md       # Brief / workspace map
    draft.md       # Exploration sandbox
    report.md      # Polished dashboard/report

  queries/         # Analysis-owned reusable SQL files
  data/            # Optional user-provided local files
  reports/         # Optional promoted Markdown reports

  .cmux/
    workspace.json # Durable analysis metadata and intention
    data-profile.json

  .pi/
    duckdb/
      audit/
      exports/
      reports/
      tmp/
```

The UI/file browser should primarily show:

```text
pages/
queries/
reports/
data/
```

`.cmux/` and `.pi/duckdb/` are useful implementation/provenance state, but they do not need to be prominent.

## Target shadow Evidence app layout

```text
shadowRuntimeRoot/
  evidence.config.yaml
  package.json
  package-lock.json              # optional, copied or generated
  node_modules -> runtimeRoot/node_modules

  pages -> workspaceRoot/pages
  queries -> workspaceRoot/queries
  reports -> workspaceRoot/reports
  data -> runtimeRoot/data              # canonical/runtime business data
  workspace-data -> workspaceRoot/data  # optional analysis-local files

  sources -> runtimeRoot/sources  # or generated source bundle

  .cmux/evidence.json            # runtime launch config for this shadow app
  .cmux/workspace.json -> workspaceRoot/.cmux/workspace.json

  .pi -> runtimeRoot/.pi or generated minimal package
  bin/lumen-pi -> runtimeRoot/bin/lumen-pi
  scripts/run_evidence_dev.sh -> runtimeRoot/scripts/run_evidence_dev.sh
```

The exact implementation can use symlinks where supported and copies where symlinks are not safe. The important contract is that the user edits `workspaceRoot`, while Evidence runs from `shadowRuntimeRoot`.

## CMUX launch model

The CMUX layout should use two different working directories:

| Pane | cwd | Command / URL |
|---|---|---|
| Pi Agent | `workspaceRoot` | runtime-managed `lumen-pi` with package path pointing at runtime/shadow `.pi` |
| Evidence Browser | n/a | `http://localhost:<port>` |
| Evidence Dev Logs | `shadowRuntimeRoot` | `npm run dev -- --port <port>` or equivalent |

This is the main product improvement: the agent and user operate in the clean content workspace, while the Evidence dev server has all runtime files it needs.

## Metadata contract

`workspaceRoot/.cmux/workspace.json` remains the durable source of truth. Extend it to distinguish content and runtime paths:

```json
{
  "kind": "lumen-analysis-workspace",
  "projectId": "company-bi",
  "title": "Airport Demand",
  "slug": "airport-demand",
  "status": "draft",
  "workspaceRoot": "/Users/example/.local/share/lumen-bi/workspaces/company-bi/airport-demand",
  "shadowRuntimeRoot": "/Users/example/.local/share/lumen-bi/runtime/company-bi/airport-demand",
  "runtimeRoot": "/Volumes/T7/projects/company-bi",
  "page": "pages/index.md",
  "pages": {
    "brief": "pages/index.md",
    "draft": "pages/draft.md",
    "report": "pages/report.md"
  },
  "port": 3100,
  "url": "http://localhost:3100",
  "intention": {},
  "createdAt": "...",
  "updatedAt": "..."
}
```

The registry should store the same high-level workspace record and should resolve opens by `workspaceRoot`, not by Git worktree path.

## Configuration additions

Add optional fields to `.cmux/evidence.json`:

```json
{
  "workspaceMode": "content-only",
  "workspaceDir": "~/.local/share/lumen-bi/workspaces/company-bi",
  "runtimeDir": "~/.local/share/lumen-bi/runtime/company-bi",
  "runtimeRoot": "/Volumes/T7/projects/company-bi",
  "registryPath": "~/.local/share/lumen-bi/registry.json",
  "contentVisiblePaths": ["pages/**", "queries/**", "reports/**", "data/**"],
  "allowedAgentPaths": ["pages/**", "queries/**", "reports/**", "data/**", ".cmux/workspace.json", ".cmux/data-profile.json", ".pi/duckdb/**"],
  "blockedAgentPaths": [".env*", "**/connection.yaml", "package.json", "package-lock.json", "bin/**", "scripts/**", ".pi/extensions/**"]
}
```

Keep the existing worktree mode as a compatibility fallback:

```json
{
  "workspaceMode": "git-worktree"
}
```

## Command changes

### `cmux-evidence new "Title"`

In `content-only` mode:

1. Resolve `runtimeRoot`, `workspaceDir`, `runtimeDir`, and `registryPath`.
2. Create a unique slug.
3. Create `workspaceRoot` as a normal directory, not a Git worktree.
4. Generate `pages/index.md`, `pages/draft.md`, `pages/report.md`, plus empty `queries/`, `reports/`, and `data/` directories.
5. Write `workspaceRoot/.cmux/workspace.json`.
6. Create or update the corresponding `shadowRuntimeRoot`.
7. Write `shadowRuntimeRoot/.cmux/evidence.json` for the Evidence dev server.
8. Update the registry.
9. Open CMUX with Pi rooted at `workspaceRoot` and Evidence dev rooted at `shadowRuntimeRoot`.

### `cmux-evidence open <slug>`

1. Resolve the content workspace from the registry.
2. Ensure the shadow runtime exists and is current.
3. Open the CMUX layout using split roots.

### `cmux-evidence validate`

In content-only mode, validation should run Evidence build/check from `shadowRuntimeRoot`, while reporting content workspace paths in output.

### `cmux-evidence diff`

In content-only mode, diff compares publishable content against snapshots, not against the full Git repo:

- prefer `.cmux/snapshots/last-published`,
- fall back to `.cmux/snapshots/initial`,
- if neither exists, show all publishable files as new.

Default publishable content for diff:

- `pages/report.md`
- `queries/**`

Optional config can include curated `reports/**` or `data/**`, but local data remains private by default.

Do not assume full repo Git diff in content-only mode.

### `cmux-evidence publish`

Content-only publish materializes approved content into a reviewable runtime repo branch:

1. Validate the shadow app.
2. Show changed publishable content.
3. Confirm publish.
4. Materialize `pages/report.md` as `pages/reports/<slug>/index.md` for route `/reports/<slug>/`.
5. Materialize `queries/**` as `queries/<slug>/**`.
6. Optionally include configured `reports/**`; keep `data/**` private unless explicitly configured.
7. Avoid publishing runtime/shadow files, `.pi/duckdb/**`, sessions, caches, build outputs, and secrets.
8. Commit the materialized files on `analysis/<slug>` and push/open a PR when available.

Legacy Git-worktree publish keeps the previous commit/push/PR behavior.

## Pi/runtime implications

Pi currently discovers context through `.cmux/evidence.json` and `.cmux/workspace.json` from the current directory. In content-only mode, Pi cwd is `workspaceRoot`, so the content workspace needs enough local metadata for extensions to work.

Recommended approach:

- Keep `.cmux/workspace.json` in `workspaceRoot`.
- Add a minimal `.cmux/evidence.json` in `workspaceRoot` that points to runtime/shadow paths, or update `findEvidenceRoot` logic to accept `.cmux/workspace.json` as an analysis root.
- Launch Pi with an explicit project-local package path from the runtime or shadow app, e.g. `pi -e <shadowRuntimeRoot>/.pi` or `pi -e <runtimeRoot>/.pi`.
- Ensure DuckDB tools default discovery to `workspaceRoot/data`, runtime Evidence sources, and approved business data roots — not the runtime source tree.

## Data/source model

Evidence sources may remain runtime-owned at first:

```text
shadowRuntimeRoot/sources -> runtimeRoot/sources
```

This keeps business source definitions centralized while analysis pages stay content-owned.

Later, support workspace-specific sources under:

```text
workspaceRoot/sources/
```

but treat source changes as advanced/ask-before because they can affect data semantics.

## Migration strategy

Do not break existing `.workspaces/*` Git worktree analyses immediately.

Phases:

1. Add `workspaceMode` config with default `git-worktree` for backward compatibility.
2. Implement content-only mode behind config/flag.
3. Add shadow runtime creation and CMUX split-root launch.
4. Update Pi context and DuckDB tooling to understand content workspace roots.
5. Add validate/open/list support for both modes.
6. Add publish/export model for content-only workspaces.
7. Optionally add migration command:

```bash
cmux-evidence migrate-worktree <slug>
```

which copies `pages/analysis/<slug>/**` and relevant `.cmux/workspace.json` into a new content-only workspace.

## Open questions

- Should each content workspace be its own small Git repo, or should snapshots be stored in registry/runtime state?
- Should `pages/` in content-only workspaces use flat files (`index.md`, `draft.md`, `report.md`) or preserve `pages/analysis/<slug>/...`?
- Should `sources/` be visible/editable in the content workspace for technical analysts, or hidden/runtime-owned by default?
- Should generated DuckDB Markdown reports be promoted into `reports/` automatically or only when the agent/user chooses?
- How should publish map content-only paths into the final production Evidence app?

## Acceptance criteria

The content-only implementation is successful when:

- Creating a new analysis does not create a full repo worktree.
- The user-facing file tree contains only analysis/content artifacts.
- Pi starts in the content workspace and sees only relevant analysis files by default.
- Evidence preview still renders correctly through the shadow runtime.
- DuckDB BI tools can discover business data and write local reports/exports.
- Existing worktree-based analyses still open.
- Validate/list/open work consistently across both workspace modes.
- Publish only considers content deliverables, not runtime implementation files.
