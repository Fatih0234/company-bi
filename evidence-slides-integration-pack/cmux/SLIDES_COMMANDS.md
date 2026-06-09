# Proposed CMUX Slide Commands

These actions can be manually merged into `.cmux/cmux.json`.

Do not overwrite the whole file.

## Actions

### Evidence: Create Slides From Report

Runs:

```bash
pi /slides-from-report
```

Expected output:

```text
reports/<slug>/slides/story.json
reports/<slug>/slides/storyboard.md
reports/<slug>/slides/index.html
```

### Evidence: Draft Slide Storyboard

Runs:

```bash
pi /slides-storyboard
```

Expected output:

```text
reports/<slug>/slides/story.json
reports/<slug>/slides/storyboard.md
```

### Evidence: Review Slide Deck

Runs:

```bash
pi /slides-review
```

Checks existing generated deck.

## Notes

Depending on how Pi is launched in your project, the command may need to use:

```bash
./bin/lumen-pi /slides-from-report
```

or:

```bash
./bin/pi-full /slides-from-report
```

Prefer the same agent launcher already used by `.cmux/evidence.json`.
