# Evidence Slides Extension Tool Spec

This is a proposed deterministic tool layer for a later Pi extension.

## Tool: `get_current_evidence_workspace`

Purpose: discover workspace metadata.

Input:

```json
{}
```

Output:

```json
{
  "workspaceRoot": "",
  "projectRoot": "",
  "slug": "",
  "title": "",
  "reportPath": "pages/report.md",
  "draftPath": "pages/draft.md",
  "slidesDir": "reports/<slug>/slides",
  "previewUrl": "",
  "exists": {
    "report": true,
    "draft": true,
    "slidesDir": false
  }
}
```

## Tool: `read_report_story_inputs`

Purpose: read report, draft, workspace metadata, and optional query summaries.

Input:

```json
{
  "includeDraft": false,
  "includeQueries": true
}
```

Output:

```json
{
  "workspace": {},
  "report": "",
  "draft": "",
  "queries": [
    {
      "path": "",
      "preview": ""
    }
  ]
}
```

## Tool: `write_slide_artifact`

Purpose: write generated slide files only under allowed slide output directory.

Input:

```json
{
  "path": "reports/<slug>/slides/storyboard.md",
  "content": ""
}
```

Safety:

- Must reject paths outside `reports/**/slides/**`.
- Must reject `.env`, `connection.yaml`, `package.json`, `bin/**`, `scripts/**`.

## Tool: `validate_slide_deck`

Purpose: static validation of generated HTML.

Checks:

- file exists
- contains `.deck-viewport`
- contains `.deck-stage`
- contains `.slide`
- contains 1920 and 1080 stage dimensions
- references only relative local assets or approved remote font URLs
- all relative assets exist
- slide count > 0

Output:

```json
{
  "ok": true,
  "slideCount": 9,
  "errors": [],
  "warnings": []
}
```

## Tool: `capture_report_screenshot`

Purpose: use browser preview helpers to capture Evidence report visuals.

Input:

```json
{
  "surfaceRef": "",
  "outputPath": "reports/<slug>/slides/assets/report.png"
}
```

Safety:

- Output path must be inside slides assets directory.

## Tool: `export_slide_pdf`

Purpose: export `index.html` to PDF.

Input:

```json
{
  "htmlPath": "reports/<slug>/slides/index.html",
  "outputPath": "reports/<slug>/slides/export.pdf",
  "compact": false
}
```

Implementation can use Playwright later. It should not be required for MVP.
