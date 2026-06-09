---
name: evidence-slides
description: Create fixed-stage HTML presentation slides from an Evidence BI report or dashboard workspace. Use when a user asks to turn a completed BI analysis, Evidence dashboard, report, findings, or business question into a presentation deck for executives, stakeholders, customers, or internal review.
license: MIT-compatible adaptation notes; review bundled assets before redistribution.
compatibility: Designed for Pi Coding Agent in an Evidence/CMUX content-only workspace with pages/, queries/, reports/, data/, and optional browser preview helpers.
---

# Evidence Slides

Create presentation slides from an Evidence BI analysis workspace.

This skill is for the moment after the BI agent has already produced a useful analysis or report and the user wants to communicate the findings as a presentation.

The output is a self-contained HTML deck, usually written to:

```text
reports/<analysis-slug>/slides/index.html
```

The deck uses a fixed 1920×1080 slide canvas scaled as a whole to the browser viewport.

## Core principles

1. **Report first, slides second.** Do not invent a story without reading the current BI report and workspace context.
2. **Business answer over dashboard dump.** Slides should communicate a decision-ready narrative, not merely screenshot every chart.
3. **Evidence-backed claims.** Every key slide should trace back to report text, a query, a rendered chart, or a caveat.
4. **Fixed 16:9 stage.** Author every slide at 1920×1080 and scale the entire deck stage uniformly.
5. **Self-contained deck.** Prefer one HTML file with inline CSS/JS. Local images should be relative files under the slide output folder.
6. **Keep workspace boundaries.** Generated decks belong under `reports/<slug>/slides/` or another allowed content path, not hidden runtime or extension directories.
7. **Design with intent.** Use strong visual hierarchy and avoid generic AI-looking card grids unless the business context actually calls for them.
8. **Validate before delivery.** Confirm that the deck renders, navigates, and fits without overflow or overlapping panels.

## When to use

Use this skill when the user says things like:

- "Turn this report into slides."
- "Create a presentation from the dashboard."
- "Make an executive deck from this analysis."
- "Summarize this BI workspace as stakeholder slides."
- "Create a board-ready deck from `pages/report.md`."
- "Make slides for the customer from this Evidence report."

Do **not** use this skill for:

- Creating a BI dashboard from scratch. Use the existing Evidence/dashboard skills first.
- Converting an existing PPT/PPTX. That is out of scope for this project integration.
- Editing hidden runtime, package files, scripts, extensions, connection files, or environment files.
- Producing a static Markdown-only summary when the user asked for a presentation deck.

## Important source files

Read these first in the current workspace:

1. `.cmux/workspace.json` — current workspace metadata, title, slug, goal, preview URL if available.
2. `pages/report.md` — polished findings and business answer.
3. `pages/draft.md` — supporting exploration, only if the report lacks enough context.
4. `queries/**` — reusable SQL behind the findings.
5. `.cmux/data-profile.json` — data profile if present.
6. `reports/**` — existing output materials if present.
7. `data/**` — local supporting materials only when explicitly relevant.

If `pages/report.md` is missing or empty, ask whether to create slides from `pages/draft.md` or first finish the report. Prefer finishing the report before making slides.

## Supporting references

Load these references only when needed:

- `references/report-story-schema.md` — how to extract business story from a BI report.
- `references/slide-story-patterns.md` — recommended deck structures.
- `references/evidence-chart-capture.md` — how to use rendered dashboard/chart evidence.
- `references/report-annotation-conventions.md` — optional markers for slide capture.
- `references/output-contract.md` — required generated files and metadata.
- `references/slide-quality-rubric.md` — validation and QA.
- `assets/html-template.md` — deck architecture.
- `assets/viewport-base.css` — mandatory CSS to inline in final HTML.
- `assets/style-presets-bi.md` — BI-focused visual directions.
- `assets/deck-js-contract.md` — JS behavior contract.

## Phase 0 — Detect workspace and task

Determine:

- Current workspace root.
- Whether this is the root project or a generated analysis workspace.
- Current analysis slug.
- Whether `pages/report.md` exists and contains polished findings.
- Whether a preview URL exists.
- Whether the user wants:
  - speaker-led deck
  - reading-first deck
  - executive summary deck
  - customer-facing deck
  - board/investor deck
  - workshop/training deck

If the user did not specify audience or density, infer from context:

- "executive", "board", "leadership", "pitch", "meeting" → low-density / speaker-led unless they ask for a readout.
- "send", "share async", "document", "review packet" → high-density / reading-first.
- "customer" → medium density, more narrative and fewer internal caveats.
- "analyst review" → high-density, include method/caveats.

## Phase 1 — Extract the BI story

Read the report and produce an internal story model before writing slides.

Required story fields:

```json
{
  "title": "",
  "business_question": "",
  "audience": "",
  "decision_context": "",
  "one_sentence_answer": "",
  "key_findings": [],
  "recommendations": [],
  "risks_and_caveats": [],
  "evidence_sources": [],
  "appendix_material": []
}
```

Each `key_findings[]` item must include:

```json
{
  "claim": "",
  "supporting_evidence": "",
  "chart_or_query_reference": "",
  "business_implication": "",
  "confidence": "high|medium|low",
  "caveat": ""
}
```

Rules:

- Do not make claims that are not supported by report/query/dashboard content.
- Convert metrics into plain-language business meaning.
- Keep caveats visible; do not hide uncertainty.
- If the report has conflicting findings, call that out and decide how to present it.
- If no recommendation is justified, present "what we learned" rather than inventing one.

