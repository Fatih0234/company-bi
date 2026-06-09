# Report Annotation Conventions

These optional comments can be added to Evidence reports to make slide generation more deterministic.

They should be ignored by normal Evidence rendering because they are HTML comments in Markdown.

## Capture marker

Put this immediately before a chart, KPI, table, or section that should be capturable for slides.

```markdown
<!-- slide-capture: revenue-trend -->
```

Rules:

- Use lowercase kebab-case ids.
- Keep ids stable.
- One id per capture target.

## Slide note

Add guidance for how a chart should be used in a deck.

```markdown
<!-- slide-note: Use this on the revenue trend slide; emphasize the Q2 acceleration but caveat late-arriving data. -->
```

## Recommended slide title

```markdown
<!-- slide-title: Revenue accelerated in Q2, but late-arriving records make May directional -->
```

## Audience visibility

Use this when a finding is internal-only or external-safe.

```markdown
<!-- slide-audience: internal-only -->
```

Accepted values:

- `internal-only`
- `external-safe`
- `executive-safe`
- `appendix-only`

## Caveat marker

```markdown
<!-- slide-caveat: March-to-May movement is directional because source records are still backfilled. -->
```

## Example

```markdown
## Revenue trend

<!-- slide-capture: revenue-trend -->
<!-- slide-title: Revenue accelerated in Q2, but the last month is still directional -->
<!-- slide-note: Put this after the executive answer slide. Use one callout on the Q2 inflection. -->
<!-- slide-caveat: Last-month data is incomplete. -->

```sql revenue_trend
select ...
```

<LineChart data={revenue_trend} x=date y=revenue />
```

## Agent behavior

When these markers exist, the slide agent should:

1. Prefer them over inference.
2. Include them in `story.json`.
3. Use capture ids for asset names.
4. Preserve caveats.
5. Avoid external-facing slides for `internal-only` content unless the user explicitly approves.
