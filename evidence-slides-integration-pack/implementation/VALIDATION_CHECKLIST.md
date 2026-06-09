# Validation Checklist

## Before running slide generation

- [ ] Current workspace has a meaningful `pages/report.md`.
- [ ] The report has a clear business question or goal.
- [ ] Queries used for findings are present under `queries/**` or described in report.
- [ ] If using screenshots, the Evidence preview server is running.

## After story extraction

Check `reports/<slug>/slides/story.json`:

- [ ] Valid JSON.
- [ ] Includes `business_question`.
- [ ] Includes `one_sentence_answer`.
- [ ] Includes `key_findings`.
- [ ] Each finding has supporting evidence.
- [ ] Caveats are present where needed.
- [ ] Assumptions are explicit.

## After storyboard

Check `reports/<slug>/slides/storyboard.md`:

- [ ] Slide sequence makes sense.
- [ ] Slide titles state claims.
- [ ] Each slide has purpose and main message.
- [ ] Evidence assets needed are listed.
- [ ] Audience/density is recorded.
- [ ] Validation plan exists.

## After HTML deck generation

Check `reports/<slug>/slides/index.html`:

- [ ] Opens in browser.
- [ ] Arrow keys navigate.
- [ ] Buttons navigate.
- [ ] Slide counter updates.
- [ ] Only one slide visible at a time.
- [ ] Images load.
- [ ] Text is readable.
- [ ] No overflow.
- [ ] No panels overlap.
- [ ] Deck still looks correct at 1280×720.
- [ ] Deck is usable on phone viewport by letterboxing/pillarboxing, not reflow.

## Evidence validation

Run:

```bash
./bin/cmux-evidence validate
```

When possible, also run or inspect:

```bash
./bin/cmux-evidence diff --stat
```

## Final report

Include:

- [ ] Files created.
- [ ] Slide count.
- [ ] Source report path.
- [ ] Validation performed.
- [ ] What was not checked.
- [ ] Any manual review needed.