Write this story model to:

```text
reports/<slug>/slides/story.json
```

## Phase 2 — Draft storyboard

Create a `storyboard.md` before generating HTML.

Required sections:

```markdown
# Slide Storyboard: <title>

## Audience and density
## Source material
## Core answer
## Slide outline
## Evidence assets needed
## Visual style direction
## Validation plan
```

Each slide entry should include:

```markdown
### Slide N — <slide title>

- Purpose:
- Main message:
- Evidence:
- Visual:
- Speaker/readout notes:
- Caveats:
```

Write it to:

```text
reports/<slug>/slides/storyboard.md
```

Ask for user confirmation only when:

- the report is incomplete,
- audience is ambiguous and changes the deck materially,
- chart capture requires manual choice,
- there are multiple valid narratives with different recommendations.

Otherwise proceed with a best-effort storyboard and clearly state assumptions in the file.

## Phase 3 — Choose deck structure

Use one of these default structures.

### Executive answer deck

Best for leadership or board-readout.

1. Title / business question
2. Executive answer
3. What changed or matters most
4. Finding 1
5. Finding 2
6. Finding 3
7. Recommendation
8. Risks / caveats
9. Appendix / method

### Reading-first analytical deck

Best for async review.

1. Title / context
2. Executive summary
3. Data and scope
4. Finding 1 with chart
5. Finding 1 explanation
6. Finding 2 with chart
7. Finding 2 explanation
8. Segment / cohort / driver detail
9. Recommendation
10. Caveats and next checks
11. Appendix query notes

### Speaker-led narrative deck

Best for live presentation.

1. Provocative business question
2. The answer in one sentence
3. The pattern we found
4. The visual proof
5. The driver
6. The risk / exception
7. What to do next
8. Closing ask

### Customer-facing deck

Best for external or semi-external stakeholders.

1. Title and context
2. What we investigated
3. Key takeaway
4. Evidence snapshot
5. What it means for you
6. Recommended action
7. Next steps
8. Appendix / methodology

## Phase 4 — Prepare evidence assets

Prefer direct content and charts over decorative visuals.

Options, in priority order:

1. Use rendered chart screenshots from the Evidence preview.
2. Use section/page screenshots if exact chart capture is not available.
3. Recreate simple chart-like callouts in HTML only if screenshot capture is unavailable.
4. Use KPI cards/tables from report text.
5. Use CSS-generated visuals for chapter/transition slides.

If capturing images:

- Save under `reports/<slug>/slides/assets/`.
- Use relative paths from `index.html`.
- Do not use absolute filesystem paths.
- Keep filenames lowercase and hyphenated.
- Record each asset in `story.json`.

## Phase 5 — Style selection

For fast MVP, choose one appropriate BI style automatically.

For polished use, generate 3 style previews under:

```text
reports/<slug>/slides/_previews/
  style-a.html
  style-b.html
  style-c.html
```

Preview rules:

- Each preview must look like a real first slide from the user's deck.
- Do not render internal labels such as "preview", "template", "option A", or file paths on the slide.
- The message to the user may label previews as Style A/B/C.
- Use real title, date, company, section, or analysis text.
- Keep previews self-contained.

Recommended BI styles:

- Executive Slate — restrained, leadership-ready, navy/slate, high trust.
- Analyst Signal — dark, crisp, data-forward, strong metrics.
- Boardroom Editorial — premium editorial, serif display, warm paper, thoughtful.
- Workshop Clarity — friendly, readable, internal enablement.
- Customer Narrative — polished and accessible, less internal jargon.

## Phase 6 — Generate HTML deck

Read:

- `assets/viewport-base.css`
- `assets/html-template.md`
- `assets/deck-js-contract.md`
- selected style notes from `assets/style-presets-bi.md`

Requirements:

- Single self-contained HTML file at `reports/<slug>/slides/index.html`.
- Inline CSS and JavaScript.
- Include full `viewport-base.css` contents in the `<style>` block.
- Use `.deck-viewport`, `.deck-stage`, and `.slide`.
- Author slides at 1920×1080.
- Use `visibility`, `opacity`, and `pointer-events` for slide switching; do not switch slides with `display: none`.
- Include keyboard navigation: arrows, space, Home, End.
- Include touch/swipe navigation if feasible.
- Include slide count/progress chrome outside the stage.
- Include `prefers-reduced-motion` support.
- Use relative image paths only.
- Do not create text smaller than comfortable reading size.
- Split dense content rather than shrinking it until unreadable.

## Phase 7 — Validate

Run or request relevant validation:

```bash
./bin/cmux-evidence validate
```

For the deck itself:

- Open `reports/<slug>/slides/index.html`.
- Navigate all slides.
- Confirm no overflow, clipping, or overlap.
- Confirm charts/images load.
- Confirm `.slide` count matches storyboard.
- Test at 1280×720 and a phone viewport if browser tools are available.
- If exporting PDF, confirm the export tool finds `.slide` elements.

If using screenshots, visually inspect at least title, primary evidence slide, recommendation slide, and caveat slide.

## Phase 8 — Delivery summary

When finished, report:

- Deck file path.
- Slide count.
- Source report path.
- Storyboard path.
- Assets path.
- Any assumptions made.
- Validation performed.
- Remaining manual checks.

Do not claim full validation if screenshots/browser checks were not performed.
