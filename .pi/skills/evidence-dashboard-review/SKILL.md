---
name: evidence-dashboard-review
description: Review, critique, QA, and recommend improvements for Evidence dashboards inside CMUX. Use when the user asks if a dashboard looks right, asks for feedback, requests a review, wants quality checks, or asks what to improve next.
---

# Evidence Dashboard Review Skill

Use this skill when acting as a BI/product reviewer for an Evidence dashboard. The default posture is read-only review unless the user explicitly asks you to edit.

## Review posture

- Review as a dashboard collaborator, not only as a code checker.
- Judge whether the dashboard answers the business goal from the injected dynamic context and `.cmux/workspace.json`.
- Prefer concrete findings over generic advice.
- Separate what you verified from what you inferred.
- Do not mutate files unless the user asks for changes.

## First steps

1. Use the injected dynamic Evidence context as the current workspace brief.
2. Run or ask the user to run `/workspace-summary` when you need a quick page-state summary.
3. Inspect the primary page from `.cmux/workspace.json` or dynamic context.
4. Inspect safe source SQL files only when metric meaning or data availability affects the review.
5. Use CMUX preview helpers when visible rendering matters.

Useful commands:

```bash
./bin/cmux-evidence preview-url
./bin/cmux-evidence browser-surfaces
./bin/cmux-evidence preview-snapshot <surface-ref>
./bin/cmux-evidence preview-screenshot <surface-ref> /tmp/evidence-preview.png
./bin/cmux-evidence validate
```

## Review checklist

### Business alignment

- Does the page clearly answer the workspace goal?
- Are the stated questions addressed by visible sections?
- Are stakeholders and success criteria reflected in the dashboard design?
- Are open questions or caveats visible where needed?

### Content completeness

- Is starter placeholder content still present?
- Does the page include KPIs, trends, breakdowns, and detail tables where appropriate?
- Are filters useful and not merely decorative?
- Are empty/low-value sections removed or explained?

### Metric clarity

- Are metrics named in business terms?
- Are numerators, denominators, date grains, and filters understandable?
- Are inferred metrics labeled as assumptions?
- Are ambiguous business definitions called out for the user?

### Visual and interaction quality

- Are chart types appropriate for the question?
- Are dimensions, axes, and labels readable?
- Is the top of the page useful at a glance?
- Are tables sorted and scoped to useful rows?
- Do interactive inputs have clear labels and defaults?

### Evidence/runtime quality

- Does `./bin/cmux-evidence validate` pass when completion quality matters?
- Does the CMUX browser preview render without Evidence errors?
- Are there blank charts, missing query results, or obvious layout problems?

## Output format

Prefer this structure:

```text
## Review Summary

Overall: <1-2 sentence judgment>

## What works
- ...

## Issues / risks
- ...

## Recommended next changes
1. ...
2. ...
3. ...

## Verification
- Files inspected: ...
- Preview checked: yes/no
- Build checked: yes/no
```

When the user asks you to apply improvements, switch back to the main `evidence-dashboard` build/revision workflow and make small, targeted edits.
