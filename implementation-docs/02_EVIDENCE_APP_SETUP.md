# Step 02: Evidence App Setup

## Goal

Turn the bootstrapped repository into a minimal Evidence app that can run locally and render a dashboard page.

This step should produce a working Evidence app before any CMUX automation is added.

## Expected project shape

By the end of this step, the project should include:

```text
package.json
pages/
  index.md
  analysis/
    dashboard-draft.md
sources/
queries/
.cmux/evidence.json
```

## Create `package.json`

Create or update `package.json`:

```json
{
  "name": "cmux-evidence-workspace",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "evidence dev",
    "sources": "evidence sources",
    "build": "evidence build",
    "build:strict": "evidence build:strict",
    "preview": "evidence preview"
  },
  "dependencies": {
    "@evidence-dev/evidence": "latest"
  }
}
```

Then install dependencies:

```bash
npm install
```

If you prefer a pinned Evidence version, replace `latest` with the chosen version and commit the lockfile.

## Create the home page

Create `pages/index.md`:

```markdown
# Evidence Agent Workspace

This project is a local-first workspace for creating Evidence dashboards with a coding agent.

## Current workflow

1. Open the project with `cmux-evidence .`
2. Ask Pi to create or revise a dashboard.
3. Preview changes in the Evidence browser pane.
4. Validate and publish through Git.
```

## Create the first draft page

Create `pages/analysis/dashboard-draft.md`:

````markdown
# Dashboard Draft

This is the starting analysis page.

Ask Pi to turn this Markdown file into an Evidence dashboard.

## Notes

- Use existing data sources when available.
- Keep analysis-specific work in this page.
- Avoid editing shared data-source configuration.

```sql draft_query
select 1 as example_metric
```

<DataTable data={draft_query} />
````

## Start Evidence manually

Before using CMUX, verify Evidence directly:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Expected result:

- The home page renders.
- The dashboard draft page is visible in navigation or reachable directly.
- Editing the Markdown file updates the browser after saving.

Stop the server with `Ctrl+C`.

## Validate the build

Run:

```bash
npm run build:strict
```

Expected result:

- The build succeeds.
- A `build/` directory is generated.
- The generated `build/` directory remains uncommitted because it is ignored.

## Data source policy for version 1

Do not create live database credentials in this step.

Use one of these safe options:

1. Keep the project data-free for now.
2. Add a local CSV source later.
3. Add a DuckDB or file-based demo source later.
4. Add real database sources only after the security boundaries are defined.

Keep secrets out of the repository.

## Commit the Evidence app

```bash
git add package.json package-lock.json pages .cmux .pi .gitignore README.md
git commit -m "Create minimal Evidence app"
```

If your package manager creates a different lockfile, commit that lockfile instead.

## Acceptance criteria

This step is complete when:

```bash
npm run dev
npm run build:strict
git status --short
```

confirm that:

- The dev server starts.
- The site renders locally.
- Strict build passes.
- Only intentional source files are committed.
- Generated folders such as `.evidence/` and `build/` are ignored.

## Common mistakes

| Mistake | Fix |
|---|---|
| Building CMUX launcher before Evidence works | First make `npm run dev` reliable. |
| Adding real DB credentials too early | Use demo/local data first. |
| Committing `.evidence/` or `build/` | Keep generated files ignored. |
| Editing source connection files with the agent | Save this for later guarded workflows. |

## Next step

Continue to `03_CMUX_THREE_PANE_LAUNCHER.md`.
