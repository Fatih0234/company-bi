# Patch: `evidence-dashboard-review` Additions

Apply these additions to the existing `evidence-dashboard-review/SKILL.md`.

Do **not** rewrite the file. Insert the snippets in the indicated locations.

---

## 1. Add BI-thinking review posture

### Location

Find `## Review posture`.

Add these bullets:

```markdown
- Review the dashboard's analytical depth, not only its Evidence syntax or visual rendering.
- Ask whether the report reveals something decision-relevant, non-obvious, or actionable.
- Use `evidence-bi-thinking` as the reference frame when judging whether the report has strong analytical moves and a coherent story.
```

---

## 2. Add to First Steps

### Location

Find `## First steps`.

Add this step after inspecting the Report page:

```markdown
- Check whether the report has an Insight Candidate Scan or Report Plan in the Draft page. If not, infer the missing plan from the current report and call out where the dashboard may have jumped directly from data to charts.
```

---

## 3. Add new Review Checklist section

### Location

Inside `## Review checklist`, insert this section after `### Content completeness` and before `### Metric clarity`.

```markdown
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
```

---

## 4. Add anti-pattern checks

### Location

Inside `### Visual and interaction quality`, add:

```markdown
- Does the dashboard avoid a wall of tables?
- Does it avoid generic chart titles that only describe the axes?
- Does it avoid giving every section equal visual weight?
- Does it avoid charts that exist only because they were easy to make?
```

---

## 5. Extend Output Format

### Location

Find the preferred output structure.

Add this optional section between `## What works` and `## Issues / risks`:

```text
## Insight quality
- Strongest analytical move: ...
- Missing analytical opportunity: ...
- Suggested next insight to add: ...
```

If the review is short, merge this into `Issues / risks` instead of making the output too long.

---

## 6. Add edit handoff rule

### Location

At the end of the skill, after the current final sentence about switching back to `evidence-dashboard`, add:

```markdown
When the requested improvements are about analytical depth, story, chart choice, or dashboard usefulness, first use `evidence-bi-thinking` to generate or revise the Insight Candidate Scan, then switch to `evidence-dashboard` for implementation.
```
