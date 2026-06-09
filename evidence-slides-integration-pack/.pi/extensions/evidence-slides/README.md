# Optional Pi Extension: Evidence Slides

This directory contains design notes and a non-loading draft for a future Pi extension.

The draft file is named:

```text
index.ts.draft
```

It is intentionally not named `index.ts`, so Pi will not auto-discover and run it if this pack is copied into a project.

## Why an extension may be useful later

The skill and prompt templates are enough for the first MVP. An extension becomes useful when you want deterministic tools for:

- finding the current Evidence workspace,
- reading the current report,
- discovering slide output paths,
- capturing chart screenshots,
- validating deck HTML,
- exporting PDF,
- presenting a style-selection UI.

## When to implement

Implement only after the skill-based workflow has produced a few successful decks manually.

## Proposed command

```text
/slides
```

Command variants:

```text
/slides from-report
/slides storyboard
/slides validate
/slides export-pdf
```

## Proposed tools

See `TOOL_SPEC.md`.
