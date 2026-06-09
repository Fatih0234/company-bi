# Implementation Prompt for the Refactoring Agent

You are editing an existing skill system for an Evidence.dev BI/dashboard app.

Your task is to apply a small prompt/skill refactor. **Do not rewrite the existing skills from scratch.** Edit the current files in place and preserve all existing useful content.

## Goal

Add a new skill called `evidence-bi-thinking` and wire it into the existing Evidence dashboard workflow.

The current skills already handle Evidence syntax, docs lookup, SQL/component pairing, CMUX workspace behavior, preview validation, and dashboard review. The missing layer is analytical BI judgment: generating useful chart/report ideas before implementation.

The new system should make the agent think:

- What is actually worth showing?
- Should we show top-N, top 10%, Pareto concentration, distribution, outliers, cohorts, funnels, segment comparison, benchmark, change driver, or risk/opportunity quadrants?
- What is the narrative arc?
- What should become a KPI, chart, filter, table, caveat, or drilldown?
- Does each chart answer a real question?

## Files in this package

Use these files as the source of truth:

```text
new-files/skills/evidence-bi-thinking/SKILL.md
new-files/skills/evidence-bi-thinking/references/analysis-moves.md
new-files/skills/evidence-bi-thinking/references/evidence-component-mapping.md
new-files/skills/evidence-bi-thinking/references/query-patterns.md
new-files/skills/evidence-bi-thinking/references/report-archetypes.md
new-files/skills/evidence-bi-thinking/references/dashboard-anti-patterns.md

refactor-patches/evidence-dashboard.ADDITIONS.md
refactor-patches/evidence-dashboard-review.ADDITIONS.md
refactor-patches/evidence.ADDITIONS.md
refactor-patches/integration-map.md
```

## Step-by-step instructions

### Step 1 — Add the new skill folder

Copy:

```text
new-files/skills/evidence-bi-thinking/
```

into the app's skills directory next to the existing `evidence`, `evidence-dashboard`, and `evidence-dashboard-review` skills.

Do not rename the skill unless the project already has a naming convention that requires it. If renaming is necessary, update all references consistently.

### Step 2 — Patch `evidence-dashboard`

Open the existing `evidence-dashboard/SKILL.md`.

Apply the additions from:

```text
refactor-patches/evidence-dashboard.ADDITIONS.md
```

Important placement rules:

1. Add `evidence-bi-thinking` to the **Related skills** list.
2. Insert the **Insight Candidate Scan** requirement at the start of Phase 4, before the existing Report Plan template.
3. Extend the Report Plan template rather than replacing it completely.
4. Add the substantial-revision rule to the revision workflow.
5. Preserve all existing CMUX, workspace, data-access, validation, and communication instructions.

### Step 3 — Patch `evidence-dashboard-review`

Open the existing `evidence-dashboard-review/SKILL.md`.

Apply the additions from:

```text
refactor-patches/evidence-dashboard-review.ADDITIONS.md
```

Important placement rules:

1. Add `evidence-bi-thinking` to the related skill behavior if a related-skills section exists, or add a short section after First Steps.
2. Insert the new **Insight quality and analytical depth** checklist inside the Review checklist.
3. Add the optional **Insight Review** section to the output format.
4. Preserve the default read-only review posture.

### Step 4 — Optionally patch `evidence`

Open the existing `evidence/SKILL.md`.

Apply the small addition from:

```text
refactor-patches/evidence.ADDITIONS.md
```

This patch is intentionally short. The `evidence` skill should remain the Evidence mechanics and component-pattern skill, not the creative BI planning skill.

### Step 5 — Check idempotency

Before saving, check whether similar text already exists. Do not duplicate entire sections.

If the exact section already exists, skip it.
If a similar section exists, merge the new guidance into it.

### Step 6 — Final verification

After editing, verify the intended flow is clear:

```text
Question Orientation
→ Data Analysis
→ Findings Synthesis
→ Insight Candidate Scan
→ Report Story Planning
→ Documentation Lookup
→ Report Creation
→ Dashboard Review
```

The final skills should make it hard for the agent to jump directly from data to a generic chart. It should first generate insight candidates, choose a report archetype, and design the story.

## Non-goals

Do not:

- rewrite the existing skills wholesale;
- remove Evidence documentation-first behavior;
- remove CMUX preview/validation behavior;
- modify app source code;
- modify Evidence pages;
- modify data sources;
- create new runtime tools;
- change credentials or connection files.

## Success criteria

The refactor is successful when:

1. A new `evidence-bi-thinking` skill exists with references.
2. `evidence-dashboard` explicitly invokes it before Phase 4 report planning.
3. `evidence-dashboard-review` critiques insight quality and analytical depth.
4. The base `evidence` skill keeps its syntax/component focus.
5. The next agent has a concrete framework for producing more interesting Evidence reports.
