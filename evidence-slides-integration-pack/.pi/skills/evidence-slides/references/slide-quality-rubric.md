# Slide Quality Rubric

Use this rubric before delivering a deck.

## 1. Story quality

| Check | Pass criteria |
|---|---|
| Business question is explicit | Viewer knows what the analysis answered |
| One-sentence answer exists | Slide 2 or early deck gives the answer |
| Findings are sequenced | Each finding builds toward the recommendation |
| No unsupported claims | Claims map to report/query/chart evidence |
| Caveats are visible | Important limitations are not hidden |
| Recommendation is justified | Action follows from evidence |

## 2. Slide design quality

| Check | Pass criteria |
|---|---|
| One main point per slide | No slide tries to answer everything |
| Title states the point | Not generic labels like "Analysis" |
| Hierarchy is clear | Viewer can scan title → evidence → implication |
| Text is readable | No tiny paragraphs or crowded footers |
| Chart is legible | Axis labels and key values readable |
| Annotation helps | Callouts explain what to notice |
| Visual system consistent | Fonts, colors, spacing, and labels repeat coherently |

## 3. Technical quality

| Check | Pass criteria |
|---|---|
| Fixed stage | `.deck-stage` is 1920×1080 |
| Slide class | Every slide has `.slide` |
| Navigation | Keyboard and buttons work |
| Visibility | Only active slide visible |
| Asset paths | Relative image paths work |
| No overflow | Text/cards/images stay inside slide |
| Reduced motion | `prefers-reduced-motion` present |
| PDF readiness | Export tools can query `.slide` elements |

## 4. Evidence integrity

| Check | Pass criteria |
|---|---|
| Source is recorded | `story.json` lists report/query/assets |
| Charts are not misleading | No crop removes essential axis/context |
| Caveats match report | No caveat softened beyond accuracy |
| External-safe content | Internal-only material not exposed accidentally |

## Common failure modes

- Deck is just a screenshot dump.
- Deck hides the actual answer until the end.
- Titles are labels instead of claims.
- Agent invents recommendations not supported by report.
- Dense report text is pasted into slides.
- Chart screenshots are too small to read.
- Generated deck reflows on mobile and breaks layout.
- Local images use absolute filesystem paths.
- PDF export fails because slide elements do not use `.slide`.

## Final recommendation labels

Use one of:

- **Ready to present** — visually checked and content is evidence-backed.
- **Ready after manual visual check** — generated, but screenshots/browser checks were not completed.
- **Needs story revision** — narrative is unclear or unsupported.
- **Needs technical fixes** — deck rendering/navigation/assets are broken.
