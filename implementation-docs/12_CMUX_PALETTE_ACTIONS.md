# Step 12: CMUX Palette Actions

References: `10_CMUX_EVIDENCE_WORKSPACE_OS_SPEC.md` sections **Design principles**, **Product actions, not low-level actions**, and **Success criteria**.

## Goal

Expose the Evidence workspace manager through CMUX Command Palette actions.

The user should be able to press `Cmd+Shift+P` and run product-level actions such as:

- `Evidence: New Analysis`
- `Evidence: List Analyses`
- `Evidence: Current Analysis`
- `Evidence: Validate Dashboard`
- `Evidence: Show Diff`
- `Evidence: Publish Draft`

## Why this matters

The Command Palette can act as the first user interface before a polished app exists. It lets the workflow feel like a product while staying simple and local.

## Create `.cmux/cmux.json`

If the project does not already have `.cmux/cmux.json`, create it. Keep `.cmux/evidence.json` separate as the Evidence launcher config.

Minimal initial file:

```json
{
  "actions": {
    "evidence-new-analysis": {
      "type": "command",
      "title": "Evidence: New Analysis",
      "subtitle": "Create a Git worktree, Evidence page, Pi agent, preview, and logs",
      "command": "./bin/cmux-evidence new",
      "target": "currentTerminal",
      "palette": true
    },
    "evidence-list-analyses": {
      "type": "command",
      "title": "Evidence: List Analyses",
      "subtitle": "Show known analysis workspaces for this project",
      "command": "./bin/cmux-evidence list",
      "target": "currentTerminal",
      "palette": true
    },
    "evidence-current-analysis": {
      "type": "command",
      "title": "Evidence: Current Analysis",
      "subtitle": "Show metadata for the current analysis workspace",
      "command": "./bin/cmux-evidence current",
      "target": "currentTerminal",
      "palette": true
    },
    "evidence-status": {
      "type": "command",
      "title": "Evidence: Status",
      "subtitle": "Show Git, port, and workspace status",
      "command": "./bin/cmux-evidence status",
      "target": "currentTerminal",
      "palette": true
    },
    "evidence-validate": {
      "type": "command",
      "title": "Evidence: Validate Dashboard",
      "subtitle": "Run Evidence validation/build checks for this workspace",
      "command": "./bin/cmux-evidence validate",
      "target": "currentTerminal",
      "palette": true
    },
    "evidence-diff": {
      "type": "command",
      "title": "Evidence: Show Diff",
      "subtitle": "Show current analysis Git diff",
      "command": "./bin/cmux-evidence diff",
      "target": "currentTerminal",
      "palette": true
    },
    "evidence-publish": {
      "type": "command",
      "title": "Evidence: Publish Draft",
      "subtitle": "Validate, commit, push, and prepare a PR",
      "command": "./bin/cmux-evidence publish",
      "target": "currentTerminal",
      "palette": true
    }
  }
}
```

## Important CMUX action rules

Follow the working rules from `docs/cmux-palette-actions.md`:

- Use explicit `actions`.
- Use `palette: true`.
- Use `type: "command"` for `cmux-evidence` and Pi wrapper commands.
- Valid command targets are usually:
  - `currentTerminal`
  - `newTabInCurrentPane`
- Do not add `shortcut` fields inside actions.
- If shortcuts are desired later, bind them globally in `~/.config/cmux/cmux.json`.

## Reload after editing

```bash
cmux reload-config
```

Then press:

```text
Cmd+Shift+P
```

Search for:

```text
Evidence:
```

## Commands that need arguments

CMUX palette command actions are best for direct commands. `Evidence: New Analysis` needs a title. For the first version, let it run in the current terminal and prompt through terminal usage if the title is missing:

```text
Usage: cmux-evidence new "analysis name"
```

Later options:

1. Add a small `cmux-evidence new-interactive` command that prompts for a title.
2. Add a Pi prompt template that asks the user what analysis to create.
3. Build a custom extension UI after the CLI flow is stable.

For now, keep it simple.

## Optional tab-bar buttons

After palette actions are stable, consider adding a small tab-bar button for the most common action:

```json
{
  "ui": {
    "surfaceTabBar": {
      "buttons": [
        "cmux.newTerminal",
        "cmux.newBrowser",
        {
          "action": "evidence-list-analyses",
          "title": "Analyses",
          "icon": { "type": "symbol", "name": "chart.bar.doc.horizontal" }
        }
      ]
    }
  }
}
```

Do not add this until the basic palette actions are verified.

## Acceptance criteria

- `.cmux/cmux.json` exists and parses as JSON.
- `cmux reload-config` succeeds.
- `Cmd+Shift+P` shows `Evidence:*` entries.
- `Evidence: List Analyses` runs `./bin/cmux-evidence list` in the current terminal.
- `Evidence: Current Analysis` works inside an analysis worktree.
- Missing-command behavior is readable and not silent.

## Test plan

```bash
python3 -m json.tool .cmux/cmux.json
cmux reload-config
./bin/cmux-evidence list
./bin/cmux-evidence current || true
```

Manual test:

1. Press `Cmd+Shift+P`.
2. Type `Evidence:`.
3. Run `Evidence: List Analyses`.
4. Confirm output appears in the active terminal.

## Failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| Palette actions missing | Config not reloaded | Run `cmux reload-config` |
| Palette actions missing | Invalid JSON | Run `python3 -m json.tool .cmux/cmux.json` |
| Command does nothing | Wrong target | Use `currentTerminal` |
| Agent action rejected | Used `type: agent` for unsupported agent | Use `type: command` |
| Shortcut not working | Shortcut put inside action | Configure shortcuts globally later |
