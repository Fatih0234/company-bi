# Company BI — Project Analysis

> Captured at the start of an iteration session. This is a snapshot of what exists, what's wired up, what's still rough, and where the obvious next steps are.

## 1. What this project is

A **local-first, Git-backed workspace for building Evidence BI dashboards with a coding agent (Pi) inside CMUX**.

Three coupled ideas:

1. **Evidence** renders the dashboard. Authoring is Markdown + fenced SQL; rendering uses Svelte components (`BigValue`, `LineChart`, `BarChart`, `DataTable`, `Dropdown`, `Grid`, …). DuckDB is the local query engine.
2. **Pi Coding Agent** is the dashboard-authoring assistant. It edits Markdown/SQL, inspects sources, and looks at the browser preview.
3. **CMUX** is the runtime UI. A three-pane workspace (Pi agent, Evidence browser preview, Evidence dev server) with Command Palette actions and a sidebar that the agent can talk to.

A separate **business layer** — "LUMEN — Midnight Intelligence" — is the project identity: dark theme, branded TUI header, "Evidence BI" prompt.

The data behind the first demo is a 3-month slice of NYC TLC taxi trip data (yellow + green), with a zones lookup, synced from a local MinIO bucket.

## 2. High-level architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Root project (main checkout, port 3000)                            │
│                                                                     │
│  ┌── bin/cmux-evidence ──────────┐   ┌── .cmux/evidence.json ──┐    │
│  │  Python CLI, ~2078 lines      │   │  Project config         │    │
│  │  - new / open / list / current│   │  (port, paths, edit     │    │
│  │  - context / status / preview │   │   policy, AI defaults)  │    │
│  │  - validate / diff / publish  │   └─────────────────────────┘    │
│  └───┬───────────────────────────┘                                   │
│      │ creates                                                       │
│      ▼                                                               │
│  ┌── .workspaces/<slug> ── Git worktree + branch ───────────────┐   │
│  │  ├── .cmux/workspace.json  (durable analysis metadata)       │   │
│  │  ├── .cmux/evidence.json   (per-worktree config)             │   │
│  │  ├── .cmux/pi-context.md   (legacy/fallback snapshot)        │   │
│  │  ├── pages/analysis/<slug>.md (analysis page w/ brief)       │   │
│  │  ├── .pi/                  (copied package: ext + skills)    │   │
│  │  └── bin/lumen-pi          (wrapper → `pi -e ./.pi`)         │   │
│  └───┬──────────────────────────────────────────────────────────┘   │
│      │ launches                                                      │
│      ▼                                                               │
│  ┌── CMUX workspace ───────────────────────────────────────────┐    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │    │
│  │  │ Pi (LUMEN)   │  │ Browser      │  │ Dev server   │        │    │
│  │  │ agent pane   │  │ preview pane │  │ log pane     │        │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌── .cmux/registry.json (global workspace registry) ──────────┐   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

External (out-of-repo):
  - MinIO bucket demo-lake  (Parquet + zones CSV)
  - Pi global settings + model registry
  - CMUX binary + config
  - Indexed external sources in .agent/repos/{evidence,cmux,pi}
