# Slide Story Patterns

This reference helps convert a BI story into a presentation outline.

## General rule

A dashboard is spatial. A deck is sequential.

Do not place every chart from the report into slides. Choose only the evidence required to advance the story.

## Density modes

### Speaker-led

Use when the user will present live.

- One idea per slide.
- 1-3 bullets max.
- More slides, less text.
- Large chart or single KPI.
- Strong titles that say the point.
- Speaker notes can carry nuance.

### Reading-first

Use when the deck will be sent async.

- More self-contained slides.
- Tables and small multiples allowed when readable.
- 4-8 bullets or 4-6 cards max.
- Include caveats and captions on slides.
- More source notes.

## Pattern 1 — Executive answer deck

Use for: leadership, board, operating review.

```text
1. Title / business question
2. Executive answer
3. Why the answer matters
4. Evidence exhibit 1
5. Evidence exhibit 2
6. Evidence exhibit 3 or exception
7. Recommendation
8. Risks and caveats
9. Appendix / method
```

## Pattern 2 — Diagnostic narrative

Use for: analyst review, root-cause analysis.

```text
1. What we investigated
2. The headline pattern
3. Baseline metric
4. Segment / cohort split
5. Time trend
6. Driver analysis
7. Counterexample or risk
8. What this changes
9. Next checks
10. Appendix
```

## Pattern 3 — Decision memo deck

Use for: recommending an action.

```text
1. Decision needed
2. Recommendation in one sentence
3. Supporting finding 1
4. Supporting finding 2
5. Tradeoff / caveat
6. Expected impact
7. Implementation next steps
8. Ask / owner / timeline
```

## Pattern 4 — Customer-facing readout

Use for: external or semi-external stakeholders.

```text
1. Context and purpose
2. What we learned
3. Key takeaway
4. Evidence snapshot
5. Implication for the customer
6. Recommended next step
7. Collaboration plan
8. Appendix / methodology
```

## Slide title rules

Slide titles should make claims.

Weak:

> Segment Analysis

Strong:

> Enterprise renewals carry the growth story; mid-market expansion dilutes margin

Weak:

> Revenue Trend

Strong:

> Revenue accelerated in Q2, but the mix shift explains most of the lift

## Evidence slide anatomy

A strong evidence slide includes:

- claim title,
- chart/table/screenshot,
- 1-2 annotations,
- one "so what",
- concise source/caveat footer.

Example structure:

```text
[Finding 02] Segment mix is changing faster than total revenue suggests

[Large chart screenshot]

Callout 1: Enterprise renewals are stable
Callout 2: Mid-market expansion rose 18pp

So what: Growth quality depends on whether mid-market margin improves.

Footer: Source: queries/segment_mix.sql; report section "Mix shift"
```

## Recommendation slide anatomy

A recommendation slide includes:

- action,
- why now,
- expected benefit,
- caveat/risk,
- next owner.

Avoid vague "monitor" unless the evidence does not justify action.
