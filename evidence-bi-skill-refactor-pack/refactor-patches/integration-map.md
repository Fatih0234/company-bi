# Integration Map

This file explains how the skills should work together after the refactor.

## Final skill roles

```text
evidence
  Evidence syntax, components, SQL/component pairing, docs lookup, basic patterns.

evidence-dashboard
  Workspace workflow, report-building phases, CMUX preview, validation, draft/report page conventions.

evidence-bi-thinking
  Insight candidate generation, analytical moves, report archetypes, narrative arc, visual hierarchy.

evidence-dashboard-review
  Read-only review, BI/product critique, insight quality, visual quality, Evidence runtime QA.
```

## Desired workflow

```text
1. Question Orientation
2. Data Analysis
3. Findings Synthesis
4. Insight Candidate Scan       ← new required layer
5. Report Story Planning
6. Evidence Documentation Lookup
7. Report Creation
8. Dashboard Review
```

## When to invoke `evidence-bi-thinking`

Use it when:

- building a report, not just exploring in draft;
- revising a substantial section;
- the user asks for better charts, nicer dashboard, stronger report, story, insights, or analysis;
- the dashboard feels bland, shallow, table-heavy, or generic;
- choosing chart ideas before implementation.

Do not use it for:

- isolated syntax fixes;
- simple component prop lookup;
- runtime debugging;
- credential/source connector work;
- tiny copy edits.

## Where the handoff happens

`evidence-dashboard` owns the overall workflow.

At the start of Phase 4, it should require an `Insight Candidate Scan` from `evidence-bi-thinking` before writing the final `Report Plan`.

After Phase 4, `evidence-dashboard` returns to normal Evidence implementation workflow:

- look up docs;
- test SQL;
- write components;
- validate;
- inspect preview.

## Review loop

`evidence-dashboard-review` should now check:

- Does the dashboard answer the business goal?
- Does it have useful insight moves?
- Are charts selected for analytical value?
- Does it avoid generic tables and shallow top-N charts?
- Does it provide interpretation and implications?
- Does Evidence render correctly?
