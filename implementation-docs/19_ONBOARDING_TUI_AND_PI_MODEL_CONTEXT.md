# Onboarding TUI + Pi Model Selection Context

## Why this exists

The current `cmux-evidence new` onboarding flow works, but the terminal UX is too plain and the model-selection semantics are not yet aligned with Pi Coding Agent's `/model` command.

User feedback:

1. The current flow is mostly black/white text and is hard to scan.
2. When declining the default onboarding AI model, the user expects a Pi-like model picker: show models the user actually has access to, prefer the last/current Pi model, and allow choosing something else.
3. If possible, reuse Pi Coding Agent's terminal markdown/TUI formatting outside a normal Pi agent session.

This document captures the source-level context and a proposed design. It is intentionally a context/spec document, not an implementation.

## Current state in `bin/cmux-evidence`

The onboarding flow is a Python CLI.

Relevant functions:

- `collect_analysis_intention(...)`
- `select_onboarding_ai(...)`
- `load_available_pi_models(...)`
- `choose_from_numbered_list(...)`
- `ai_intention_suggestions(...)`
- `accept_suggestions(...)`

Recent improvements already present:

- AI provider/model/thinking can be selected instead of hard-coded.
- `pi --list-models` is used to discover available models.
- `.cmux/evidence.json` has `onboardingAi` defaults.
- AI suggestions include Evidence capability context and `suggestedDashboardOptions`.
- `--no-open` exists.

Current UX problem:

- After answering `n` to `Use AI model ...?`, the CLI asks:

  ```text
  Filter models by text (empty to show first available models):
  ```

  It does not immediately show the available model list, so the user has to know to press Enter. This feels broken compared to Pi's `/model` picker.

Current semantic problem:

- The prompt uses `.cmux/evidence.json` `onboardingAi` as the default, not necessarily Pi Coding Agent's last/current/default model.
- The user meant: use the same model availability/default behavior as `/model` inside Pi.

## Pi Coding Agent model-selection context

### `/model` command behavior

Source:

- `/Users/fatihkarahan/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/src/modes/interactive/interactive-mode.ts`
- `/Users/fatihkarahan/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/src/modes/interactive/components/model-selector.ts`

Flow:

- `/model` calls `handleModelCommand(searchTerm)`.
- Without a search term, it calls `showModelSelector()`.
- With a search term, it first tries exact model match, otherwise opens selector with that initial search.
- The selector uses:

  ```ts
  this.session.modelRegistry.refresh();
  const availableModels = await this.session.modelRegistry.getAvailable();
  ```

- `getAvailable()` means only models from providers with configured/authenticated credentials are shown.
- The selector sorts the current model first and marks it with a check.
- Selecting a model calls:

  ```ts
  this.settingsManager.setDefaultModelAndProvider(model.provider, model.id);
  ```

So `/model` is not just a static model list. It is:

1. current session model first;
2. available/authenticated providers only;
3. fuzzy searchable;
4. persisted as Pi's global default model/provider on selection.

### Pi settings used for current/default model

Source:

- `/Users/fatihkarahan/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/src/core/settings-manager.ts`
- `/Users/fatihkarahan/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/src/config.ts`

Relevant settings keys:

```json
{
  "defaultProvider": "...",
  "defaultModel": "...",
  "defaultThinkingLevel": "medium"
}
```

Default global path:

```text
~/.pi/agent/settings.json
```

Project override path:

```text
.pi/settings.json
```

Pi's `SettingsManager` merges global and project settings.

Important local observation from this machine:

```json
{
  "defaultProvider": "opencode",
  "defaultModel": "mimo-v2.5-free",
  "defaultThinkingLevel": "medium"
}
```

### CLI model listing

Source:

- `/Users/fatihkarahan/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/src/cli/list-models.ts`

The documented CLI surface:

```bash
pi --list-models [search]
```

Implementation detail:

```ts
const models = modelRegistry.getAvailable();
```

So `pi --list-models` is a valid terminal-friendly proxy for the same availability logic used by `/model`.

It prints columns:

```text
provider  model  context  max-out  thinking  images
```

Current limitation:

- It is table text only; there is no documented JSON output for model listing yet.
- A JSON mode from Pi would make downstream tooling much more robust.

## Pi TUI / Markdown formatting context

### What Pi exposes

Docs:

- `/Users/fatihkarahan/.opensrc/repos/github.com/earendil-works/pi/main/packages/coding-agent/docs/tui.md`

