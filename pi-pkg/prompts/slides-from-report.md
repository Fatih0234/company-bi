---
description: Create a presentation deck from the current Evidence BI report
argument-hint: "[audience/density/style notes]"
---

Use the `evidence-slides` skill to turn the current Evidence BI workspace report into a presentation deck.

Additional user notes, if any:

```text
$ARGUMENTS
```

Work in this order:

1. Load the `evidence-slides` skill.
2. Read `.cmux/workspace.json` if present.
3. Read `pages/report.md`.
4. Read `pages/draft.md` only if the report is incomplete or lacks context.
5. Inspect relevant `queries/**` for evidence traceability.
6. Extract a story model and write it to `reports/<slug>/slides/story.json`.
7. Create `reports/<slug>/slides/storyboard.md`.
8. Generate `reports/<slug>/slides/index.html` as a fixed-stage, self-contained HTML deck.
9. Keep assets under `reports/<slug>/slides/assets/`.
10. Validate deck structure, asset paths, slide count, and readability as far as available tools allow.

Do not edit package files, scripts, extension code, connection files, or env files.

At the end, report exact files created, assumptions, validation performed, and remaining checks.
