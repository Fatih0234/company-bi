# Pi Extensions

This directory contains project-local Pi extensions for Evidence-aware context, commands, and the LUMEN terminal UI identity.

## `pi-ask-user/`

Vendored copy of [edlsh/pi-ask-user](https://github.com/edlsh/pi-ask-user) v0.11.2.

Provides the `ask_user` LLM-callable tool — an interactive Q&A primitive that lets the agent ask the user a focused question and get a structured response (single-select, multi-select, or freeform). Used by the `analysis-intention` extension for the iterative interview flow, and available to any Pi agent for high-stakes decisions.

The vendored copy ships its own `package.json` (peerDeps only) and a local `node_modules/` containing `@sinclair/typebox@0.25.24`, which is not in the global Pi install.

Also ships the companion `ask-user` skill (`skills/ask-user/SKILL.md`) — a decision-gate protocol that nudges the LLM to use `ask_user` for any high-stakes decision.

Do not edit in place. To sync from upstream, replace `index.ts`, `single-select-layout.ts`, and `skills/ask-user/SKILL.md`, then re-run `npm install` in this directory.

## `analysis-intention/`

In-session analysis intention interview for Evidence BI workspaces.

Replaces the CLI's `collect_analysis_intention` with an iterative, cumulative, LLM-driven flow using `ask_user`.

Surfaces:
- `/analysis-intention` slash command — entry point for the user
- `start_analysis_intention` tool — returns the interview protocol + current state
- `save_intention_draft` tool — persists the Intention, re-renders page, updates registry
- `read_intention_draft` tool — reads current Intention
- `session_start` hook — muted one-line tip when no intention exists
- `before_agent_start` hook — small hint in dynamic context when intention is empty

## `duckdb-bi/`

Project-local DuckDB BI tools for safe, audited data exploration.

Registers bounded `duckdb_*` LLM-callable tools for readonly SQL, Evidence-aware table discovery, schema/sample/profile checks, data quality reports, join coverage checks, exports, Markdown reports, and query audit log reads. The tools execute DuckDB through argument-array `spawn()` calls, validate project-local paths, block destructive SQL by default, and write runtime artifacts only under `.pi/duckdb/` (inside each workspace's own `.pi/` directory).

For this Evidence BI project, discovery defaults to semantic sources under `sources/*/*.sql` plus business files under `data/`, while generated/internal directories such as `.agent/`, `.cmux/`, `.evidence/`, `.pi/`, `.workspaces/`, and `.minio-data/` are excluded unless the agent explicitly requests all-mode discovery. Evidence source SQL can be addressed directly by names such as `tlc.trips` or `tlc.zones`.

The companion `data-discovery` skill at `.pi/skills/data-discovery/SKILL.md` packages a repeatable discovery workflow: orient → shape → identify table kind → quality → join coverage → narrative → optional persistence. Use it when profiling CSV, Parquet, JSON/JSONL, or DuckDB files.

Runtime outputs are intentionally local and ignored by Git via `.pi/duckdb/` (workspace-local); the extension source, tests, fixtures, and skill live under `pi-pkg/` and are symlinked into generated Evidence workspaces.

## `lumen-bi/`

Static LUMEN TUI header extension for Pi.

Behavior:

- Sets the branded LUMEN header on `session_start` when Pi is running in TUI mode.
- Uses the project theme `lumen-bi-midnight` from `.pi/themes/lumen-bi-midnight.json`.
- Registers `/lumen-header` to restore the custom header.
- Registers `/default-header` to restore the default Pi header.

The header is a static block-letter LUMEN mark (uniform cyan with a muted baseline). It deliberately does not animate — a previous animated version triggered a `pi-tui` scrollback-clearing code path whenever the conversation grew taller than the terminal, so the logo is now rendered once at session start.

The project-local `pi-pkg/settings.json` selects the LUMEN theme (symlinked into each workspace's `.pi/settings.json`):

```json
{
  "theme": "lumen-bi-midnight"
}
```

Generated Evidence workspaces symlink this extension, the theme directory, `settings.json`, and `package.json` from `pi-pkg/` into the workspace's `.pi/`.

## App package and isolated launcher

The project-local Pi package lives at:

```text
pi-pkg/package.json
```

It bundles the LUMEN/Evidence resources used for dashboard-building sessions:

- `evidence-context.ts`
- `duckdb-bi/`
- `lumen-bi/`
- selected Evidence, DuckDB, and CMUX skills
- `evidence-dashboard` prompt template
- `lumen-bi-midnight` theme

Use the app launcher instead of plain `pi` for dashboard-agent sessions:

```bash
./bin/lumen-pi
```

The launcher runs Pi with global resource discovery disabled and loads only this app package:

```bash
pi --no-extensions --no-skills --no-prompt-templates --no-themes -e ./pi-pkg
```

**Important:** The Pi package lives at `pi-pkg/` (not `.pi/`) so that running bare `pi` from the project root does NOT auto-discover project extensions/skills. This lets developers build the tool without the tools loading into their session.

It also stores sessions under `.cmux/pi-sessions` for this project/worktree.

Generated Evidence workspaces set `agentCommand` to `./bin/lumen-pi`, so CMUX Pi panes start as specialized LUMEN BI dashboard agents rather than inheriting unrelated global Pi extensions/skills/themes.

## `evidence-context.ts`

Passive dynamic context injection for Evidence workspaces.

On each user turn, it reads only safe local metadata/source files and appends a concise context block to Pi's system prompt:

- `.cmux/evidence.json`
- `.cmux/workspace.json` when present
- CMUX runtime anchors from `CMUX_WORKSPACE_ID`, `CMUX_SURFACE_ID`, and `CMUX_SOCKET_PATH` presence
- expected Evidence/CMUX UI model and non-disruptive automation rules
- `evidence.config.yaml` datasource plugin names
- `sources/*/*.sql` source query files
- optional cached `.cmux/data-context.json` or `.cmux/data-profile.json`

It intentionally does **not** read secrets or connection files such as `.env*` or `**/connection.yaml`.

Available commands:

- `/evidence-context` — print the dynamic context that will be injected before each user turn
- `/workspace-status` — show a compact formatted card with the current analysis workspace, primary page, preview URL, Git status, and CMUX attachment state; use `--debug` to show CMUX IDs
- `/workspace-list` — open an interactive selector of registered analysis workspaces; Enter explicitly opens/jumps to the selected workspace via the main project `bin/cmux-evidence open <slug>` helper; use `/workspace-list --text` for plain read-only output
- `/workspace-summary` — show a compact formatted card with the current workspace brief, detected dashboard state, and suggested next step; use `--full` for the complete brief
- `/workspace-cleanup-plan` — show a formatted read-only cleanup safety review with risks and recommended next action

Future command ideas:

- /workspace-archive
- /evidence-status
- /evidence-schema
- /evidence-refresh
- /evidence-diff
- /evidence-validate
- /evidence-publish
