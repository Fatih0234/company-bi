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
- Review the dashboard's analytical depth, not only its Evidence syntax or visual rendering.
- Ask whether the report reveals something decision-relevant, non-obvious, or actionable.
- Use `evidence-bi-thinking` as the reference frame when judging whether the report has strong analytical moves and a coherent story.

## First steps

1. Use the injected dynamic Evidence context as the current workspace brief.
2. Run or ask the user to run `/workspace-summary` when you need a quick page-state summary.
3. Inspect the **Brief** page (primary page) from `.cmux/workspace.json` or dynamic context.
4. Inspect the **Draft** page for exploration quality and work-in-progress.
5. Inspect the **Report** page if it exists for polished dashboard quality.
- Check whether the report has an Insight Candidate Scan or Report Plan in the Draft page. If not, infer the missing plan from the current report and call out where the dashboard may have jumped directly from data to charts.
6. Inspect safe source SQL files only when metric meaning or data availability affects the review.
7. Use CMUX preview helpers when visible rendering matters.

Useful commands use the workspace helper shown in dynamic context. In content-only workspaces this is usually an absolute runtime helper path because `./bin/cmux-evidence` does not exist in the content workspace.

```bash
<workspace-helper> preview-url
<workspace-helper> browser-surfaces
<workspace-helper> preview-snapshot <surface-ref>
<workspace-helper> preview-screenshot <surface-ref> /tmp/evidence-preview.png
<workspace-helper> validate
```

## Review checklist

### Business alignment

- Does the **Brief** page clearly state the workspace goal and intention?
- Does the **Draft** page have productive exploration toward the goal?
- Does the **Report** page (if it exists) clearly answer the workspace goal?
- Are the stated questions addressed by visible sections?
- Are stakeholders and success criteria reflected in the dashboard design?
- Are open questions or caveats visible where needed?

### Content completeness

- Is starter placeholder content still present?
- Does the page include KPIs, trends, breakdowns, and detail tables where appropriate?
- Are filters useful and not merely decorative?
- Are empty/low-value sections removed or explained?

### Insight quality and analytical depth

- Does the dashboard reveal something non-obvious or decision-relevant?
- Does each major chart answer a clear business question?
- Is there a coherent story arc, or is the page just a list of charts?
- Are top-N charts contextualized with share of total, change, benchmark, or drilldown?
- If averages are used, is there a distribution, median, percentile, or caveat when skew may matter?
- If time exists, does the dashboard show trend, change, seasonality, or before/after comparison where useful?
- If entities exist, does the dashboard consider concentration, outliers, or high-value segments?
- If stages/statuses exist, does the dashboard consider funnel or drop-off analysis?
- If multiple meaningful dimensions exist, does the dashboard compare segments rather than only showing totals?
- Are filters purposeful and tied to decisions, not merely decorative?
- Is there at least one deeper analytical move when the data supports it: concentration, distribution, outlier, benchmark, driver, cohort, funnel, seasonality, or risk/opportunity view?
- Does the narrative interpret the chart and explain why it matters?

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
- Does the dashboard avoid a wall of tables?
- Does it avoid generic chart titles that only describe the axes?
- Does it avoid giving every section equal visual weight?
- Does it avoid charts that exist only because they were easy to make?

### Evidence/runtime quality

- Does `<workspace-helper> validate` pass when completion quality matters?
- Does the CMUX browser preview render without Evidence errors?
- Are there blank charts, missing query results, or obvious layout problems?

## Output format

Prefer this structure:

```text
## Review Summary

Overall: <1-2 sentence judgment>

## What works
- ...

## Insight quality
- Strongest analytical move: ...
- Missing analytical opportunity: ...
- Suggested next insight to add: ...

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

When the requested improvements are about analytical depth, story, chart choice, or dashboard usefulness, first use `evidence-bi-thinking` to generate or revise the Insight Candidate Scan, then switch to `evidence-dashboard` for implementation.