Markdown component:

```ts
const md = new Markdown(
  "# Title\n\nSome **bold** text",
  1,
  1,
  theme
);
```

Source/export context:

- `@earendil-works/pi-coding-agent` exports many interactive components and theme utilities, including:
  - `ModelSelectorComponent`
  - `ThinkingSelectorComponent`
  - `getMarkdownTheme`
  - `highlightCode`
  - `Theme`
- `@earendil-works/pi-tui` contains lower-level primitives including `Markdown`, `Text`, `Container`, `Input`, `TUI`, etc.

Current practical constraint:

- `bin/cmux-evidence` is Python.
- Pi's TUI components are TypeScript/Node components designed for an interactive Pi TUI render loop.
- There is no obvious documented standalone command like `pi --render-markdown` for using Pi's Markdown renderer from a Python CLI.
- `@earendil-works/pi-tui` is installed as a dependency under the global `@earendil-works/pi-coding-agent` package, not as a project dependency in this Evidence app.

Therefore there are two possible UI strategies:

### Strategy A: Python ANSI styling now

Use Python terminal styling directly:

- ANSI color if `sys.stdout.isatty()` and `NO_COLOR` is not set.
- Plain text fallback for non-interactive/test runs.
- Consistent section headings, dim helper text, colored prompts, success/warning/error states.
- Better list/table formatting for model picker and AI suggestions.

Pros:

- Simple.
- No extra runtime dependency.
- Works inside the existing Python CLI.
- Safe and fast to implement.

Cons:

- Not exactly Pi's Markdown renderer.
- Will be visually Pi-inspired rather than Pi-native.

### Strategy B: Node/Pi TUI helper later

Create a small Node helper that imports Pi Coding Agent SDK/TUI components and returns a selected model as JSON to Python.

Potential helper responsibilities:

- initialize Pi settings/model registry;
- use `ModelSelectorComponent` or a close derivative;
- use `ThinkingSelectorComponent` or similar logic;
- render markdown/help text with Pi's Markdown component;
- emit final selected provider/model/thinking as JSON.

Pros:

- Closest to Pi `/model` experience.
- Could reuse Pi's model selector behavior and theme.

Cons:

- More moving parts.
- Need reliable module resolution for globally installed Pi packages.
- Pi TUI components are built for Pi's render loop; using them as an external helper needs careful testing.
- Harder to maintain than a Python ANSI flow.

Recommended approach:

- Implement Strategy A first for readability and flow correctness.
- Keep Strategy B as a future polish item or upstream Pi feature request.

## Desired model-selection UX

The next flow should be closer to this:

```text
AI suggestions

Current Pi model
  opencode/mimo-v2.5-free · thinking=medium

Use this model for onboarding suggestions?
  [Y] yes, use current Pi model
  [n] choose another model
```

If user chooses another model:

```text
Choose AI model
Only showing models from configured/authenticated Pi providers.
Type to filter, press Enter on empty search to show available models.

[1] opencode/mimo-v2.5-free        context=200K   thinking=yes  images=yes  current
[2] fireworks/accounts/...20b      context=131K   thinking=yes  images=no
[3] openai/gpt-4.1                 context=128K   thinking=no   images=yes

Filter or number: 
```

Better still, display a first page immediately before asking for filter input.

Selection options should support:

- number selection;
- filter text;
- Enter to accept current/default when appropriate;
- `q`/Escape-ish cancellation path;
- manual provider/model fallback if listing fails.

Thinking selection should be shown only after selecting the model, and ideally should be aware of whether the model supports reasoning:

- if `thinking=no`, default to `off` or skip thinking picker;
- if `thinking=yes`, offer `off|minimal|low|medium|high|xhigh` with Pi default/current thinking first.

## Data source for default/current model

Preferred default order for onboarding AI:

1. Pi merged settings default provider/model/thinking, matching `/model` state.
2. `.cmux/evidence.json.onboardingAi` as project fallback.
3. Hard fallback: `opencode/mimo-v2.5-free`, `medium`.

Rationale:

- User expectation: onboarding should default to the same model Pi uses.
- Project config remains useful for team defaults when Pi settings are missing.
- Hard fallback prevents failure in fresh environments.

Implementation options to obtain Pi defaults:

### Option 1: Read Pi settings JSON directly

Read:

