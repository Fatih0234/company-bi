# Patch: `evidence-dashboard` Additions

Apply these additions to the existing `evidence-dashboard/SKILL.md`.

Do **not** rewrite the file. Insert the snippets in the indicated locations.

---

## 1. Add to Related Skills

### Location

Find the existing `## Related skills` section.

Add this bullet near `evidence-data-semantics`, before CMUX-specific skills if possible:

```markdown
- `evidence-bi-thinking` — use before Phase 4 Report Story Planning when deciding what is worth showing, generating insight candidates, choosing report archetypes, designing narrative arc, and selecting analytical moves such as top-N, top-percent, trend, distribution, outlier, benchmark, funnel, cohort, seasonality, and risk/opportunity views.
```

---

## 2. Add a required Phase 4 pre-step

### Location

Find:

```markdown
### Phase 4: Report Story Planning

This is the critical creative phase. Before writing any Evidence page, plan how the report should look.
```

Immediately after that opening paragraph, insert:

```markdown
### Required pre-step: Insight Candidate Scan

Before writing the Report Plan, use `evidence-bi-thinking` to generate an **Insight Candidate Scan**.

Do not merely map existing queries to charts. First ask what would be useful, surprising, decision-relevant, or visually revealing.

Consider analytical moves such as:

- top-N ranking
- top 10% / top-decile contribution
- Pareto / cumulative share
- period-over-period change
- change drivers
- distribution checks
- outlier detection
- segment comparison
- benchmark vs average, median, target, or peer group
- funnel drop-off
- cohort comparison
- seasonality heatmap
- mix shift
- risk/opportunity quadrant
- scoped drilldown table

Write this section in `pages/draft.md` before the Report Plan:

```text
## Insight Candidate Scan

| Candidate | Analytical move | Business question | Query shape | Likely Evidence component | Why it matters | Decision |
|---|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... | keep / explore / drop |
```

Use the scan to decide what belongs in the polished report, what should be explored in draft, and what should be dropped as noise.
```

---

## 3. Extend the existing Report Plan template

### Location

Find the existing Report Plan template in Phase 4.

Do not remove it. Add these fields to the template before `### Section 1`:

```markdown
### Report archetype
Executive dashboard / diagnostic report / opportunity report / monitoring dashboard / deep dive / entity detail page / other

### Primary question
[One sentence — what this report answers]

### Headline answer to seek
[The answer or decision the report should make easier]

### Story arc
1. [Top-level KPI or headline]
2. [Main trend or status]
3. [Driver, segment, or comparison]
4. [Deeper analytical move: concentration / outlier / distribution / benchmark / cohort / funnel / etc.]
5. [Drilldown, caveat, or next action]
```

Then add this field inside each section block:

```markdown
- Analytical move: [top-N / trend / distribution / benchmark / outlier / etc.]
- Why this section exists: [What decision or understanding it supports]
```

---

## 4. Add Report Plan quality rules

### Location

At the end of Phase 4 `Rules`, add:

```markdown
- A Report Plan must be based on the Insight Candidate Scan, not just available queries.
- Every planned chart must answer a named question.
- At least one planned section should use a deeper analytical move when the data supports it: concentration, distribution, outlier, benchmark, change driver, cohort, funnel, seasonality, or risk/opportunity analysis.
- Top-N charts should include context such as share of total, change, benchmark, or drilldown when possible.
- Tables should appear after summary charts unless the user explicitly wants table-first analysis.
```

---

## 5. Add to Phase 6 Quality Bar

### Location

Find Phase 6 `Quality bar`.

Add:

```markdown
- Every major chart has a clear reason to exist: question, chart, interpretation, implication.
- The report includes at least one non-obvious analytical angle when supported by the data.
- The page avoids generic chart dumps and table walls.
- Top-level KPIs are contextualized with comparison, share, benchmark, or interpretation where possible.
```

---

## 6. Patch Revision Workflow

### Location

Find `### Revision workflow`.

Add after the current substantial-change rule:

```markdown
- If the revision is about making the dashboard more useful, more visual, more analytical, or more story-driven, use `evidence-bi-thinking` before editing. Generate a short Insight Candidate Scan for the affected sections, then revise the plan and implementation.
```

---

## 7. Optional addition to Workflow Summary

### Location

Find the workflow summary block.

Change it from:

```text
Phase 3: Findings Synthesis      → "Here's what I discovered" [CHECKPOINT]
Phase 4: Report Story Planning   → "Here's how the report should look" [CHECKPOINT]
```

To:

```text
Phase 3: Findings Synthesis      → "Here's what I discovered" [CHECKPOINT]
Phase 3.5: Insight Candidate Scan → "Here's what could be worth showing"
Phase 4: Report Story Planning   → "Here's how the report should look" [CHECKPOINT]
```

If you prefer not to renumber phases, call it a required pre-step inside Phase 4 instead of Phase 3.5.
