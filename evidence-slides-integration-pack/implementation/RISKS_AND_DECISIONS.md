# Risks and Decisions

## Decision: start with a Pi skill, not an extension

Reason:

- The core problem is reasoning/workflow: extracting a story from a report and designing slides.
- Pi skills are meant for specialized workflows and reference docs.
- No deterministic tools are required for the first useful MVP.

Risk:

- Manual screenshot/chart capture may be inconsistent.

Mitigation:

- Add extension tools only after the workflow is proven.

## Decision: generate decks under `reports/<slug>/slides/`

Reason:

- `reports/**` is an allowed content path in the company-bi model.
- Slides are communication artifacts derived from reports.
- The deck can travel with published/reviewed analysis content.

Risk:

- Existing publish logic may not include all slide assets.

Mitigation:

- Review publish behavior before relying on PR/publish flow for slides.

## Decision: fixed HTML decks, not PPTX-first

Reason:

- Single HTML decks fit the frontend-slides model.
- No PowerPoint conversion is needed for this workflow.
- HTML is easier for agents to generate, preview, and edit.

Risk:

- Some users eventually need `.pptx`.

Mitigation:

- Add PDF export first. Consider PPTX export only later.

## Decision: style previews optional for MVP

Reason:

- For internal BI decks, speed may matter more than design exploration.
- A strong default style may be sufficient.

Risk:

- Decks may feel generic.

Mitigation:

- Include BI-specific style presets and add previews for polished workflows.

## Risk: unsupported business claims

Slides can overstate findings if the agent compresses too aggressively.

Mitigation:

- Require story.json evidence traceability.
- Include caveats.
- Validate recommendations against findings.

## Risk: screenshot readability

Dashboard charts may be too small or dense when placed on slides.

Mitigation:

- Capture chart regions where possible.
- Add annotations.
- Use one visual per slide.
- Recreate simplified exhibits only when clearly labeled.

## Risk: generated HTML breaks PDF export

PDF tools often query `.slide` elements.

Mitigation:

- Require `.slide` on every slide.
- Keep stage fixed.
- Avoid dynamic fetches.
- Use relative assets.

## Risk: accidental extension loading

Project-local extensions can run with system permissions.

Mitigation:

- Keep extension draft as `index.ts.draft`.
- Rename to `index.ts` only after review and local testing.