- `~/.pi/agent/settings.json`
- `.pi/settings.json`

Merge relevant keys with project overriding global:

- `defaultProvider`
- `defaultModel`
- `defaultThinkingLevel`

Pros:

- Easy from Python.
- No Node helper needed.

Cons:

- Duplicates a small piece of Pi SettingsManager behavior.
- Must respect `PI_CODING_AGENT_DIR` if set.

### Option 2: Node helper using Pi SDK

Use `SettingsManager.create(cwd, agentDir)` from `@earendil-works/pi-coding-agent`.

Pros:

- Exact Pi behavior.

Cons:

- Requires dependable package import resolution from this workspace.
- More complex subprocess integration.

Recommended v1:

- Read Pi settings JSON directly, including `PI_CODING_AGENT_DIR` support.
- Continue using `pi --list-models` for authenticated available models.
- Document that this mirrors Pi settings and model registry CLI behavior.

Recommended v2:

- Replace direct settings read with a small Pi SDK helper if module resolution is made robust.

## Proposed next implementation plan

1. Add a small terminal styling layer in Python.
   - `supports_color()`
   - `style(text, color=None, bold=False, dim=False)`
   - helpers: `heading`, `muted`, `success`, `warning`, `error`, `prompt_label`
   - obey `NO_COLOR` and non-TTY output.

2. Rework model defaults.
   - Add `load_pi_default_ai_model(root, config)`.
   - Read Pi global/project settings for `defaultProvider`, `defaultModel`, `defaultThinkingLevel`.
   - Fallback to `.cmux/evidence.json.onboardingAi`.

3. Rework model chooser.
   - Show current/default model immediately.
   - If user says no, immediately show available models from `pi --list-models`.
   - Mark current/default model.
   - Make filter loop clearer.
   - Manual provider/model fallback if listing fails.

4. Improve thinking selector.
   - If selected model row says `thinking=no`, default/force `off` or ask less aggressively.
   - If `thinking=yes`, default to Pi default thinking.

5. Improve suggestion acceptance UI.
   - Color category headings.
   - Use consistent numbered lists.
   - Show accepted/rejected counts.

6. Keep non-interactive behavior plain and stable.
   - No color/control codes when stdin/stdout is not TTY.
   - Non-interactive workspace creation should still not block.

## Future Pi upstream wish list

These would make this integration cleaner:

1. `pi --list-models --json`
   - Return provider/model/context/maxOut/thinking/images/name.

2. `pi --current-model --json` or similar
   - Return merged default/current provider/model/thinking.

3. `pi --select-model --json`
   - Open Pi's native model selector outside a full agent session and emit selected model JSON.

4. `pi --render-markdown` or an exported stable markdown-render helper
   - Let external CLIs render Pi-themed markdown without building a full TUI app.

## Recommended decision

For the next implementation pass, do not attempt a full Pi TUI embedding yet.

Do this first:

- Use Pi defaults from Pi settings as the default onboarding AI model.
- Use `pi --list-models` as the authenticated available-model source.
- Make the chooser immediately display available models and mark the current/default model.
- Add a small ANSI styling layer for readability.

This addresses the user's actual UX pain quickly while staying aligned with Pi's documented model registry behavior.

## Implementation status

Partially implemented, then simplified after user feedback.

Current state in `bin/cmux-evidence`:

- Added a small ANSI styling layer with TTY/`NO_COLOR` fallback.
- Onboarding reads Pi default model settings from:
  - `PI_CODING_AGENT_DIR/settings.json` when `PI_CODING_AGENT_DIR` is set
  - otherwise `~/.pi/agent/settings.json`
  - plus project override `.pi/settings.json`
- The onboarding suggestion model is Pi's default/current provider/model/thinking when available.
- `.cmux/evidence.json.onboardingAi` remains the project fallback.
- The extra model-choice step was removed because it made onboarding feel too complicated.
- Users now only answer whether they want AI enrichment; if yes, the flow uses the Pi/default configured model automatically.
- Headings, helper text, suggestions, summaries, and warnings remain formatted for better readability.

Validated with:

```bash
python3 -m py_compile bin/cmux-evidence
```

Also ran a mocked PTY onboarding test verifying:

- no `Use this model...` prompt appears
- no model picker appears
- `pi --list-models` is not called during normal onboarding enrichment
- suggestions still run with the configured/default provider/model/thinking
- colorized UI remains interactive only
