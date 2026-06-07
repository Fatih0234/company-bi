# Dynamic Evidence Context Extension

## Goal

Provide passive, dynamic Pi context injection for Evidence dashboard workspaces.

The extension should help Pi understand the current workspace and available data sources without hard-coding project-specific datasets and without reading secrets.

## Implemented file

```text
.pi/extensions/evidence-context.ts
```

The extension is bundled by the project-local LUMEN Pi package at `.pi/package.json` and loaded by `./bin/lumen-pi`.

Plain Pi can auto-discover project-local extensions from `.pi/extensions/`, but LUMEN dashboard sessions intentionally use the wrapper so unrelated global Pi extensions/skills/themes are not loaded.

## Behavior

On each user turn, the extension handles Pi's `before_agent_start` event and appends a generated context block to the system prompt.

It also registers:

```text
/evidence-context
/workspace-status
/workspace-list
/workspace-summary
/workspace-cleanup-plan
```

`/evidence-context` prints the same generated context for debugging.

The workspace commands are lightweight product affordances on top of the Git worktree/branch/CMUX model:

- `/workspace-status` shows a compact Pi custom-message card with current workspace facts, primary page, preview URL, Git changes, and CMUX attachment state. `--debug` includes CMUX IDs.
- `/workspace-list` reads `.cmux/registry.json` and opens a Pi TUI selector. Pressing Enter is an explicit user action that opens/jumps via the main project `bin/cmux-evidence open <slug>` helper. `/workspace-list --text` prints a passive plain-text list.
- `/workspace-summary` shows a compact Pi custom-message card with the onboarding brief, detected page/dashboard state, and suggested next step. `--full` includes the complete brief.
- `/workspace-cleanup-plan` is read-only and shown as a Pi custom-message card. It checks uncommitted Git changes and explains safe cleanup options, but does not archive, delete, switch, or focus anything.

The workspace display commands use `pi.sendMessage()` plus `pi.registerMessageRenderer()` instead of raw `console.log()` in TUI mode. This prevents the animated LUMEN header from being interleaved into report output and keeps command results visually distinct from assistant text.

## Safe inputs

The extension reads:

- `.cmux/evidence.json`
- `.cmux/workspace.json` when present
- `evidence.config.yaml` for configured Evidence datasource plugin package names
- `sources/*/*.sql` for source query catalog summaries
- optional cached `.cmux/data-context.json` or `.cmux/data-profile.json`
- `CMUX_WORKSPACE_ID` and `CMUX_SURFACE_ID` environment variables when present
- `CMUX_SOCKET_PATH` presence only, to know whether CMUX socket integration is available without exposing the local socket path in the prompt

The extension intentionally does **not** read:

- `.env*`
- `**/connection.yaml`
- raw data files
- MinIO credentials or bucket internals

## CMUX/UI context design

The extension injects a lightweight CMUX workspace block on every user turn. This is intentionally orientation-only and does not query or mutate CMUX state.

It tells Pi:

- the caller workspace/surface anchors when provided by CMUX
- whether a CMUX socket appears available
- that the workspace is a product UI with a Pi agent terminal, Evidence browser preview, and dev server/log terminal
- that the caller workspace is the automation target and visual focus may be elsewhere
- not to call focus-changing CMUX commands unless explicitly asked
- to prefer project preview helpers before raw CMUX commands
- to use browser preview/dev server errors as dashboard completion signals after meaningful edits

The extension also lists on-demand helper commands such as:

```bash
./bin/cmux-evidence preview-url
./bin/cmux-evidence browser-surfaces
./bin/cmux-evidence preview-snapshot <surface-ref>
cmux list-pane-surfaces --workspace "$CMUX_WORKSPACE_ID" --json
```

This keeps every-turn context cheap and non-disruptive while still making Pi aware that it is operating inside a multi-surface BI workspace.

## Data-source context design

The source catalog is dynamic and generic. It is inferred from `sources/*/*.sql` only.

For each source query, the extension includes:

- Evidence query/table name, e.g. `source.query_name`
- defining file path
- inferred columns
- likely time fields
- likely measures
- likely dimensions
- compact SQL preview

The inference is heuristic. Pi is instructed to verify inferred columns/metrics before relying on them.

## Lightweight profiling

The extension does not run profiling itself.

If a future command writes a safe cached profile to one of these files, the extension will include it:

```text
.cmux/data-context.json
.cmux/data-profile.json
```

These stats are presented as hints, not guarantees.

## LUMEN package and isolated session launcher

The app-local package manifest is:

```text
.pi/package.json
```

It bundles:

- `.pi/extensions/evidence-context.ts`
- `.pi/extensions/lumen-bi/`
- selected Evidence and CMUX skills
- `.pi/prompts/evidence-dashboard.md`
- `.pi/themes/lumen-bi-midnight.json`

Dashboard-agent sessions should launch through:

```bash
./bin/lumen-pi
```

The wrapper runs:

```bash
pi --no-extensions --no-skills --no-prompt-templates --no-themes --session-dir .cmux/pi-sessions -e ./.pi
```

This keeps the normal provider/model/auth configuration available while preventing unrelated global Pi resources from changing the LUMEN BI agent behavior.

## Worktree/session support

`bin/cmux-evidence new` now copies the LUMEN package pieces into generated worktrees, including `.pi/package.json`, selected extensions, selected skills, theme files, `.pi/settings.json`, and `bin/lumen-pi`. This lets local uncommitted extension/skill/theme changes participate in manual onboarding tests.

Generated workspaces now launch Pi with `./bin/lumen-pi`, not plain `pi` and not `pi --append-system-prompt .cmux/pi-context.md`. The authoritative context path is:

```text
.cmux/workspace.json + safe source files -> .pi/extensions/evidence-context.ts -> before_agent_start system prompt injection
```

`.cmux/pi-context.md` can still be generated as a human-readable legacy/fallback snapshot, but it is no longer the primary session context mechanism.

## Validation

Syntax/compile checks used:

```bash
python3 -m py_compile bin/cmux-evidence
node -e "/* TypeScript transpileModule smoke test */"
```

Manual Pi test:

1. Start Pi in the project or generated worktree.
2. Run `/evidence-context`.
3. Confirm the printed context includes workspace metadata and source query catalog.
4. Ask a normal dashboard question and confirm Pi uses the data/source context without being told.
