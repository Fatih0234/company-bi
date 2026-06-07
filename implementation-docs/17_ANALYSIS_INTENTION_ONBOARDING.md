# Step 17: Analysis Intention Onboarding

> **⚠️ REPLACED BY STEP 21.** The CLI interview has been moved into an in-session Pi extension.
> See `implementation-docs/21_IN_SESSION_ANALYSIS_INTENTION.md` for the current design.
> This file is kept as a historical record.

## Goal

Every generated Evidence analysis workspace should begin with an analytical brief, not just branch/worktree metadata.

The brief is stored durably in `.cmux/workspace.json` under `intention`. The passive `.pi/extensions/evidence-context.ts` extension reads that metadata before each user turn, so future Pi sessions in the same workspace receive the same analytical direction. `.cmux/pi-context.md` is only a legacy/fallback snapshot.

## Captured fields

```json
{
  "intention": {
    "goal": "...",
    "questions": ["..."],
    "stakeholders": ["..."],
    "successCriteria": ["..."],
    "dashboardOptions": ["..."],
    "assumptions": ["..."],
    "clarifications": [
      { "question": "...", "answer": "..." }
    ],
    "openQuestions": ["..."]
  }
}
```

## Terminal onboarding flow

`cmux-evidence new` now asks for:

1. Analysis title, when omitted.
2. Main goal.
3. Specific dashboard questions, one per line.
4. Stakeholders/audience, one per line.
5. Success criteria, one per line.
6. Optional AI enrichment.
7. Final confirmation before worktree creation.

Non-interactive execution keeps an empty intention object so scripts do not block.

## AI enrichment

When the user opts in, the command uses the project/Pi configured default AI settings automatically. There is no model-selection prompt in the onboarding flow.

The configured provider/model/thinking values are passed to Pi headlessly:

```bash
pi -p --no-session --provider <provider> --model <model> --thinking <level> --no-tools <prompt>
```

The prompt includes:

- User-provided goal/questions/stakeholders/success criteria.
- A safe Evidence data catalog derived from `sources/*/*.sql`.
- A strict JSON response schema.

The model may suggest:

- Additional dashboard questions.
- Evidence-buildable dashboard/report directions.
- Additional success criteria.
- Assumptions to record.
- Clarifying questions.

The prompt includes an Evidence capability brief so suggestions are grounded in what Evidence can realistically build: Markdown pages, SQL queries, BigValue KPIs, LineChart/BarChart, DataTable, Grid layouts, and simple input-driven interactivity such as Dropdown filters. It also tells the model to avoid generic BI/app features that would require heavy custom frontend work.

The user accepts suggestions with a numbered multi-select prompt. Clarifying questions can be answered immediately or stored as open questions.

## Context and dashboard generation

The durable source of truth is `.cmux/workspace.json`.

The generated analysis page also includes a visible `Workspace Brief` section derived from the same intention metadata:

- goal
- questions
- stakeholders/audience
- success criteria
- proposed dashboard direction
- assumptions
- clarifications
- open questions
- build checklist

This makes the onboarding brief visible to the user inside the Evidence app, not only hidden in Pi context. Pi should keep the page brief aligned with `.cmux/workspace.json` when the user's goal changes.

`render_pi_context` still includes an `Analysis intention` section when workspace metadata contains a non-empty intention, but `.cmux/pi-context.md` is only a legacy/fallback snapshot. The authoritative every-turn path is `.cmux/workspace.json` consumed by `.pi/extensions/evidence-context.ts`.

## Safety

- The AI enrichment prompt uses source SQL files only, not `.env*` or `connection.yaml`.
- The headless Pi call uses `--no-tools` and `--no-session`.
- Onboarding uses the configured Pi/default AI settings automatically and does not prompt the user to choose a model.
- The worktree is created only after the final intention confirmation.
- `cmux-evidence new --no-open` can create/test a workspace without opening CMUX.
