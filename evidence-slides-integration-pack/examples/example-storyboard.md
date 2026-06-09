# Slide Storyboard: Revenue Quality by Segment

## Audience and density

- Audience: executive operating review
- Density: low-density / speaker-led
- Goal: communicate the answer quickly and support a planning decision

## Source material

- `pages/report.md`
- `queries/segment_quality.sql`
- `queries/revenue_trend.sql`
- `reports/revenue-quality-by-segment/slides/assets/segment-mix.png`

## Core answer

Enterprise renewals are carrying durable growth, while low-margin mid-market expansion is diluting revenue quality.

## Slide outline

### Slide 1 — Which growth is worth funding?

- Purpose: title and business question
- Main message: not all revenue growth is equally valuable
- Evidence: report title and workspace goal
- Visual: clean title with subtle segment labels
- Speaker/readout notes: frame this as a planning question
- Caveats: none

### Slide 2 — The answer: protect enterprise renewals, fix mid-market margin

- Purpose: executive answer
- Main message: enterprise renewals are strong; mid-market expansion needs guardrails
- Evidence: `story.json` findings 1 and 2
- Visual: two-column answer card
- Speaker/readout notes: state recommendation early
- Caveats: last month directional

### Slide 3 — Growth is up, but quality is mixed

- Purpose: show the headline pattern
- Main message: total revenue growth hides segment-level quality differences
- Evidence: revenue trend chart
- Visual: chart screenshot with one annotation
- Speaker/readout notes: explain why total revenue is insufficient
- Caveats: latest month pending backfill

### Slide 4 — Enterprise renewals carry the durable base

- Purpose: finding 1
- Main message: enterprise renewal performance is the strongest quality signal
- Evidence: `queries/segment_quality.sql`
- Visual: segment quality matrix
- Speaker/readout notes: connect to retention and margin stability
- Caveats: cohort definitions need RevOps confirmation

### Slide 5 — Mid-market expansion is the dilution risk

- Purpose: finding 2
- Main message: mid-market growth is real but lower quality
- Evidence: `segment-mix.png`
- Visual: mix trend with margin annotation
- Speaker/readout notes: do not say "stop mid-market"; say add guardrails
- Caveats: latest month directional

### Slide 6 — Recommendation

- Purpose: action slide
- Main message: fund enterprise renewal expansion and add margin thresholds to mid-market campaigns
- Evidence: findings 1 and 2
- Visual: action matrix
- Speaker/readout notes: assign owner and next planning cycle
- Caveats: depends on RevOps validation

### Slide 7 — Caveats and next checks

- Purpose: decision limits
- Main message: recommendation is strong, but the final month and cohort labels need validation
- Evidence: report caveats
- Visual: checklist
- Speaker/readout notes: invite validation, not delay
- Caveats: explicit

## Evidence assets needed

- `assets/revenue-trend.png`
- `assets/segment-quality.png`
- `assets/segment-mix.png`

## Visual style direction

Executive Slate: calm, leadership-ready, high trust, low density.

## Validation plan

- Confirm deck opens.
- Navigate all slides.
- Check chart readability.
- Confirm caveats are visible.
- Run `./bin/cmux-evidence validate`.
