# AGENTS.md

## Project Model

Company BI / LUMEN is a local-first BI workspace system built around Evidence, Pi Coding Agent, CMUX, DuckDB, and project-local Pi resources.

- The root repository owns runtime code, CLI helpers, Pi assets, docs indexes, tests, and the Evidence app template.
- Generated content-only workspaces own analysis content: `pages/`, `queries/`, `reports/`, `data/`, and `.cmux/` metadata.
- Shadow runtime directories are generated Evidence apps used by the dev server. Do not edit shadow runtime files directly unless the task is explicitly about runtime generation.
- Prefer `.cmux/workspace.json` and `.cmux/evidence.json` over hard-coded path conventions.

## Task Modes

- Root development: edit `bin/`, `scripts/`, `pi-pkg/`, `tests/`, and docs only as requested.
- Pi asset development: extensions, skills, prompt templates, and themes live under `pi-pkg/` and must be registered in `pi-pkg/package.json`.
- Evidence dashboard authoring: in content workspaces, prefer `pages/**`, `queries/**`, and `reports/**`.
- Data registry / DuckDB work: use registered source names such as `files.orders` in Evidence page SQL. Refresh the registry after adding files under `data/`.
- CMUX/browser-preview work: validate meaningful dashboard changes with the workspace helper and preview/browser surface when available.
- Publishing/privacy flows: publishing shares the polished report and `queries/**` by default. Draft notes, local data, scratch files, credentials, and runtime files stay private unless explicitly requested.

## Safety

- Do not read, quote, or expose `.env*`, `**/connection.yaml`, credentials, tokens, or private local data values.
- Do not use raw file readers such as `read_csv_auto()`, `read_parquet()`, or `read_json_auto()` inside Evidence page SQL. Use registered source names.
- Do not edit package/runtime/source files from a content-only dashboard task unless the user explicitly asks for app or source changes.
- Treat `data/` as local analysis input. Summarize structure and aggregate findings, not raw private records, unless the user explicitly asks.
- If workspace metadata defines a stricter path policy, follow the stricter policy.

## Docs Routing

- Evidence OSS components and syntax: start with `.agent/docs/evidence-oss/ROUTES.md`.
- Pi extensions, skills, packages, settings, prompts, and hooks: start with `.agent/docs/pi/ROUTES.md`.
- CMUX workspace, panes, browser surfaces, and lifecycle: start with `.agent/docs/cmux-com/ROUTES.md`.
- Do not paste upstream docs into agent instructions. Route to the indexed docs and read the specific page needed for the task.

## Validation

- Root Python tests: `python3 -m pytest tests`
- Content workspace validation: use the workspace helper from `.cmux/evidence.json` or `.cmux/workspace.json`, then run `validate`.
- Dashboard changes: test SQL first, validate the Evidence build, and inspect the preview when possible.
- Pi asset tests: run `npm test` in the asset directory when it provides tests.

## Post-Implementation Registration Rule

**CRITICAL: After implementing any new extension, skill, prompt template, or theme, you MUST register it in `pi-pkg/package.json` under the appropriate `pi` section.**

### Why This Matters

- The `bin/lumen-pi` script loads extensions from `pi-pkg/` via `-e "$PROJECT_ROOT/pi-pkg"`
- Workspaces inherit extensions from the root `pi-pkg/package.json`
- If you don't register your implementation, it won't be loaded by Pi
- This is a common source of "it works in isolation but not in the workspace" bugs

### Registration Locations

| Asset Type | Registration Location |
|------------|----------------------|
| Extensions | `pi-pkg/package.json` -> `pi.extensions` array |
| Skills | `pi-pkg/package.json` -> `pi.skills` array |
| Prompt Templates | `pi-pkg/package.json` -> `pi.prompts` array |
| Themes | `pi-pkg/package.json` -> `pi.themes` array |

### Registration Format

```json
{
  "pi": {
    "extensions": [
      "./extensions/existing-extension.ts",
      "./extensions/new-extension"
    ],
    "skills": [
      "./skills/existing-skill",
      "./skills/new-skill"
    ]
  }
}
```

### Post-Implementation Checklist

After implementing any new Pi asset:

1. Asset created in `pi-pkg/extensions/`, `pi-pkg/skills/`, `pi-pkg/prompts/`, or `pi-pkg/themes/`
2. Asset registered in `pi-pkg/package.json` under the correct `pi` section
3. Tests pass (`npm test` in the asset directory when available)
4. New workspaces will pick up the asset automatically
5. Existing workspaces may need manual sync or recreation

### Common Mistakes to Avoid

- Creating an extension but forgetting to register it
- Registering with the wrong path, such as `./extensions/new.ts` when the asset is a directory
- Testing an asset in isolation but not through `bin/lumen-pi` or a real workspace
- Assuming existing workspaces automatically receive generated file changes