```

## 3. The CLI is the heart: `bin/cmux-evidence`

A 2,078-line Python script that owns the entire workflow. It is intentionally the only "product" surface today. Commands:

| Command | Purpose |
|---|---|
| `(no args)` / `open` | Open CMUX workspace at the current path or by slug |
| `new [title]` | Onboard a new analysis (interactive) → worktree + branch + page + CMUX |
| `list` | Print registered analyses |
| `current` | Print `.cmux/workspace.json` |
| `status` | Workspace + Git + port reachability |
| `context` | Regenerate `.cmux/pi-context.md` |
| `preview-url` / `preview-open` / `browser-surfaces` | CMUX browser preview helpers |
| `preview-title` / `preview-snapshot` / `preview-screenshot` | Browser automation for Pi |
| `validate` | Run `npm run build` (or `validateCommand`) |
| `diff` | Git status + diff |
| `publish` | Validate → diff → confirm → commit → push → `gh pr create` |

Notable design choices baked in:

- **One analysis = one worktree + one branch + one port + one page + one CMUX workspace + one Pi session.** Hard rule, encoded in the spec docs.
- **Slug uniqueness** is enforced by appending `-2`, `-3`, … when names collide.
- **Port allocation** starts at `analysisBasePort` (3100) and picks the first free port not already used by another registered workspace.
- **Path policy** (`allowedAgentPaths`, `askBeforeAgentPaths`, `blockedAgentPaths`) lives in `.cmux/evidence.json` and is enforced on `publish` (refuses to commit blocked paths).
- **Metadata is durable.** Every analysis gets a `.cmux/workspace.json` AND is upserted into the global registry (`.cmux/registry.json`). Commands read metadata instead of guessing.
- **`publish` is conservative.** Validates, prints diff, requires typing `publish` literally, then commits/pushes/opens PR. No auto-merge.
- **Non-interactive flows never block.** If stdin is not a TTY, `new` returns an empty `intention` object and skips the prompts. Same for `pi -p --no-session` style AI enrichment in CI/script use.

## 4. The onboarding flow

This is the most user-facing piece and it has been iterated on heavily (see `17_ANALYSIS_INTENTION_ONBOARDING.md`, `18_ONBOARDING_TEST_NOTES.md`, `19_ONBOARDING_TUI_AND_PI_MODEL_CONTEXT.md`).

`cmux-evidence new "My Analysis"` runs:

1. **Title prompt** (skipped if provided as arg or non-TTY).
2. **Intention brief** (interactive TTY only):
   - Main goal
   - Specific dashboard questions (multi-line)
   - Stakeholders / audience
   - Success criteria
   - Optional: **AI enrichment** via Pi headless (`pi -p --no-session --provider ... --model ... --thinking ... --no-tools`)
     - Uses safe source SQL files as a data catalog
     - Includes an Evidence capability brief so suggestions are grounded in what Evidence can build
     - Returns `suggestedQuestions`, `suggestedDashboardOptions`, `suggestedSuccessCriteria`, `suggestedAssumptions`, `clarifyingQuestions`
     - User picks via numbered accept/reject
   - Clarifying questions answered inline or stored as `openQuestions`
3. **Summary review** of the assembled brief.
4. **Final confirmation** (cancel before worktree/branch are created).

The intention is stored durably in `.cmux/workspace.json.intention` and rendered into:
- `.cmux/pi-context.md` (legacy/fallback snapshot)
- The visible "Workspace Brief" section in the generated analysis page

The AI enrichment prompt and dataset are explicitly **safe** — they only read `sources/*/*.sql`, never `.env*` or `**/connection.yaml`. The model call uses `--no-tools` and `--no-session`.

The default AI model is read from Pi's settings (`defaultProvider`, `defaultModel`, `defaultThinkingLevel`) with project fallback to `.cmux/evidence.json.onboardingAi`. The model picker is no longer shown by default — onboarding just uses the configured/default model.

## 5. The Pi side

Two pieces make the LUMEN BI agent feel specialized:

### 5.1 App package: `.pi/package.json`

Bundles a curated set of resources:

- **Extensions:** `evidence-context.ts`, `lumen-bi/`
- **Skills:** `evidence-dashboard`, `evidence-dashboard-review`, `evidence-data-semantics`, `cmux-workspace`, `cmux-browser`, `cmux-pi`, `cmux-diagnostics`
- **Prompts:** `evidence-dashboard.md` (the `/evidence-dashboard` prompt)
- **Themes:** `lumen-bi-midnight.json`

Generated worktrees copy these into themselves so they can be iterated on locally without affecting main.

### 5.2 LUMEN launcher: `bin/lumen-pi`

Bash wrapper that runs:

```bash
pi --no-extensions --no-skills --no-prompt-templates --no-themes \
   --session-dir .cmux/pi-sessions \
   -e "$PROJECT_ROOT/.pi" \
   "$@"
