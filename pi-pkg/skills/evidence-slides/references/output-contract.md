# Output Contract

The slide workflow should produce predictable files.

## Required output directory

```text
reports/<analysis-slug>/slides/
```

If the slug cannot be determined, use a safe fallback:

```text
reports/current-analysis/slides/
```

Record the assumption in `storyboard.md`.

## Required files

```text
story.json
storyboard.md
index.html
```

## Optional files

```text
assets/
_previews/
export.pdf
validation-notes.md
```

## `story.json`

Machine-readable story extraction.

Must include:

- source report path
- audience
- density
- business question
- answer
- findings
- recommendations
- caveats
- evidence source list
- assumptions

## `storyboard.md`

Human-readable plan.

Must include:

- audience/density
- slide outline
- evidence needs
- style direction
- validation plan

## `index.html`

Final deck.

Must include:

- inline CSS
- inline JS
- full fixed-stage CSS
- `.deck-viewport`
- `.deck-stage`
- `.slide`
- controls
- keyboard navigation
- relative paths to assets

## File naming

Use lowercase hyphenated names.

Good:

```text
revenue-quality-deck.html
segment-mix.png
```

Bad:

```text
My Final Deck New NEW.html
Screenshot 2026-06-09 at 2.31 PM.png
```

## Final answer summary

After generation, the agent should report:

```markdown
Created:

- `reports/<slug>/slides/story.json`
- `reports/<slug>/slides/storyboard.md`
- `reports/<slug>/slides/index.html`

Slide count: N
Density: speaker-led / reading-first
Style: <style name>
Source report: `pages/report.md`
Validation: <what was actually checked>
Not checked: <honest gaps>
```
