---
description: Review an existing Evidence-generated slide deck
argument-hint: "[path-to-deck-or-slides-folder]"
---

Review the slide deck at:

```text
${1:-reports/*/slides/index.html}
```

Use the `evidence-slides` quality rubric.

Check:

1. Story clarity.
2. Evidence traceability to `pages/report.md`, `queries/**`, and slide assets.
3. Slide readability.
4. Fixed 1920×1080 stage behavior.
5. Navigation.
6. Image paths.
7. Overflow/overlap risks.
8. Caveats and unsupported claims.
9. PDF export readiness if relevant.

Return:

- Summary
- Blocking issues
- Non-blocking suggestions
- Specific file/path references
- Recommended fixes
- Final recommendation:
  - Ready to present
  - Ready after manual visual check
  - Needs story revision
  - Needs technical fixes
