# Frontend Slides Adaptation Notes

This project borrows selected ideas from the `frontend-slides` skill, but adapts them to Evidence BI work.

## Borrow

- Single self-contained HTML decks.
- Fixed 1920×1080 stage scaled to viewport.
- Three style previews when visual choice matters.
- Strong design constraints.
- Progressive disclosure of style references.
- Inline CSS/JS; no build tool requirement for generated decks.
- Optional PDF export via browser screenshots.

## Do not borrow by default

- PowerPoint conversion flow.
- Claude Code plugin install language.
- Vercel deployment as the primary sharing path.
- Generic "topic to presentation" mode.
- Huge visual template library without BI-specific selection rules.

## Why this adaptation is different

A BI-to-slides workflow has a known analytical source:

- business question
- report
- queries
- charts
- caveats
- recommendations

Therefore the agent should not start with open-ended "what is your presentation about?" questions. It should first read the current workspace and infer:

- the purpose of the deck,
- the analytical story,
- the evidence needed,
- the audience assumptions,
- the slide sequence.

Questions should be targeted, not broad.

## New responsibilities added by this adaptation

The agent must:

- extract a business story from `pages/report.md`,
- maintain evidence traceability,
- choose which charts/findings deserve slides,
- turn dashboard visuals into slide exhibits,
- preserve caveats and data limits,
- avoid overclaiming,
- generate a storyboard before final HTML,
- validate deck fit and readability.

## Output philosophy

A dashboard lets the viewer explore. A slide deck guides the viewer through a decision.

That means the deck should not reproduce the dashboard page-by-page. It should sequence the argument:

1. What question mattered?
2. What did we find?
3. Why should the audience care?
4. What evidence proves it?
5. What should happen next?
6. What caveats constrain the decision?
