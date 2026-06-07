# Pi Extensions

This directory contains project-local Pi extensions for Evidence-aware context, commands, and the LUMEN terminal UI identity.

## `lumen-bi/`

Static LUMEN TUI header extension for Pi.

Behavior:

- Sets the branded LUMEN header on `session_start` when Pi is running in TUI mode.
- Uses the project theme `lumen-bi-midnight` from `.pi/themes/lumen-bi-midnight.json`.
- Registers `/lumen-header` to restore the custom header.
- Registers `/default-header` to restore the default Pi header.

The header is a static block-letter LUMEN mark (uniform cyan with a muted baseline). It deliberately does not animate — a previous animated version triggered a `pi-tui` scrollback-clearing code path whenever the conversation grew taller than the terminal, so the logo is now rendered once at session start.

The project-local `.pi/settings.json` selects the LUMEN theme:

```json
{
  "theme": "lumen-bi-midnight"
}
```

Generated Evidence workspaces copy this extension, the theme directory, `.pi/settings.json`, and `.pi/package.json`.

## App package and isolated launcher

The project-local Pi package lives at:

```text
.pi/package.json
```

It bundles the LUMEN/Evidence resources used for dashboard-building sessions:

- `evidence-context.ts`
- `lumen-bi/`
- selected Evidence and CMUX skills
- `evidence-dashboard` prompt template
- `lumen-bi-midnight` theme

Use the app launcher instead of plain `pi` for dashboard-agent sessions:

```bash
./bin/lumen-pi
```

The launcher runs Pi with global resource discovery disabled and loads only this app package:

```bash
pi --no-extensions --no-skills --no-prompt-templates --no-themes -e ./.pi
```

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
