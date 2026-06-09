# Patch: `evidence` Additions

Apply this small addition to the existing `evidence/SKILL.md`.

The `evidence` skill should remain focused on Evidence mechanics, component patterns, SQL/component pairing, formatting, and documentation lookup. Do **not** turn it into the full BI-thinking skill.

---

## 1. Add after `## Core Patterns`

### Location

Find:

```markdown
## Core Patterns
```

Immediately after it, before `### 1. Charts First`, insert:

```markdown
### 0. Insight Before Components

Before choosing an Evidence component, ask what the chart or KPI is supposed to reveal.

For substantial dashboard/report work, use `evidence-bi-thinking` before implementation to generate an Insight Candidate Scan and Report Design Plan.

Every major visual should have:

- a question it answers;
- an analytical move such as trend, comparison, concentration, distribution, benchmark, outlier, funnel, cohort, seasonality, or drilldown;
- a reader takeaway;
- a reason it belongs in the report.

Then use this `evidence` skill to implement the chosen components with documentation-verified syntax.
```

---

## 2. Add one gotcha

### Location

Find `## Common Gotchas`.

Add:

```markdown
7. **Dashboard feels generic?** → Do not add random charts. Use `evidence-bi-thinking` to generate insight candidates, choose an analytical move, and then implement the best sections with Evidence components.
```

If the Gotchas list numbering changes, adjust the number accordingly.
