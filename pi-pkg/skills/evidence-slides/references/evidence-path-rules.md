# Evidence / CMUX Path Rules

Use these path rules unless the project configuration says otherwise.

## Safe generated output

Prefer:

```text
reports/<analysis-slug>/slides/
pages/
queries/
reports/
data/
```

For slide output, prefer:

```text
reports/<analysis-slug>/slides/story.json
reports/<analysis-slug>/slides/storyboard.md
reports/<analysis-slug>/slides/index.html
reports/<analysis-slug>/slides/assets/
reports/<analysis-slug>/slides/_previews/
```

## Read first

```text
.cmux/workspace.json
pages/report.md
pages/draft.md
queries/**
.cmux/data-profile.json
reports/**
data/**
```

## Do not casually edit

These are usually human-controlled or blocked agent paths:

```text
.env*
**/connection.yaml
.github/**
package.json
package-lock.json
bin/**
scripts/**
.pi/extensions/**
```

If changes to these files are needed, stop and produce an implementation plan rather than editing directly.

## Why slides belong in reports/

Slides are communication artifacts derived from a report. They should travel with the report and be visible in the content workspace.

Using `reports/<slug>/slides/` also avoids mixing generated decks into hidden runtime directories or tool implementation folders.