```

This **disables global Pi resources** and loads only the project-local LUMEN package. Sessions stay in `.cmux/pi-sessions/` so they don't pollute the global Pi session store.

### 5.3 Dynamic context: `.pi/extensions/evidence-context.ts`

This is the most important Pi extension. On each user turn it:

- Reads `.cmux/evidence.json`, `.cmux/workspace.json` (if present), CMUX env vars, `evidence.config.yaml`, and `sources/*/*.sql`
- Heuristically infers columns / time fields / measures / dimensions from each source's SQL
- Renders a compact **Dynamic Evidence Context** block and appends it to the system prompt via `before_agent_start`
- Intentionally does **not** read `.env*`, `**/connection.yaml`, raw data, or MinIO creds

It also registers Pi commands:

- `/evidence-context` — print the generated context
- `/workspace-status` (with `--debug`) — compact card with workspace facts, Git changes, CMUX anchors
- `/workspace-summary` (with `--full`) — brief + detected dashboard state + suggested next step
- `/workspace-list` — interactive selector of registered workspaces; Enter opens via `bin/cmux-evidence open <slug>`; `--text` for plain output
- `/workspace-cleanup-plan` — read-only safety review

The report-style commands use `pi.sendMessage` + a custom message renderer to draw nice cards in the TUI, avoiding raw `console.log` interleaving.

### 5.4 LUMEN header: `.pi/extensions/lumen-bi/index.ts`

Sets an animated ASCII "LUMEN" block-letter header in the TUI, with a slow diagonal sweep highlight. Two slash commands toggle it: `/lumen-header` and `/default-header`.

### 5.5 Skills (purpose-built)

| Skill | Posture | When to use |
|---|---|---|
| `evidence-dashboard` | **Builder** | Create or revise dashboards |
| `evidence-dashboard-review` | **Read-only reviewer** | Critique, QA, "does this look right?" |
| `evidence-data-semantics` | **Semantic reasoner** | Metric definitions, source SQL interpretation, choosing dimensions/measures |
| `cmux-workspace` | CMUX behavior | Caller vs focused workspace, non-disruptive automation |
| `cmux-browser` | CMUX behavior | Browser preview inspection |
| `cmux-pi` | CMUX behavior | Pi + CMUX conventions |
| `cmux-diagnostics` | CMUX behavior | When CMUX/socket/browser/dev-server is broken |

The CMUX skills are the bundled ones from the user's CMUX installation, selectively copied.

## 6. Data layer

- **Source of truth:** MinIO bucket `demo-lake` with TLC yellow/green parquet + zone lookup CSV.
- **Local sync:** `scripts/sync_tlc_lake_from_minio.sh` mirrors selected files into `data/tlc/raw/{yellow,green}` and `data/tlc/reference`.
- **Evidence datasource:** `sources/tlc/` with `trips.sql` (combines yellow+green via DuckDB `read_parquet`) and `zones.sql` (`read_csv_auto` from the zone lookup). `connection.yaml` configures an in-memory DuckDB.
- **Worktrees reuse the source manifest.** `scripts/ensure_evidence_sources.sh` links `.evidence/template/static/data` from the main checkout, and symlinks `data/tlc` if missing — so each worktree doesn't have to re-run `evidence sources`.
- **Local data volume:** 3 months of 2024 NYC TLC. Yellow: ~160 MB parquet total. Green: ~4 MB. Zones: 12 KB CSV. Small enough for fast iteration.

## 7. CMUX integration

`.cmux/cmux.json` exposes 7 palette actions:

- `Evidence: New Analysis`
- `Evidence: List Analyses`
- `Evidence: Current Analysis`
- `Evidence: Status`
- `Evidence: Validate Dashboard`
- `Evidence: Show Diff`
- `Evidence: Publish Draft`

All are `type: command` actions targeting `currentTerminal` with `palette: true`. No shortcuts — they go through Cmd+Shift+P.

The CLI also runs best-effort CMUX commands when `CMUX_WORKSPACE_ID` is set:
- `set-progress 0.2 → 0.6 → 0.9` during publish
- `notify` on success
- `clear-progress` on finish
- `set-status preview ok/fail` is mentioned in docs but not yet implemented in CLI

Browser automation commands the CLI wraps:
- `cmux list-pane-surfaces --workspace ... --json`
- `cmux browser <surface> eval "document.title"`
- `cmux browser <surface> snapshot --interactive`
- `cmux browser <surface> screenshot --path ...`

The CLI does **not** auto-detect surfaces by URL match yet — that is in the spec as "optional auto-detection" but not implemented.

## 8. What exists, what doesn't (current state)

### Working / proven

- One-command onboarding flow that produces a real Git worktree, page, port, and CMUX workspace.
- AI enrichment via headless Pi with safe-data-catalog grounding.
- Per-turn dynamic context injection (extension) + per-workspace fallback snapshot (`.cmux/pi-context.md`).
- LUMEN-themed Pi session with curated skills.
- Browser preview helpers for the agent.
- `validate` / `diff` / `publish` end-to-end with `gh pr create` integration.
- Global registry + per-worktree metadata.
- Conservative publish flow (confirmation, blocked-path check, status update).
- Tested against 10 onboarding scenarios in `18_ONBOARDING_TEST_NOTES.md` — all pass.

### Implemented but rough / placeholders

- The existing practice pages (`airport-taxi-demand-and-revenue-patterns`, `airport-taxi-demand-and-revenue-patterns2`, `my-first`, `taxi-operations-dashboard-test`) all still have the **starter `select 1 as example_metric` draft query** and the auto-generated `Workspace Brief`. None of them have been built into a real dashboard yet — the loop is set up but the actual dashboard-building is the part that has not been exercised in earnest.
- AI enrichment occasionally produces awkward artifacts. Example: in the airport analysis `goal` was truncated to "Help airport operations and city mobility teams understand taxi demand, revenue, and service patterns for" and the next item in `questions` is the orphan fragment "airport-related trips." This is an enumeration/jitter issue in the model.
- `suggestedQuestions` are not deduplicated against user-provided `questions` consistently (some are repeated). `dedupe_append` exists but is not applied uniformly.
- The numbered multi-select UI for AI suggestions is plain stdin prompts. Works, but not a real TUI.
- `--no-open` works for `new` but there is no equivalent for `open` re-binding when the CMUX workspace already exists.
- No conflict detection when a registered workspace's `path` no longer exists.
- No retry / health check on the Evidence dev server; `status` just pings the port.
- `preview-open` does not currently attach to an existing browser pane or refresh the URL.

### Spec'd but not implemented

- `cmux-evidence registry import-local` migration command.
- `cmux-evidence archive <slug>` for hiding completed analyses (referenced in `/workspace-cleanup-plan` but not implemented).
- `cmux-evidence delete` (worktree + branch) — explicitly out of scope for v1.
- `cmux-evidence new-interactive` or `--goal / --question / ...` CLI flags.
- `pi --list-models --json` (Pi upstream) and `pi --render-markdown` (Pi upstream) — both would be helpful.
- CMUX tab-bar button for "Analyses".
- Surface auto-detection by URL match.
- Status indicator on the CMUX sidebar (`set-status preview ok/fail`).

### Known data quality / safety things

- `evidence-context.ts` infers column types from SQL with simple regex — anything outside the heuristic gets `not inferred` and Pi is told to verify. This is correct posture but it means Pi has to actually read the SQL.
- AI enrichment uses the **safe source catalog** (SQL only). It cannot see the actual rows, so suggestions are scoped to what the SQL says it can produce.
- Workspace metadata is JSON-in-Git; that means a sloppy commit could put a workspace in a half-broken state. The `publish` blocked-path check is the only safety net today.

## 9. Working tree state vs origin

`git status` shows uncommitted changes:

- Modified: `.cmux/evidence.json`, `.pi/extensions/README.md`, `.pi/prompts/evidence-dashboard.md`, `.pi/skills/evidence-dashboard/SKILL.md`, `AGENTS.md`, `bin/cmux-evidence`, plus the four implementation docs (10/13/14).
- Untracked: `.pi/extensions/evidence-context.ts`, `.pi/extensions/lumen-bi/`, `.pi/package.json`, `.pi/settings.json`, `.pi/skills/evidence-dashboard-review/`, `.pi/skills/evidence-data-semantics/`, `.pi/themes/`, `bin/lumen-pi`, `implementation-docs/{17..20}*.md`.

So a meaningful chunk of v1 — the dynamic context extension, the LUMEN package, the theme, the lumen-pi launcher, the two new skills, the onboarding docs — is **not yet committed**. This is the most obvious immediate cleanup: turn the working tree into a clean set of commits on main.

## 10. The four existing analysis worktrees

| Slug | Status | Notable |
|---|---|---|
| `airport-taxi-demand-and-revenue-patterns` | draft | Has the most thoughtful brief (8 questions, 7 criteria, 5 options, 3 clarifications). Page is still on the starter draft. |
| `airport-taxi-demand-and-revenue-patterns2` | draft | Cleaner goal/title. Same status. |
| `my-first` | draft | Oldest. Goal is "Taxi Demand Test" — clearly an early test of the flow. |
| `taxi-operations-dashboard-test` | draft | Last to be created (port 3105). |

These are all the **smoke-test workspaces** for the onboarding flow itself. They prove the loop works but contain zero real dashboards. The next natural step is to actually build out one or two of them with a real dashboard, end-to-end, to see what the agent + Evidence + CMUX preview loop actually feels like under real conditions.

## 11. The QA onboarding files in `.workspaces/`

There are also four short-lived QA worktrees (`qa-onboarding-ai-20260605172450`, `qa-onboarding-ai-fail-20260605172450`, `qa-onboarding-no-ai-20260605172450`, `qa-onboarding-noninteractive-20260605172450`). They are remnants of the onboarding test pass and are not registered in the registry — basically scratch directories. They can be cleaned up safely.

## 12. What the "LUMEN" identity actually is

The LUMEN concept is more than a theme:

- `lumen-bi` extension sets a custom TUI header on `session_start` and on `/lumen-header`.
- `lumen-bi-midnight` theme defines a dark navy/cyan/violet palette with semantic tokens for tools, markdown, syntax, and thinking levels.
- `.pi/settings.json` selects the theme.
- The Bash launcher is named `bin/lumen-pi`, not `pi-evidence` or similar.

It's a coherent product identity, but the README and most docs still use the "CMUX + Evidence" / "company-bi" naming. There is a small branding gap — probably worth a final pass to pick one of:

- "LUMEN" as the umbrella product name
- "Company BI" as the project / workspace name
- "CMUX + Evidence" as the technical description

## 13. Top-of-mind gaps & next-step candidates

Sorted by how much they would unblock real use:

1. **Commit the uncommitted v1 work.** Without it, a fresh clone cannot reproduce the LUMEN/Evidence dashboard-agent experience. The diff is meaningful but not huge.

2. **Build one real dashboard end-to-end.** Pick one of the four existing workspaces (the `airport-taxi-demand-and-revenue-patterns` brief is the most complete) and have the agent build it. This will surface:
   - Are the inferred columns in the source catalog actually right?
   - Does the LUMEN agent stay in its lane with the safe edit policy?
   - Does the preview-snapshot helper actually find a useful render?
   - Does `validate` (`npm run build`) catch what we expect?

3. **Add a "real demo" / "canonical example" workspace.** Today the example page `pages/analysis/mobility-overview.md` is a hand-written static dashboard. Promoting one of the AI-assisted analyses to canonical-example status (or building a fresh one) would give users something to point at.

4. **Wire the workspace commands into the CLI surface.** `/workspace-list` opens via `bin/cmux-evidence open <slug>`, but there is no first-class `cmux-evidence archive` / `cmux-evidence delete` for the user to act on the cleanup plan the agent suggests.

5. **Document the LUMEN/PI provider & auth posture.** The flow depends on `pi --provider opencode --model mimo-v2.5-free` working, but there is no onboarding doc telling a new user how to get those credentials set up. This is the single biggest blocker for handing the project to someone else.

6. **Polish the starter page rendering.** The auto-generated `Workspace Brief` is verbose. For larger real briefs the Markdown becomes hard to scan. Some kind of collapsible section / TOC would help.

7. **Add a `--goal / --question / ...` non-interactive flag set** to `new` so CI/automation can create workspaces without the prompt dance.

8. **Clean up the QA worktrees** that are still sitting in `.workspaces/`.

## 14. How I'd use this analysis

- As a **map**: any time I forget which file owns which responsibility, this is the lookup.
- As a **gap list**: section 13 is the candidate backlog.
- As a **contract**: section 3-7 are the moving parts future code has to respect.
- As a **handoff doc**: section 1-2 + section 5 should be enough for a new collaborator to start being useful within an hour.

Open question to resolve: do you want me to (a) keep this in `docs/analysis/` as living project documentation, (b) roll the gaps into a `.pi/todos/` task, or (c) both? I lean toward (c) — the analysis document is reference material, the todo is the work tracker.
