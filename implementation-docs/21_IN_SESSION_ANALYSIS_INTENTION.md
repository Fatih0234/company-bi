# Step 21: In-Session Analysis Intention

## Goal

Replace the CLI's `collect_analysis_intention` interview (from Step 17) with an **optional, in-session, LLM-driven flow** that runs inside the Pi session after the workspace exists.

The intention remains stored in `.cmux/workspace.json` under `intention` — the shape is preserved, the dynamic context injection continues to work, and existing worktrees are unaffected.

## Design

### Two stages, decoupled

| Stage | Owner | What it does |
|---|---|---|
| **Workspace shell** | `bin/cmux-evidence new "Title"` (CLI) | Creates worktree, branch, port, page stub, registry entry with `intention: {}`. No interview. |
| **Analysis intention** | `.pi/extensions/analysis-intention/` (Pi extension) | Iterative interview via `ask_user`, writes `intention` to `.cmux/workspace.json`, re-renders page, updates registry, offers commit. |

The CLI no longer asks any interview questions. The intention is captured separately, only when the user wants it.

### Surfaces

| Surface | Name | Description |
|---|---|---|
| Slash command | `/analysis-intention` | Entry point. Detects current state (empty / non-empty / no workspace). |
| Tool (LLM) | `start_analysis_intention` | Returns the interview protocol + current state. |
| Tool (LLM) | `save_intention_draft` | Persists the complete Intention, re-renders page, updates registry, commits. |
| Tool (LLM) | `read_intention_draft` | Reads current Intention for inspection. |
| Hook | `session_start` | Muted one-line tip when no intention exists. |
| Hook | `before_agent_start` | Small hint in dynamic context when intention is empty. |

### Interview protocol

The LLM drives the interview by calling `ask_user` (from the vendored `pi-ask-user` extension) one question at a time:

1. **Before asking** — gather context from `sources/**/*.sql`, `.cmux/workspace.json`, and the dynamic context.
2. **One focused question per turn** — never multi-part.
3. **Cumulative** — reference prior answers, revise as needed.
4. **Refine questions** — reword, narrow, or split based on context.
5. **Suggest answers** — use `ask_user`'s `context` field to recommend and let the user override.
6. **Field order**: goal → questions → stakeholders → successCriteria → dashboardOptions → assumptions → openQuestions.
7. **Stop condition**: goal + ≥1 question + ≥1 stakeholder + ≥1 success criterion minimum.
8. **Finish**: call `save_intention_draft`.

### Intention data shape (preserved)

```json
{
  "goal": "string",
  "questions": ["string"],
  "stakeholders": ["string"],
  "successCriteria": ["string"],
  "dashboardOptions": ["string"],
  "assumptions": ["string"],
  "clarifications": [{ "question": "string", "answer": "string" }],
  "openQuestions": ["string"]
}
```

`aiEnrichment` is dropped — the LLM is doing the enrichment in-session now.

## Files

| File | Purpose |
|---|---|
| `.pi/extensions/analysis-intention/index.ts` | Extension entry point — registers tools, command, hooks |
| `.pi/extensions/analysis-intention/intention.ts` | `Intention` type, `emptyIntention()`, `isEmptyIntention()`, `renderIntentionBullets()` |
| `.pi/extensions/analysis-intention/page-render.ts` | Faithful port of CLI's `render_analysis_page` |
| `.pi/extensions/analysis-intention/registry-update.ts` | Read/write `.cmux/workspace.json` and `.cmux/registry.json` |
| `.pi/extensions/analysis-intention/interview-protocol.md` | Full protocol text returned by `start_analysis_intention` |
| `.pi/extensions/analysis-intention/package.json` | Private package with peerDeps |
| `.pi/extensions/analysis-intention/README.md` | Extension documentation |
| `.pi/extensions/pi-ask-user/` | Vendored `edlsh/pi-ask-user` v0.11.2 — provides `ask_user` tool |
| `.pi/package.json` | Updated to include both new extensions |

## CLI changes

Removed from `bin/cmux-evidence`:
- `THINKING_LEVELS`
- `prompt_multiline`, `prompt_yes_no`
- `dedupe_append`
- `source_catalog_for_prompt`
- `load_json_object`, `pi_agent_dir`
- `load_pi_default_ai_model`, `select_onboarding_ai`
- `extract_json_object`, `evidence_capability_brief`
- `ai_intention_suggestions`
- `json_string_list`, `accept_suggestions`
- `collect_analysis_intention`

Updated `new_analysis` to pass `intention: {}` directly instead of calling `collect_analysis_intention`.

`prompt_line` is kept — it's still used for the title prompt in `new_analysis`.

## Session-start behavior

- Muted `info` notification: "No analysis intention captured. Type /analysis-intention to start one."
- Shown once per session via a module-level state flag.
- Not shown on `/reload`.

## Dynamic context behavior

- `.pi/extensions/evidence-context.ts` already reads `.cmux/workspace.json` on every turn.
- If `intention` is empty, a small hint is appended: "This workspace has no captured intention yet."
- No changes needed to `evidence-context.ts` for the basic flow (the `before_agent_start` hook in `analysis-intention` handles this).

## Non-goals (v1)

- No visual change to the generated Workspace Brief Markdown.
- No new CLI flags or subcommands.
- No migration of existing worktrees' `intention` content.
- No telemetry / analytics.
- No auto-push.
- No "AI enrichment audit trail" (dropped in new flow).
