# Implementation Plan

## Goal

Add a slide-generation workflow to the Evidence/CMUX/Pi BI workspace so a completed BI report can be turned into a presentation deck.

## MVP scope

Implement instruction-driven slide generation first:

- Pi skill: `.pi/skills/evidence-slides/`
- Prompt templates: `.pi/prompts/slides-from-report.md`, `.pi/prompts/slides-storyboard.md`, `.pi/prompts/slides-review.md`
- Generated output under `reports/<slug>/slides/`
- Self-contained fixed-stage HTML deck
- Story extraction and storyboard files

Do not implement deterministic screenshot/PDF/export extension until the skill has produced working decks.

## Phase 1 — Add skill package

Create:

```text
.pi/skills/evidence-slides/SKILL.md
.pi/skills/evidence-slides/assets/
.pi/skills/evidence-slides/references/
```

Acceptance:

- Pi can discover `/skill:evidence-slides`.
- Skill description clearly triggers for report/dashboard-to-slides requests.
- Skill references only relative files.
- Skill tells the agent where to read source report and where to write output.

## Phase 2 — Add prompt templates

Create:

```text
.pi/prompts/slides-from-report.md
.pi/prompts/slides-storyboard.md
.pi/prompts/slides-review.md
```

Acceptance:

- `/slides-from-report` expands into a concrete task.
- `/slides-storyboard` stops before HTML generation.
- `/slides-review` reviews an existing deck.

## Phase 3 — Generate first deck manually

Use a real analysis workspace.

Run:

```text
/slides-storyboard
```

Review:

```text
reports/<slug>/slides/story.json
reports/<slug>/slides/storyboard.md
```

Then run:

```text
/slides-from-report
```

Review:

```text
reports/<slug>/slides/index.html
```

Acceptance:

- Story is faithful to report.
- Slides are not just a dashboard screenshot dump.
- Deck opens in browser.
- Navigation works.
- No obvious layout overflow.

## Phase 4 — Add optional CMUX actions

Manually merge `cmux/proposed-cmux-actions.json` entries into `.cmux/cmux.json`.

Acceptance:

- CMUX command palette can trigger slide workflows.
- Commands use the correct Pi launcher for this repo.

## Phase 5 — Decide whether extension is needed

Only implement `.pi/extensions/evidence-slides/index.ts` if manual workflows show repeated needs for deterministic tools.

Prioritize tools in this order:

1. `get_current_evidence_workspace`
2. `validate_slide_deck`
3. `write_slide_artifact_safe`
4. `capture_report_screenshot`
5. `export_slide_pdf`

## Phase 6 — Optional chart capture conventions

Add report annotation conventions to the dashboard/report skill so future reports can mark slide-ready charts:

```markdown
<!-- slide-capture: revenue-trend -->
<!-- slide-title: Revenue accelerated in Q2 -->
<!-- slide-note: Emphasize the Q2 inflection and caveat late-arriving data. -->
```

Acceptance:

- Slide agent uses markers when available.
- Reports still render normally in Evidence.

## Phase 7 — Optional PDF export

After HTML decks are reliable, implement PDF export via Playwright or a dedicated script.

Acceptance:

- Export iterates `.slide` elements.
- Output PDF has one slide per page.
- Assets appear correctly.
- User is told animations are static in PDF.
