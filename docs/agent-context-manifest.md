# Agent Context Manifest

This file maps the durable and dynamic context layers that prepare agents to work in Company BI / LUMEN Evidence workspaces.

## Layer Ownership

| Layer | Files | Audience | Owns | Should not own |
|---|---|---|---|---|
| Root agent instructions | `AGENTS.md` | Generic coding agents, repo developers | Repo model, task modes, safety, docs routing, Pi registration, validation map | Full skill bodies, Evidence component docs, dynamic workspace state |
| Workspace agent instructions | Generated content workspace `AGENTS.md` | Generic agents opened inside a content-only workspace | Workspace edit boundaries, page roles, data rules, validation, privacy | Full data registry dumps, full BI workflow templates, machine-local docs cache paths |
| Workspace metadata | `.cmux/workspace.json`, `.cmux/evidence.json` | CLIs, Pi extensions, generic agents | Current title, intention, roots, pages, port, helper command, safe path policy | Long-form instructions or docs |
| Pi dynamic context | `pi-pkg/extensions/evidence-context.ts` | Pi sessions | Current workspace state, CMUX anchors, source catalog, data registry summary, short state-dependent reminders | Static manuals, full component docs, large source SQL dumps |
| Pi skills | `pi-pkg/skills/*/SKILL.md` | Pi sessions | Task-specific workflows for dashboard authoring, review, BI thinking, data discovery, CMUX/browser work | Runtime metadata, secrets, duplicated root architecture |
| Pi prompt templates | `pi-pkg/prompts/*.md` | Pi sessions when selected | Mode framing and compact quality bars | Mandatory safety policy that non-Pi agents also need |
| Docs routing | `.agent/docs/*/ROUTES.md`, `.agent/docs/*/INDEX.md` | All agents | Fast lookup routes for Evidence, Pi, and CMUX docs | Copied upstream docs or project-specific safety rules |
| Tests | `tests/`, extension package tests | Developers and CI | Regression checks for generated context, package registration, workspace lifecycle, data registry | Product documentation |

## Required Context For Common Entry Points

### Generic Agent At Repo Root

Read:

1. `AGENTS.md`
2. `README.md` for human overview if needed
3. `.cmux/evidence.json` for runtime commands and safe path policy
4. Relevant docs route file under `.agent/docs/`

Expected posture:

- Distinguish root development from dashboard authoring.
- Avoid secret-bearing files and private local data.
- Register new Pi assets in `pi-pkg/package.json`.

### Generic Agent In Content Workspace

Read:

1. `AGENTS.md` in the workspace root
2. `.cmux/workspace.json`
3. `.cmux/evidence.json`
4. `pages/index.md`

Expected posture:

- Edit content, not runtime.
- Use registered `files.<alias>` source names in Evidence page SQL.
- Keep `pages/report.md` publishable and treat `data/` as private.

### Pi Dashboard Session

Receives:

1. Project-local resources from `pi-pkg/package.json`
2. Dynamic context from `evidence-context.ts`
3. Relevant Pi skills loaded on demand
4. Workspace metadata and data registry summaries

Expected posture:

- Use `evidence-dashboard`, `evidence-bi-thinking`, and `data-discovery` for full dashboard work.
- Use quality guard and health-check tooling before declaring completion.
- Inspect CMUX/browser preview after substantial edits when available.

## Context Size Rules

- Root `AGENTS.md`: keep compact and stable; route to docs and skills instead of copying them.
- Workspace `AGENTS.md`: keep under a small, readable brief; include only rules needed by an agent opened directly in the workspace.
- Dynamic context: inject state, not manuals; keep the cap and test core sections.
- Skills: can be detailed because they are task-specific and loaded on demand.

## Regression Expectations

Context changes should update tests when behavior changes:

- Generated content workspaces include `AGENTS.md`.
- Generated `AGENTS.md` reflects configured safe edit policy.
- Root `AGENTS.md` keeps required sections.
- Registered Pi package paths exist.
- Critical Pi assets remain registered.
- Docs route files exist.
- Context files do not include secret contents or machine-local docs cache paths unless explicitly documented as metadata.
