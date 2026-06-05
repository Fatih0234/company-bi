# Step 15: Browser Preview Feedback Loop

References: `10_CMUX_EVIDENCE_WORKSPACE_OS_SPEC.md` sections **The rendered preview matters**, **Pi should be workspace-aware by default**, and **Success criteria**.

## Goal

Give Pi and the user simple commands to inspect the rendered Evidence dashboard inside the CMUX browser pane.

A dashboard is not done just because Markdown/SQL changed. The rendered preview should be checked for visible errors, blank states, wrong page title, missing data, and layout problems.

## First version principle

Do not build a complex browser controller. Add small helper commands to `bin/cmux-evidence` that wrap CMUX browser automation.

Suggested commands:

```bash
cmux-evidence preview-url
cmux-evidence preview-open
cmux-evidence preview-snapshot
cmux-evidence preview-title
cmux-evidence preview-screenshot
cmux-evidence browser-surfaces
```

## Metadata source

The commands should read:

1. `.cmux/workspace.json` for `url`.
2. `.cmux/evidence.json` fallback for `url`.
3. `http://localhost:<port>` fallback if only `port` exists.

## Add `preview-url`

Usage:

```bash
cmux-evidence preview-url
```

Behavior:

- Print the active preview URL.
- Exit non-zero if no URL can be resolved.

## Add `browser-surfaces`

Usage:

```bash
cmux-evidence browser-surfaces
```

Behavior:

- If `CMUX_WORKSPACE_ID` is set, list pane surfaces for that workspace.
- Print only browser surfaces if possible.

Implementation idea:

```python
def cmux_workspace_id() -> str | None:
    return os.environ.get("CMUX_WORKSPACE_ID")
```

Shell command:

```bash
cmux list-pane-surfaces --workspace "$CMUX_WORKSPACE_ID" --json
```

If that command is unavailable in the installed CMUX version, use the equivalent supported surface/pane listing command.

## Add `preview-open`

Usage:

```bash
cmux-evidence preview-open
```

Behavior:

1. Resolve preview URL.
2. If `CMUX_WORKSPACE_ID` exists, open a browser pane in the current workspace.
3. Otherwise print the URL.

Example command:

```bash
cmux new-pane --workspace "$CMUX_WORKSPACE_ID" --type browser --direction right --url "$url" --focus false
```

## Add `preview-title`

Usage:

```bash
cmux-evidence preview-title <surface-ref>
```

Behavior:

```bash
cmux browser <surface-ref> eval "document.title"
```

Use this as a quick smoke test that the browser surface is reachable.

## Add `preview-snapshot`

Usage:

```bash
cmux-evidence preview-snapshot <surface-ref>
```

Behavior:

```bash
cmux browser <surface-ref> snapshot --interactive
```

This gives Pi an accessibility tree of the rendered dashboard.

## Add `preview-screenshot`

Usage:

```bash
cmux-evidence preview-screenshot <surface-ref> [path]
```

Default path:

```text
/tmp/cmux-evidence-preview-<slug>.png
```

Behavior:

```bash
cmux browser <surface-ref> screenshot --path "$path"
```

Print the path after saving.

## Optional auto-detection

After the explicit commands work, add optional surface auto-detection:

```bash
cmux-evidence preview-snapshot
```

Auto-detection algorithm:

1. List surfaces in current workspace.
2. Filter browser surfaces.
3. Prefer a browser whose URL matches `.cmux/workspace.json.url`.
4. If exactly one browser exists, use it.
5. If multiple browsers exist and none match, print choices and ask the user to pass a surface ref.

Keep this deterministic. Do not guess silently when multiple candidates exist.

## Agent workflow

The Evidence dashboard skill should instruct Pi to use this loop:

1. Edit page/query.
2. Wait for dev server hot reload if needed.
3. Run `cmux-evidence browser-surfaces`.
4. Run `cmux-evidence preview-snapshot <surface>`.
5. Inspect for visible errors.
6. Fix and repeat.

## CMUX status integration

Optional but useful:

When preview check starts:

```bash
cmux set-status preview "checking" --workspace "$CMUX_WORKSPACE_ID" --color "#ff9500"
```

When it passes:

```bash
cmux set-status preview "ok" --workspace "$CMUX_WORKSPACE_ID" --color "#34c759"
```

When it fails:

```bash
cmux notify --title "Evidence Preview" --body "Preview check failed" --workspace "$CMUX_WORKSPACE_ID"
```

Only do this when `CMUX_WORKSPACE_ID` is present.

## Acceptance criteria

- `cmux-evidence preview-url` prints the current URL.
- `cmux-evidence preview-open` opens or prints the preview URL.
- `cmux-evidence browser-surfaces` helps identify browser surfaces.
- `cmux-evidence preview-title <surface>` can evaluate the browser title.
- `cmux-evidence preview-snapshot <surface>` returns a useful snapshot.
- Pi skill instructions reference these commands.
- Commands fail clearly when not running inside CMUX.

## Test plan

Inside an analysis workspace:

```bash
./bin/cmux-evidence preview-url
./bin/cmux-evidence preview-open
./bin/cmux-evidence browser-surfaces
```

After finding a browser surface:

```bash
./bin/cmux-evidence preview-title surface:123
./bin/cmux-evidence preview-snapshot surface:123
./bin/cmux-evidence preview-screenshot surface:123 /tmp/evidence-preview.png
```

## Failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| No `CMUX_WORKSPACE_ID` | Command run outside CMUX | Print URL and instructions |
| No browser surface | Preview pane not open | Run `preview-open` |
| Snapshot fails | Page not loaded | Refresh/wait and retry |
| Wrong page | Multiple browser panes | Pass explicit surface ref |
| Blank preview | Dev server not ready | Check dev logs pane |
