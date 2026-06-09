# Evidence BI Thinking Skill Refactor Pack

This pack prepares a small refactor for an existing Evidence-dashboard skill system.

It adds one new skill:

```text
skills/evidence-bi-thinking/
```

and provides patch files for the existing skills:

```text
refactor-patches/evidence-dashboard.ADDITIONS.md
refactor-patches/evidence-dashboard-review.ADDITIONS.md
refactor-patches/evidence.ADDITIONS.md
```

The intent is **not** to rewrite the existing skills. The next agent should edit the current files in place and insert the new sections where specified.

## Why this pack exists

The existing skill set already covers Evidence mechanics: documentation lookup, Evidence components, SQL/component pairing, CMUX workspace behavior, preview inspection, validation, and dashboard review.

The missing layer is BI judgment: the instinct to ask whether the report should show top-decile concentration, outliers, trend breaks, distribution, benchmarks, cohorts, funnels, risk/opportunity quadrants, or drilldown paths before choosing charts.

This pack adds that missing layer as `evidence-bi-thinking`.

## Included structure

```text
evidence-bi-skill-refactor-pack/
├── README.md
├── IMPLEMENTATION_PROMPT.md
├── MANIFEST.md
├── new-files/
│   └── skills/
│       └── evidence-bi-thinking/
│           ├── SKILL.md
│           └── references/
│               ├── analysis-moves.md
│               ├── dashboard-anti-patterns.md
│               ├── evidence-component-mapping.md
│               ├── query-patterns.md
│               └── report-archetypes.md
└── refactor-patches/
    ├── evidence.ADDITIONS.md
    ├── evidence-dashboard.ADDITIONS.md
    ├── evidence-dashboard-review.ADDITIONS.md
    └── integration-map.md
```

## Implementation order

1. Copy the new `evidence-bi-thinking` folder into the skills directory used by your app.
2. Patch `evidence-dashboard` so it invokes `evidence-bi-thinking` before Phase 4 Report Story Planning.
3. Patch `evidence-dashboard-review` so it reviews insight quality, not only chart/layout/runtime quality.
4. Optionally patch `evidence` with a short “Insight Before Components” rule.
5. Run a quick consistency check: there should now be a flow from analysis → insight candidate scan → report plan → Evidence implementation → review.

## Important implementation rule

Do **not** replace the existing skill files wholesale. Insert the snippets from `refactor-patches/` into the existing files at the indicated locations.

## Expected final skill roles

```text
evidence
  Evidence syntax, component patterns, SQL/component pairing, docs lookup.

evidence-dashboard
  Workspace workflow, CMUX behavior, draft/report pages, validation, build process.

evidence-bi-thinking
  Analytical moves, insight candidate generation, report archetypes, story design, visual hierarchy.

evidence-dashboard-review
  Read-only review, dashboard QA, insight quality, visual quality, Evidence runtime validation.
```
