# Install / Apply Instructions

## 1. Copy the skill and prompt templates

From the project root of `company-bi` or a compatible Evidence/CMUX project:

```bash
cp -R .pi/skills/evidence-slides <repo>/.pi/skills/
cp .pi/prompts/slides-from-report.md <repo>/.pi/prompts/
cp .pi/prompts/slides-storyboard.md <repo>/.pi/prompts/
cp .pi/prompts/slides-review.md <repo>/.pi/prompts/
```

If `.pi/prompts/` does not exist:

```bash
mkdir -p <repo>/.pi/prompts
```

## 2. Do not enable the extension yet

The optional extension is intentionally supplied as:

```text
.pi/extensions/evidence-slides/index.ts.draft
```

Pi will not auto-load that file. Keep it as a design document until you are ready to implement deterministic slide tools.

When ready, rename it to:

```text
.pi/extensions/evidence-slides/index.ts
```

Then test it in a trusted local project with `/reload`.

## 3. Optional CMUX actions

Review:

```text
cmux/proposed-cmux-actions.json
```

Then manually merge the relevant action entries into `.cmux/cmux.json`.

Do not overwrite the whole existing `.cmux/cmux.json`.

## 4. Validate skill discovery

In Pi, run or type:

```text
/skill:evidence-slides
```

or use the prompt template:

```text
/slides-from-report
```

## 5. Expected result

The agent should create:

```text
reports/<slug>/slides/story.json
reports/<slug>/slides/storyboard.md
reports/<slug>/slides/index.html
```

The deck should be a self-contained HTML presentation with inline CSS/JS, fixed 1920×1080 slide stage, keyboard navigation, and no external project build requirement.
