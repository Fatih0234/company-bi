# Evidence Slides Integration Pack

This pack adds a detailed design and instruction layer for creating presentation slides from an Evidence BI analysis workspace.

It is designed for the `company-bi` style of project:

- Evidence dashboards and reports
- CMUX content-only analysis workspaces
- Pi Coding Agent skills, prompts, and optional extensions
- A workflow where the user first creates a BI report, then asks the agent to turn the report into a presentation

The pack intentionally adapts the useful parts of `zarazhangrui/frontend-slides`:

- fixed 1920×1080 browser slide stage
- self-contained HTML decks
- visual style previews
- strong design constraints
- optional PDF export path

It intentionally does **not** focus on PowerPoint conversion, Claude Code plugin installation, or Vercel deployment.

## What is included

```text
.pi/
  skills/
    evidence-slides/
      SKILL.md
      assets/
        viewport-base.css
        html-template.md
        style-presets-bi.md
        deck-js-contract.md
      references/
        frontend-slides-adaptation.md
        evidence-path-rules.md
        report-story-schema.md
        slide-story-patterns.md
        evidence-chart-capture.md
        report-annotation-conventions.md
        output-contract.md
        slide-quality-rubric.md
        pdf-export-notes.md
  prompts/
    slides-from-report.md
    slides-storyboard.md
    slides-review.md
  extensions/
    evidence-slides/
      README.md
      TOOL_SPEC.md
      index.ts.draft

cmux/
  proposed-cmux-actions.json
  SLIDES_COMMANDS.md

implementation/
  IMPLEMENTATION_PLAN.md
  CODING_AGENT_PROMPT.md
  ACCEPTANCE_CRITERIA.md
  VALIDATION_CHECKLIST.md
  RISKS_AND_DECISIONS.md

examples/
  example-story.json
  example-storyboard.md
  example-output-tree.md
```

## Recommended first integration

Copy only these files first:

```text
.pi/skills/evidence-slides/
.pi/prompts/slides-from-report.md
.pi/prompts/slides-storyboard.md
.pi/prompts/slides-review.md
implementation/
examples/
```

Do **not** copy the optional extension draft as executable code until you are ready to implement and test it. It is named `index.ts.draft` deliberately so Pi will not auto-load it.

## Expected generated output location

Generated decks should live under an allowed content path such as:

```text
reports/<analysis-slug>/slides/
  storyboard.md
  story.json
  index.html
  assets/
  _previews/
```

This keeps deck artifacts inside the BI analysis workspace rather than hidden runtime or tool directories.

## Operating model

1. The BI agent completes or reviews `pages/report.md`.
2. The slide skill extracts the business story.
3. The agent drafts a slide storyboard.
4. The user picks or accepts a style direction.
5. The agent generates `reports/<slug>/slides/index.html`.
6. The agent validates the deck visually and structurally.
7. Optional: export to PDF.

## Safety and repo-fit notes

- Normal BI agents should edit only content/workspace outputs such as `pages/**`, `queries/**`, `reports/**`, and `data/**`.
- Extensions, scripts, package files, and connection files should remain human-controlled implementation surfaces.
- This pack is documentation/instruction-first. It avoids silently introducing runtime dependencies.
