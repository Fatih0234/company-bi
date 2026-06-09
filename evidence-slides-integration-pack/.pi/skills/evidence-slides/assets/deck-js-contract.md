# Deck JavaScript Contract

The generated deck must be understandable and robust without a build step.

## Required behavior

- Instantiate exactly one controller class after DOM content is present.
- Query slides using `.slide`.
- Track current slide index.
- Scale `.deck-stage` to fit browser viewport using:

```js
const factor = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
```

- Position the scaled stage with `translate(x, y) scale(factor)`.
- Toggle `.active` and `.visible` on slides.
- Update visible slide counter.
- Support keyboard navigation:
  - ArrowRight, Space, PageDown: next
  - ArrowLeft, PageUp: previous
  - Home: first
  - End: last
- Support touch swipes when feasible.

## Optional behavior

- Hash navigation: `#slide-3`
- Presenter notes panel
- Edit mode
- PDF export helper
- Theme toggle
- Chart source overlay
- "Copy slide title" shortcut

## Prohibited behavior

- Do not require React, Svelte, Vite, npm, or a bundle.
- Do not fetch local files through absolute filesystem paths.
- Do not hide slides with `display: none`.
- Do not reflow slide layouts for mobile.
- Do not require external JS CDNs for basic navigation.
- Do not make the deck depend on Evidence runtime after generation.

## Validation hooks

To support simple validation scripts later, every deck should expose:

```js
window.__evidenceSlides = {
  version: 1,
  slideCount: number,
  currentSlide: () => number,
  goTo: (index) => void
}
```

This allows later browser automation tools to iterate all slides for screenshots/PDF export.
