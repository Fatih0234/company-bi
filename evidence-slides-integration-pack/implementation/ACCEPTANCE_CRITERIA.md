# Acceptance Criteria

## MVP accepted when

### Skill discovery

- [ ] `.pi/skills/evidence-slides/SKILL.md` exists.
- [ ] SKILL frontmatter has valid `name` and `description`.
- [ ] Pi can load `/skill:evidence-slides`.
- [ ] Skill references supporting files with relative paths.

### Prompt templates

- [ ] `.pi/prompts/slides-from-report.md` exists.
- [ ] `.pi/prompts/slides-storyboard.md` exists.
- [ ] `.pi/prompts/slides-review.md` exists.
- [ ] Pi shows or expands these prompt templates.

### Output behavior

Given a workspace with `pages/report.md`, the agent can create:

- [ ] `reports/<slug>/slides/story.json`
- [ ] `reports/<slug>/slides/storyboard.md`
- [ ] `reports/<slug>/slides/index.html`

### Story quality

- [ ] Business question is explicit.
- [ ] One-sentence answer is present.
- [ ] Findings map to evidence.
- [ ] Caveats are visible.
- [ ] Recommendations are justified or withheld.

### Deck technical quality

- [ ] HTML is self-contained except relative assets and font URLs.
- [ ] Uses `.deck-viewport`.
- [ ] Uses `.deck-stage`.
- [ ] Uses `.slide`.
- [ ] Stage is 1920×1080.
- [ ] Slide navigation works.
- [ ] No obvious overflow or overlapping panels.
- [ ] Relative assets load.

### Repo safety

- [ ] No env files changed.
- [ ] No connection YAML changed.
- [ ] No `bin/**` or `scripts/**` changed.
- [ ] No package files changed.
- [ ] No `.pi/extensions/**` runtime code added unless explicitly approved.

## Stretch accepted when

- [ ] Three style previews can be generated.
- [ ] Report annotation markers are used when present.
- [ ] Chart screenshots are captured into `slides/assets/`.
- [ ] Static deck validator exists.
- [ ] PDF export works.
