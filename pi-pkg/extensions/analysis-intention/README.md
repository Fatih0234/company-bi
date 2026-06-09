# analysis-intention Extension

In-session analysis intention interview for Evidence BI workspaces. Replaces the CLI's `collect_analysis_intention` with an iterative, cumulative, LLM-driven flow.

## What it does

1. **Captures the analysis brief** — an iterative interview where the LLM drives one question at a time using `ask_user`, with access to source SQL, prior answers, and the full session context.
2. **Persists the intention** — writes to `.cmux/workspace.json`, re-renders the page, and updates `.cmux/registry.json`.
3. **Commits the brief** — automatically stages and commits the page + workspace.json changes.

## Surfaces

| Surface | Name | Description |
|---|---|---|
| Slash command | `/analysis-intention` | Entry point for the user. Shows current state or starts a new interview. |
| Tool (LLM) | `start_analysis_intention` | Returns the interview protocol + current state. Call first. |
| Tool (LLM) | `save_intention_draft` | Persists the complete Intention object. Call when interview is done. |
| Tool (LLM) | `read_intention_draft` | Returns the current Intention for inspection. |
| Hook | `session_start` | Muted one-line tip when no intention exists. |
| Hook | `before_agent_start` | Small hint in dynamic context when intention is empty. |

## Dependencies

- `pi-ask-user` extension (vendored) — provides the `ask_user` tool used during the interview.
- `evidence-context.ts` extension — reads `.cmux/workspace.json` on every turn and surfaces the intention in the dynamic context.
