# PDF Export Notes

PDF export is optional for the first integration.

## Why export is useful

- Email attachments
- Slack/Notion sharing
- Print review
- Offline meeting use

## Recommended approach

Use browser automation to render each `.slide` at 1920×1080 and combine screenshots into a PDF.

The generated HTML must preserve:

```text
.slide
.deck-stage
1920×1080 fixed canvas
relative asset paths
```

## Gotchas

- Animations become static snapshots.
- Large decks can produce large PDFs.
- Local images must be served through HTTP or relative paths must resolve.
- First Playwright install can be slow.
- Export should fail clearly if no `.slide` elements are found.

## MVP policy

Do not make PDF export part of the first required workflow. First ensure HTML deck generation is reliable.

Add PDF export once:

- storyboard generation is stable,
- deck HTML validates,
- chart/image assets are reliably relative,
- users actually ask for PDF output.
