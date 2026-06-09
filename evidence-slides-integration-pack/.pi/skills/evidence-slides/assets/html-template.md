# Evidence Slides HTML Template

Every generated deck should follow this architecture.

## Invariants

- One self-contained HTML file.
- Fixed `.deck-stage` of 1920×1080.
- Slides are `<section class="slide">`.
- Active slide gets `.active` and `.visible`.
- No slide switching via `display: none`.
- All presentation chrome outside the slide stage.
- All paths are relative to the HTML file.

## Skeleton

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title><!-- Deck title --></title>

  <!-- Fonts: prefer Google Fonts or Fontshare. Avoid generic system-only decks. -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="..." rel="stylesheet" />

  <style>
    /* === THEME VARIABLES === */
    :root {
      --stage-bg: #0f172a;
      --slide-bg: #f8fafc;
      --text-primary: #0f172a;
      --text-secondary: #475569;
      --accent: #2563eb;
      --font-display: "Source Serif 4", serif;
      --font-body: "IBM Plex Sans", sans-serif;
      --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
      --duration-normal: 0.55s;
    }

    /* === RESET === */
    * { box-sizing: border-box; }
    body { font-family: var(--font-body); }

    /* === PASTE FULL viewport-base.css HERE === */

    /* === SHARED DECK TYPOGRAPHY === */
    .slide {
      color: var(--text-primary);
    }

    .eyebrow {
      font-size: 24px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--accent);
      font-weight: 700;
    }

    .slide h1 {
      font-family: var(--font-display);
      font-size: 96px;
      line-height: 0.95;
      letter-spacing: -0.04em;
    }

    .slide h2 {
      font-family: var(--font-display);
      font-size: 72px;
      line-height: 1.02;
      letter-spacing: -0.03em;
    }

    .slide p,
    .slide li {
      font-size: 30px;
      line-height: 1.35;
    }

    /* === REVEAL ANIMATIONS === */
    .reveal {
      opacity: 0;
      transform: translateY(28px);
      transition:
        opacity var(--duration-normal) var(--ease-out-expo),
        transform var(--duration-normal) var(--ease-out-expo);
    }

    .slide.visible .reveal {
      opacity: 1;
      transform: translateY(0);
    }

    .slide.visible .reveal:nth-child(1) { transition-delay: 0.05s; }
    .slide.visible .reveal:nth-child(2) { transition-delay: 0.15s; }
    .slide.visible .reveal:nth-child(3) { transition-delay: 0.25s; }
    .slide.visible .reveal:nth-child(4) { transition-delay: 0.35s; }

    /* === STYLE-SPECIFIC LAYOUTS === */
    /* Add slide-specific layout classes here. */
  </style>
</head>
<body>
  <div class="deck-viewport">
    <main class="deck-stage" id="deckStage" aria-live="polite">

      <section class="slide title-slide active visible" data-slide-title="Title">
        <!-- Slide content authored at 1920×1080 -->
      </section>

      <section class="slide evidence-slide" data-slide-title="Finding">
        <!-- Slide content -->
      </section>

    </main>
  </div>

  <nav class="deck-controls" aria-label="Presentation controls">
    <button id="prevSlide" type="button" aria-label="Previous slide">‹</button>
    <span id="slideCounter">1 / 1</span>
    <button id="nextSlide" type="button" aria-label="Next slide">›</button>
  </nav>

  <script>
    class EvidenceSlideDeck {
      constructor() {
        this.slides = Array.from(document.querySelectorAll(".slide"));
        this.stage = document.getElementById("deckStage");
        this.current = 0;
        this.counter = document.getElementById("slideCounter");
        this.setupStageScale();
        this.setupKeyboard();
        this.setupButtons();
        this.setupTouch();
        this.show(0);
      }

      setupStageScale() {
        const scale = () => {
          const factor = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
          const x = (window.innerWidth - 1920 * factor) / 2;
          const y = (window.innerHeight - 1080 * factor) / 2;
          this.stage.style.transform = `translate(${x}px, ${y}px) scale(${factor})`;
        };
        scale();
        window.addEventListener("resize", scale);
      }

      setupKeyboard() {
        window.addEventListener("keydown", (event) => {
          if (event.key === "ArrowRight" || event.key === " " || event.key === "PageDown") {
            event.preventDefault();
            this.next();
          }
          if (event.key === "ArrowLeft" || event.key === "PageUp") {
            event.preventDefault();
            this.prev();
          }
          if (event.key === "Home") {
            event.preventDefault();
            this.show(0);
          }
          if (event.key === "End") {
            event.preventDefault();
            this.show(this.slides.length - 1);
          }
        });
      }

      setupButtons() {
        document.getElementById("prevSlide")?.addEventListener("click", () => this.prev());
        document.getElementById("nextSlide")?.addEventListener("click", () => this.next());
      }

      setupTouch() {
        let startX = 0;
        let startY = 0;
        window.addEventListener("touchstart", (event) => {
          const touch = event.changedTouches[0];
          startX = touch.clientX;
          startY = touch.clientY;
        }, { passive: true });

        window.addEventListener("touchend", (event) => {
          const touch = event.changedTouches[0];
          const dx = touch.clientX - startX;
          const dy = touch.clientY - startY;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            dx < 0 ? this.next() : this.prev();
          }
        }, { passive: true });
      }

      show(index) {
        this.current = Math.max(0, Math.min(index, this.slides.length - 1));
        this.slides.forEach((slide, i) => {
          slide.classList.toggle("active", i === this.current);
          slide.classList.toggle("visible", i === this.current);
          slide.setAttribute("aria-hidden", i === this.current ? "false" : "true");
        });
        if (this.counter) {
          this.counter.textContent = `${this.current + 1} / ${this.slides.length}`;
        }
      }

      next() { this.show(this.current + 1); }
      prev() { this.show(this.current - 1); }
    }

    new EvidenceSlideDeck();
  </script>
</body>
</html>
```

## Slide classes to support

A good BI deck should support at least:

- `.title-slide`
- `.answer-slide`
- `.kpi-slide`
- `.evidence-slide`
- `.chart-focus-slide`
- `.comparison-slide`
- `.recommendation-slide`
- `.caveat-slide`
- `.appendix-slide`

## Accessibility notes

- Give images meaningful `alt` text.
- Keep contrast strong.
- Avoid encoding essential findings only in color.
- Use readable text sizes.
- Keep chart screenshots large enough to read.
- Prefer short sentences and explicit labels.
