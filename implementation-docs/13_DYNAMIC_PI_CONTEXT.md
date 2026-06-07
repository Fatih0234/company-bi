# Step 13: Dynamic Pi Context

References: `10_CMUX_EVIDENCE_WORKSPACE_OS_SPEC.md` sections **Pi should be workspace-aware by default**, **Configuration contract**, and **Metadata contract**.

> Superseded/refined by `20_DYNAMIC_EVIDENCE_CONTEXT_EXTENSION.md`: workspace context is now injected passively before each user turn by `.pi/extensions/evidence-context.ts`. `.cmux/pi-context.md` remains a legacy/fallback human-readable snapshot, not the primary launch mechanism.

## Goal

Every generated analysis workspace should provide Pi with workspace-specific context. The current preferred mechanism is every-turn extension injection from durable metadata and safe source files.

The file should tell Pi:

- What analysis it is working on.
- Which Evidence page is primary.
- Which branch/worktree/port/URL is active.
- Which files are safe to edit.
- Which files require confirmation.
- Which files are blocked.
- How to use CMUX browser preview feedback.

## Why this matters

Without dynamic context, the user must repeatedly explain the dashboard goal, page path, preview URL, and safety rules. With dynamic context, every Pi session starts already oriented.

## Generated file

Create this file in every analysis worktree:

```text
.cmux/pi-context.md
```

Example content:

```md
# Evidence Dashboard Workspace Context

You are helping build an Evidence dashboard inside a CMUX workspace.

## Active analysis

- Project: company-bi
- Title: Revenue Quality by Segment
- Slug: revenue-quality-by-segment
- Branch: analysis/revenue-quality-by-segment
- Worktree: /Users/example/.local/share/cmux-evidence/workspaces/company-bi/revenue-quality-by-segment
- Primary page: pages/analysis/revenue-quality-by-segment/index.md
- Preview URL: http://localhost:3104/analysis/revenue-quality-by-segment
- Dev server port: 3104

## Main task

Help the user create and refine the Evidence dashboard for this analysis.
The workspace has three pages: Brief (index.md), Draft (draft.md), and Report (report.md).
Start with the Draft page for exploration unless the user asks for a different target.

## Safe edit policy

Allowed by default:

- pages/**
- queries/**

Ask before editing:

- components/**
- sources/**
- package.json
- package-lock.json

Do not edit:

- .env*
- **/connection.yaml
- .github/**

## CMUX workflow

When making dashboard changes:

1. Inspect the relevant Evidence files.
2. Make a small, focused edit.
3. Check the Evidence preview in the CMUX browser pane when possible.
4. Fix visible Evidence errors before saying the task is complete.
5. Summarize changed files and remaining questions.

Use CMUX status/progress/notifications for long-running work when available.
```

## Extend `.cmux/evidence.json`

Add path policy fields:

```json
{
  "agentCommand": "./bin/lumen-pi",
  "allowedAgentPaths": ["pages/**", "queries/**"],
  "askBeforeAgentPaths": ["components/**", "sources/**", "package.json", "package-lock.json"],
  "blockedAgentPaths": [".env*", "**/connection.yaml", ".github/**"]
}
```

Keep fallback defaults in code if the fields are absent.

## Update `bin/cmux-evidence`

Add `render_pi_context(...)`:

```python
def render_pi_context(
    *,
    project_id_value: str,
    title: str,
    slug: str,
    branch: str,
    worktree_path: Path,
    page: str,
    port: int,
    url: str,
    config: dict[str, Any],
) -> str:
    allowed = config.get("allowedAgentPaths") or ["pages/**", "queries/**"]
    ask = config.get("askBeforeAgentPaths") or ["components/**", "sources/**", "package.json", "package-lock.json"]
    blocked = config.get("blockedAgentPaths") or [".env*", "**/connection.yaml", ".github/**"]

    def bullets(values: list[str]) -> str:
        return "\n".join(f"- {value}" for value in values)

    return f"""# Evidence Dashboard Workspace Context

You are helping build an Evidence dashboard inside a CMUX workspace.

## Active analysis

- Project: {project_id_value}
- Title: {title}
- Slug: {slug}
- Branch: {branch}
- Worktree: {worktree_path}
- Primary page: {page}
- Preview URL: {url}
- Dev server port: {port}

## Main task

Help the user create and refine the Evidence dashboard for this analysis.
The workspace has three pages: Brief (index.md), Draft (draft.md), and Report (report.md).
Start with the Draft page for exploration unless the user asks for a different target.

## Safe edit policy

Allowed by default:

{bullets(allowed)}

Ask before editing:

{bullets(ask)}

Do not edit:

{bullets(blocked)}

## CMUX workflow

When making dashboard changes:

1. Inspect the relevant Evidence files.
2. Make a small, focused edit.
3. Check the Evidence preview in the CMUX browser pane when possible.
4. Fix visible Evidence errors before saying the task is complete.
5. Summarize changed files and remaining questions.

Use CMUX status/progress/notifications for long-running work when available.
"""
```

When `new_analysis` writes metadata, also write:

```python
(worktree_path / ".cmux" / "pi-context.md").write_text(
    render_pi_context(...),
)
```

## Launch Pi

The generated worktree `.cmux/evidence.json` now sets:

```json
{
  "agentCommand": "./bin/lumen-pi"
}
```

The wrapper starts Pi with global extension/skill/prompt/theme discovery disabled, then loads the app-local package from `.pi/package.json`. This keeps dashboard sessions specialized for LUMEN/Evidence while still allowing normal provider/model/auth settings to come from Pi configuration.

## Add `cmux-evidence context`

Usage:

```bash
cmux-evidence context
```

Behavior:

1. Read current `.cmux/workspace.json` and `.cmux/evidence.json`.
2. Regenerate `.cmux/pi-context.md`.
3. Print the generated path.

This allows users to refresh context if metadata changes.

Optional usage:

```bash
cmux-evidence context --print
```

Print the context to stdout without writing.

## Add a project-level prompt template

Create:

```text
.pi/prompt-templates/evidence-dashboard.md
```

Suggested content:

```md
Use the current dynamic Evidence dashboard workspace context.

Please help me improve the active analysis workspace. First inspect `.cmux/workspace.json` and the relevant workspace pages (Brief, Draft, Report) when needed. Use `/evidence-context` if the generated workspace/data context needs debugging. Then propose a short plan before editing.
```

This gives the user a convenient `/evidence-dashboard` prompt inside Pi.

## Acceptance criteria

- New analysis worktrees contain `.cmux/pi-context.md`.
- The context file includes title, slug, branch, page, port, and URL.
- The Pi agent command is `./bin/lumen-pi`.
- Existing `cmux-evidence open` opens Pi from the worktree so project-local extensions can inject context.
- `cmux-evidence context` regenerates context.
- The prompt does not include secrets.

## Test plan

```bash
./bin/cmux-evidence new --print-layout "dynamic context smoke test"
cat <workspace-path>/.cmux/pi-context.md
cat <workspace-path>/.cmux/evidence.json | jq .agentCommand
# Expected: "./bin/lumen-pi"
```

Manual CMUX test:

1. Open the workspace normally.
2. In Pi, ask: `What analysis workspace are you in?`
3. Confirm Pi knows the page and preview URL without being told.

## Safety notes

- Do not include `.env` values in the context.
- Do not paste database credentials.
- Do not make the allowed path policy too broad.
- Keep the prompt concise enough that it helps rather than overwhelms.
