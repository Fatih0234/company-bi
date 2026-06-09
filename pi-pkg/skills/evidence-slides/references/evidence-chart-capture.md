# Evidence Chart Capture Guide

Slides become much stronger when they include the relevant rendered chart, not just paraphrased findings.

## Preferred asset path

```text
reports/<slug>/slides/assets/
```

Use lowercase hyphenated filenames:

```text
revenue-trend.png
segment-mix.png
margin-caveat.png
```

## Capture hierarchy

### Best: capture chart regions

Use stable report annotations or DOM anchors to capture only the chart/card/table needed for a slide.

### Good: capture report section

Capture a report section that contains the chart and supporting text, then crop/position it in the deck.

### Acceptable MVP: capture full report page screenshot

Use the full screenshot as an evidence backdrop or manually crop if tool support exists.

### Last resort: recreate simplified visual in HTML

If screenshots are not available, create a simplified chart-like exhibit in HTML. Label it clearly as a simplified exhibit and preserve the source query/report reference.

## Browser preview helpers

If the project has helper commands such as:

```bash
./bin/cmux-evidence preview-url
./bin/cmux-evidence preview-open
./bin/cmux-evidence browser-surfaces
./bin/cmux-evidence preview-snapshot
./bin/cmux-evidence preview-screenshot <surface-ref> <path>
```

Use them to discover and capture rendered Evidence output.

## Slide asset manifest

Record every image asset in `story.json`:

```json
{
  "type": "chart-screenshot",
  "path": "reports/my-analysis/slides/assets/revenue-trend.png",
  "description": "Revenue trend chart from report section 'Trend'",
  "source": "pages/report.md#trend",
  "used_on_slides": [4]
}
```

## Quality rules

- Do not use blurry chart screenshots.
- Do not crop out axis labels needed to understand the chart.
- Add slide annotations outside or over the screenshot if the chart is dense.
- Keep screenshot aspect ratio intact unless intentionally cropping.
- Prefer one major visual per slide.
- Do not rely on raw dashboard layout if the slide needs a tighter narrative.

## Future deterministic extension idea

A Pi extension could provide tools:

```text
capture_current_report_page
capture_selector_screenshot
list_report_sections
capture_slide_asset
validate_asset_paths
```

The first MVP can work without these tools by instructing the agent to use existing browser preview helpers.
