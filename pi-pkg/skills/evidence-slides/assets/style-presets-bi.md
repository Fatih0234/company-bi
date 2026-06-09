# BI Style Presets

These are design directions for Evidence-derived business decks. Use them as starting points, not rigid templates.

## Selection rules

Choose based on audience and density:

| Audience / mode | Recommended preset |
|---|---|
| Board, CEO, executive meeting | Executive Slate or Boardroom Editorial |
| Analyst review, data team, internal diagnosis | Analyst Signal |
| Async stakeholder packet | Executive Slate, Boardroom Editorial, or Workshop Clarity |
| Customer-facing readout | Customer Narrative |
| Live talk / keynote-style internal share | Analyst Signal or Executive Slate with lower density |

## Preset 1 — Executive Slate

**Best for:** leadership, board, strategy review, operating review.  
**Tone:** calm, authoritative, decisive.  
**Density:** low to medium.

```css
:root {
  --stage-bg: #0b1220;
  --slide-bg: #f8fafc;
  --ink: #0f172a;
  --muted: #64748b;
  --line: #cbd5e1;
  --accent: #1d4ed8;
  --accent-soft: #dbeafe;
  --risk: #b45309;
  --good: #047857;
  --font-display: "Source Serif 4", Georgia, serif;
  --font-body: "IBM Plex Sans", Arial, sans-serif;
}
```

**Signature elements:**

- Large serif headlines
- Thin rules
- Small uppercase section labels
- Calm accent color
- Big KPI with concise "so what"
- Chart screenshots framed like exhibits

**Avoid:**

- Neon effects
- Decorative clutter
- Too many cards per slide

## Preset 2 — Analyst Signal

**Best for:** data-heavy internal decks, product analytics, finance operations, technical stakeholders.  
**Tone:** precise, focused, diagnostic.  
**Density:** medium to high.

```css
:root {
  --stage-bg: #020617;
  --slide-bg: #06111f;
  --ink: #e5edf7;
  --muted: #8aa0b8;
  --line: rgba(148, 163, 184, 0.22);
  --accent: #38bdf8;
  --accent-2: #a3e635;
  --risk: #fb7185;
  --good: #34d399;
  --font-display: "Space Grotesk", Arial, sans-serif;
  --font-body: "IBM Plex Sans", Arial, sans-serif;
}
```

**Signature elements:**

- Dark background
- Thin grid and data-panel aesthetic
- Clear metric labels
- Strong contrast for key numbers
- Evidence citations in slide footers

**Avoid:**

- Dense unlabeled screenshots
- Making every slide look like a dashboard
- Excessive glow that reduces readability

## Preset 3 — Boardroom Editorial

**Best for:** quarterly review, high-stakes decision memo, polished internal readout.  
**Tone:** premium, editorial, considered.  
**Density:** medium.

```css
:root {
  --stage-bg: #1f2933;
  --slide-bg: #f5f0e8;
  --ink: #1d1b19;
  --muted: #6b6258;
  --line: #d8ccbd;
  --accent: #8b3a2f;
  --accent-soft: #ead8d2;
  --risk: #92400e;
  --good: #166534;
  --font-display: "Cormorant Garamond", Georgia, serif;
  --font-body: "DM Sans", Arial, sans-serif;
}
```

**Signature elements:**

- Warm paper background
- Strong magazine-style headings
- Exhibit labels such as "Finding 01"
- Pull quote slides
- Recommendation pages with editorial confidence

**Avoid:**

- Overly playful visuals
- Tiny tables
- Screenshot-heavy decks without narrative framing

## Preset 4 — Workshop Clarity

**Best for:** internal enablement, working sessions, team reviews, workshops.  
**Tone:** clear, structured, approachable.  
**Density:** medium to high.

```css
:root {
  --stage-bg: #e2e8f0;
  --slide-bg: #ffffff;
  --ink: #111827;
  --muted: #4b5563;
  --line: #d1d5db;
  --accent: #0f766e;
  --accent-soft: #ccfbf1;
  --risk: #c2410c;
  --good: #15803d;
  --font-display: "Plus Jakarta Sans", Arial, sans-serif;
  --font-body: "Atkinson Hyperlegible", Arial, sans-serif;
}
```

**Signature elements:**

- Large clear section headers
- Step-based layouts
- Sidebars for "what to discuss"
- Simple charts with annotations
- Checklists and next actions

**Avoid:**

- Luxury/editorial styling
- Too much motion
- Hard-to-read decorative type

## Preset 5 — Customer Narrative

**Best for:** client-facing or customer-facing presentation derived from internal BI.  
**Tone:** polished, plain-language, external-safe.  
**Density:** low to medium.

```css
:root {
  --stage-bg: #0f172a;
  --slide-bg: #fbfcff;
  --ink: #0f172a;
  --muted: #5b6474;
  --line: #dce3ee;
  --accent: #2563eb;
  --accent-soft: #eff6ff;
  --risk: #b45309;
  --good: #047857;
  --font-display: "Sora", Arial, sans-serif;
  --font-body: "Source Sans 3", Arial, sans-serif;
}
```

**Signature elements:**

- Clean benefit-first messages
- Lower jargon
- "What this means for you" slides
- Friendly chart annotations
- Strong next-step slide

**Avoid:**

- Internal caveat overload
- Raw SQL/query references on main slides
- Unexplained analyst jargon

## Visual rules for all presets

- Each slide gets one dominant point.
- Use chart screenshots as evidence exhibits, not background decoration.
- Add short annotations to chart screenshots instead of expecting the viewer to infer the message.
- Include source/caveat footers when decisions depend on assumptions.
- Split content before shrinking text too much.
- Avoid generic "cards everywhere" layouts unless each card has a specific communication job.
