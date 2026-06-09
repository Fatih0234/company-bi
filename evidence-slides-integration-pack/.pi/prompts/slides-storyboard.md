---
description: Draft only the slide storyboard from the current Evidence report
argument-hint: "[audience/density]"
---

Use the `evidence-slides` skill, but stop after creating the storyboard.

Additional user notes:

```text
$ARGUMENTS
```

Read the current Evidence workspace and create:

```text
reports/<slug>/slides/story.json
reports/<slug>/slides/storyboard.md
```

Do not create the final HTML deck yet.

The storyboard must include:

- audience and density assumption,
- core business question,
- one-sentence answer,
- slide-by-slide outline,
- evidence needed for each slide,
- recommended visuals,
- caveats,
- style recommendation,
- validation plan.

Ask for user confirmation only if the report is missing or the narrative is materially ambiguous.
