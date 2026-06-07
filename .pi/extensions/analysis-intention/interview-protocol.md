# Analysis Intention Interview Protocol

## Philosophy

This interview is a creative, collaborative session. The user may not have a clear analysis idea — your job is to **surface possibilities** from the data sources, then **guide them** to a focused, actionable brief. Think of yourself as a data-savvy analyst suggesting angles, not a form-filling clerk.

## Before you ask anything

1. **Read the workspace context** — `read` `.cmux/workspace.json` to get the title, slug, and any prior intention.
2. **Read the source catalog** — `read` all `sources/**/*.sql` files. Build a mental model of:
   - What tables/entities exist
   - What time fields, measures, dimensions, and categorical fields are available
   - What natural questions this data can answer
3. **Synthesize a brief context summary** — 3-5 bullets of what the data contains and what natural analyses it supports.
4. **Pass this summary** in the `context` field of `ask_user` so the user sees it before every question.

## Asking questions — the golden rules

### Always suggest options

Never ask a blank open-ended question like "What do you want to analyze?"

Instead, use the data context to suggest **3-4 concrete analysis angles** as options, plus a freeform option. For example:

> Based on your TLC taxi data (yellow/green trips, zones, fares, times), here are some analysis directions:
> - **A.** Compare yellow vs green taxi performance across NYC zones
> - **B.** Identify peak revenue hours and underserved pickup areas  
> - **C.** Analyze tip patterns by payment type and borough
> - **D.** Something else — describe your own idea

Use `allowMultiple: true` when the field naturally supports multiple answers (questions, stakeholders, success criteria, dashboard options). Use `allowMultiple: false` (default) for the single goal.

### One focused question per turn

- Ask exactly one field per `ask_user` call.
- Never bundle "goal AND questions AND stakeholders" into one call.
- Never ask numbered sub-questions inside one call.

### Cumulative and refining

Each turn, reference prior answers. If the user said "compare yellow vs green taxis" in the goal, your question suggestions for the next field should be about that comparison, not generic.

### Suggest answers when appropriate

If you can infer a reasonable answer from the data context, pre-populate it in the `context` field:

> "Given the 3-month TLC slice with zone and time data, my suggestion is to focus on revenue comparison by borough. Confirm or override."

### Field order

1. **Goal** (single select, `allowMultiple: false`) — the overarching analysis question
2. **Specific questions** (multi-select, `allowMultiple: true`) — 2-5 concrete questions the dashboard should answer
3. **Stakeholders** (multi-select, `allowMultiple: true`) — who will use this dashboard
4. **Success criteria** (multi-select, `allowMultiple: true`) — how we know the analysis succeeded
5. **Dashboard options** (multi-select, `allowMultiple: true`) — what visualizations and components to include
6. **Assumptions** (multi-select, `allowMultiple: true`) — what we're assuming about the data
7. **Open questions** (multi-select, `allowMultiple: true`) — anything we need to clarify later

## After the core fields are captured

### Final suggestions step

Before calling `save_intention_draft`, review the assembled brief and suggest **2-3 additional angles** the user might have missed. Use `ask_user` with `allowMultiple: true`:

> "Here's your analysis brief so far: [summary].
>
> Given your data, you might also want to consider:
> - **A.** Adding a revenue trend time-series to show seasonal patterns
> - **B.** Including payment type breakdown (cash vs card) as a filter dimension
> - **C.** Comparing weekend vs weekday patterns for the zone analysis
> - **D.** None of these — I'm ready to save"
>
> Which would you like to add?"

If the user selects any, merge them into the appropriate fields (questions, dashboard options, etc.) before saving.

### Stop condition

Minimum: goal + ≥1 question + ≥1 stakeholder + ≥1 success criterion.  
Ideally: all fields populated, including the final suggestions step.

## Saving

When the brief is complete, call `save_intention_draft` with the full `Intention` object. Never write files directly.

## Multi-select return handling

When `allowMultiple: true` is used, the user may return multiple selections. Parse them as an array of strings and merge into the appropriate Intention field (which is already an array).

## Example flow

```
Turn 1: Context gathering (read sources, build summary)
Turn 2: ask_user — Goal (single select, with 4 suggestions from data context)
Turn 3: ask_user — Questions (multi-select, with 4 suggestions tied to the chosen goal)
Turn 4: ask_user — Stakeholders (multi-select, with common options)
Turn 5: ask_user — Success criteria (multi-select, with suggestions)
Turn 6: ask_user — Dashboard options (multi-select, with visualization suggestions)
Turn 7: ask_user — Assumptions (multi-select, suggest data-quality assumptions)
Turn 8: ask_user — Final suggestions (multi-select, 3 new angles + "none")
Turn 9: save_intention_draft
```
