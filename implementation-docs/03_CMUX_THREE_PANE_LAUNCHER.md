# Step 03: CMUX Three-Pane Launcher

## Goal

Create the first `cmux-evidence .` command.

The command should detect `.cmux/evidence.json` and open the Evidence project in a repeatable three-pane CMUX layout:

```text
┌─────────────────┬───────────────────────────────┐
│                 │ Browser: Evidence Preview     │
│ Pi Agent        │ http://localhost:<port>        │
│                 ├───────────────────────────────┤
│                 │ Terminal: npm run dev         │
└─────────────────┴───────────────────────────────┘
```

This step does not create branches or worktrees yet. It opens the current checkout only.

## Inputs

The launcher reads:

```text
.cmux/evidence.json
```

Minimum expected config:

```json
{
  "type": "evidence",
  "port": 3000,
  "agentCommand": "pi",
  "devCommand": "npm run dev",
  "url": "http://localhost:3000",
  "workspaceDir": ".workspaces"
}
```

## Create `bin/cmux-evidence`

Create `bin/cmux-evidence` as a Python script.

Implementation responsibilities:

1. Accept a target directory argument.
2. Resolve the absolute project path.
3. Verify `.cmux/evidence.json` exists.
4. Load the marker config.
5. Build a CMUX layout object.
6. Call the real `cmux workspace create`.
7. Focus the Pi pane if CMUX supports focus metadata.
8. Fall back with a clear error if config is missing or invalid.

Pseudo-implementation shape:

```python
#!/usr/bin/env python3

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

def main():
    target = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    marker = target / ".cmux" / "evidence.json"

    if not marker.exists():
        print(f"Not an Evidence CMUX workspace: {target}", file=sys.stderr)
        print("Missing .cmux/evidence.json", file=sys.stderr)
        return 2

    config = json.loads(marker.read_text())
    port = int(config.get("port", 3000))
    url = config.get("url", f"http://localhost:{port}")
    agent_command = config.get("agentCommand", "pi")
    dev_command = config.get("devCommand", "npm run dev")

    real_cmux = (
        os.environ.get("CMUX_EVIDENCE_REAL_CMUX")
        or os.environ.get("CMUX_REAL_BIN")
        or shutil.which("cmux")
    )

    if not real_cmux:
        print("Could not find cmux binary", file=sys.stderr)
        return 2

    layout = {
        "name": target.name,
        "root": str(target),
        "panes": [
            {
                "type": "terminal",
                "name": "Pi Agent",
                "command": agent_command,
                "cwd": str(target),
                "focus": True
            },
            {
                "type": "browser",
                "name": "Evidence Preview",
                "url": url
            },
            {
                "type": "terminal",
                "name": "Evidence Dev",
                "command": dev_command,
                "cwd": str(target)
            }
        ]
    }

    subprocess.run([
        real_cmux,
        "workspace",
        "create",
        "--name",
        target.name,
        "--layout",
        json.dumps(layout)
    ], check=True)

if __name__ == "__main__":
    raise SystemExit(main())
```

Adjust the exact layout schema to match the CMUX version you are using. The important part is the contract, not this exact JSON shape.

## Make the script executable

```bash
chmod +x bin/cmux-evidence
```

## Test the script directly

```bash
./bin/cmux-evidence .
```

Expected result:

- CMUX opens.
- Pi starts in the project root.
- Browser pane opens `http://localhost:3000`.
- Dev server pane runs `npm run dev`.

## Add a convenience PATH option

For local testing, you can add this to your shell profile:

```bash
export PATH="$PWD/bin:$PATH"
```

Or run it directly with:

```bash
./bin/cmux-evidence .
```

Do not require global installation for version 1.

## Debugging checklist

If the browser opens before the server is ready, this is acceptable for version 1. Refresh the browser pane once the server finishes booting.

If CMUX rejects the layout JSON:

1. Print the generated JSON to stdout.
2. Copy it into a scratch file.
3. Compare it with a known-working CMUX layout.
4. Adjust only the layout adapter, not the project marker contract.

If Pi starts in the wrong folder:

1. Confirm the layout includes `cwd`.
2. Confirm `target.resolve()` points at the Evidence project.
3. Confirm the wrapper was called with the correct directory.

## Commit the launcher

```bash
git add bin/cmux-evidence .cmux/evidence.json
git commit -m "Add CMUX Evidence launcher"
```

## Acceptance criteria

This step is complete when:

```bash
./bin/cmux-evidence .
```

opens the three-pane layout and the Evidence app is visible in the browser pane.

## Common mistakes

| Mistake | Fix |
|---|---|
| Hardcoding absolute paths | Always resolve from the target directory. |
| Requiring global config | Keep config in `.cmux/evidence.json`. |
| Mixing branch/worktree logic into this step | Save it for Step 04 and Step 05. |
| Failing silently when CMUX is missing | Print a clear error. |

## Next step

Continue to `04_WORKSPACE_AND_BRANCH_MODEL.md`.
