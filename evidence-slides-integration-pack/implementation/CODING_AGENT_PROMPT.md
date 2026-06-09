# Prompt for a Coding Agent

Use this prompt to ask a less-capable coding agent to implement the MVP.

---

You are working in the `company-bi` repository, an Evidence/CMUX/Pi BI workspace project.

Goal: add a slide-generation instruction pack so the Pi agent can turn a completed Evidence report into a fixed-stage HTML presentation deck.

## Files to add

Create these files exactly:

```text
.pi/skills/evidence-slides/SKILL.md
.pi/skills/evidence-slides/assets/viewport-base.css
.pi/skills/evidence-slides/assets/html-template.md
.pi/skills/evidence-slides/assets/style-presets-bi.md
.pi/skills/evidence-slides/assets/deck-js-contract.md
.pi/skills/evidence-slides/references/frontend-slides-adaptation.md
.pi/skills/evidence-slides/references/evidence-path-rules.md
.pi/skills/evidence-slides/references/report-story-schema.md
.pi/skills/evidence-slides/references/slide-story-patterns.md
.pi/skills/evidence-slides/references/evidence-chart-capture.md
.pi/skills/evidence-slides/references/report-annotation-conventions.md
.pi/skills/evidence-slides/references/output-contract.md
.pi/skills/evidence-slides/references/slide-quality-rubric.md
.pi/skills/evidence-slides/references/pdf-export-notes.md
.pi/prompts/slides-from-report.md
.pi/prompts/slides-storyboard.md
.pi/prompts/slides-review.md
```

Use the contents from the integration pack.

## Files not to touch

Do not modify:

```text
.env*
**/connection.yaml
.github/**
package.json
package-lock.json
bin/**
scripts/**
.pi/extensions/**
```

Do not edit `.cmux/cmux.json` unless explicitly asked. If CMUX actions are desired, propose a patch separately.

## Constraints

- The skill must be instruction-first and require no npm install.
- Generated slide decks should go under `reports/<slug>/slides/`.
- The deck format must be self-contained HTML.
- Slides must use fixed 1920×1080 stage scaling.
- The skill must tell the agent to read `pages/report.md` first.
- It must preserve evidence traceability and caveats.

## Acceptance criteria

- Pi discovers the `evidence-slides` skill.
- Prompt templates appear as slash commands.
- The skill can guide the agent to generate:
  - `reports/<slug>/slides/story.json`
  - `reports/<slug>/slides/storyboard.md`
  - `reports/<slug>/slides/index.html`
- The generated deck has `.deck-viewport`, `.deck-stage`, and `.slide`.
- The deck does not require Evidence runtime after generation.
- No blocked files are modified.

## Validation

Run or manually check:

```bash
git status --short
```

Then in Pi:

```text
/skill:evidence-slides
/slides-storyboard
```

If there is a sample report, try:

```text
/slides-from-report
```

Report back:

- files created,
- any deviations,
- whether skill discovery worked,
- whether prompt templates worked,
- validation performed,
- issues or follow-up recommendations.
