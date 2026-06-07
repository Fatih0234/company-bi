# Onboarding Test Notes

## Test plan

1. Interactive onboarding with title argument, no AI enrichment, final confirmation yes.
2. Interactive onboarding with omitted title, mocked successful AI enrichment, mixed accept/reject suggestions, one answered and one skipped clarification.
3. Interactive onboarding cancellation at final confirmation; verify no worktree/branch is created.
4. Non-interactive invocation with a title; verify it does not block.
5. Interactive onboarding with mocked AI failure; verify it falls back to manual brief and still creates the workspace.
6. Real Pi/model smoke test.
7. Model picker / thinking picker / `--no-open` regression test.
8. Real onboarding enrichment with opencode free model and Fireworks model.
9. Evidence capability-aware dashboard option suggestions.
10. Pi-default model and styled onboarding regression.

## Pi model-listing API found

The exact Pi API/function relevant to this is the model registry availability API:

```ts
ctx.modelRegistry.getAvailable()
```

It returns only models that have configured auth. In extension/SDK contexts this is the direct function to use. For this Python terminal onboarding flow, the equivalent CLI surface is:

```bash
pi --list-models
```

`pi --list-models` is backed by the same model registry and lists provider, model, context, max output, thinking support, and image support.

Related Pi APIs/docs used:

```ts
ctx.modelRegistry.find(provider, modelId)
pi.setModel(model)
pi.getThinkingLevel()
pi.setThinkingLevel(level)
```

CLI model options used by onboarding:

```bash
--provider <name>
--model <id>
--thinking off|minimal|low|medium|high|xhigh
--list-models [search]
```

## Results

### 1. Title argument + no AI

Passed.

Verified:

- worktree was created
- branch was created
- `.cmux/workspace.json` contained the expected `intention`
- `.cmux/pi-context.md` included the rendered `Analysis intention` section

### 2. Omitted title + mocked AI success

Passed.

Verified generated intention included:

- accepted AI question only
- rejected AI question omitted
- accepted AI success criterion only
- accepted AI assumption only
- answered clarification in `clarifications`
- skipped clarification in `openQuestions`
- `.cmux/pi-context.md` rendered assumptions, clarifications, and open questions

### 3. Final cancellation

Passed.

Verified:

- no worktree directory was created
- no branch was created
- direct PTY exit-code check returned exit code `2`

### 4. Non-interactive title argument

Passed after fix.

Verified:

- command did not block
- workspace was created
- empty `intention` object was stored
- `.cmux/pi-context.md` no longer renders a misleading `Analysis intention` block for a fully empty intention

### 5. Mocked AI failure fallback

Passed.

Verified:

- failure message was printed
- manual brief was preserved
- workspace was created after final confirmation
- generated `workspace.json` and `pi-context.md` were correct

### 6. Real Pi/model smoke test

Passed.

Command shape:

```bash
pi -p --no-session --provider opencode --model mimo-v2.5-free --no-tools 'Return only this exact JSON: {"ok":true}'
```

Verified:

- provider/model returned successfully
- stdout contained parseable JSON
- Pi emitted an OSC notification to stderr, but onboarding reads stdout only, so parsing is unaffected

Also directly invoked `ai_intention_suggestions(...)` with the real data catalog. It returned parseable JSON with:

- `suggestedQuestions`
- `suggestedSuccessCriteria`
- `suggestedAssumptions`
- `clarifyingQuestions`

### 7. Model picker / thinking picker / no-open regression

Passed.

Used a fake `pi` binary that supported both:

```bash
pi --list-models
pi -p --no-session --provider ... --model ... --thinking ... --no-tools ...
```

Verified:

- user can reject the default configured model
- user can filter the available model list
- user can choose a provider/model pair from the numbered list
- user can choose a thinking level
- selected model config is passed to the AI call
- selected model config is stored in `intention.aiEnrichment`
- numbered suggestion acceptance works
- `--no-open` skips CMUX opening

### 8. Real opencode + Fireworks onboarding enrichment

Passed.

Ran real provider-backed onboarding with `--no-open` and cleaned up both workspaces afterward.

Opencode free test:

```bash
provider=opencode
model=mimo-v2.5-free
thinking=medium
```

Verified:

- real suggestions parsed correctly
- suggested questions/success criteria/assumptions displayed in numbered acceptance UI
- skipped clarifying questions were stored in `openQuestions`
- `intention.aiEnrichment` stored provider/model/thinking

Fireworks picker test:

```bash
provider=fireworks
model=accounts/fireworks/models/gpt-oss-20b
thinking=low
```

Verified:

- `pi --list-models` filtering found the Fireworks model
- numbered model picker selected the Fireworks provider/model pair
- thinking picker selected `low`
- real Fireworks suggestions parsed correctly
- skipped clarifying questions were stored in `openQuestions`
- `intention.aiEnrichment` stored provider/model/thinking

Also separately smoke-tested exact JSON responses:

```bash
pi -p --no-session --provider opencode --model mimo-v2.5-free --thinking low --no-tools 'Return only this exact JSON: {"provider":"opencode","ok":true}'
pi -p --no-session --provider fireworks --model accounts/fireworks/models/gpt-oss-20b --thinking low --no-tools 'Return only this exact JSON: {"provider":"fireworks","ok":true}'
```

Both succeeded.

### 9. Evidence capability-aware dashboard option suggestions

Passed.

Improved the enrichment prompt so it now includes an Evidence capability/limitation brief covering:

- Markdown pages under `pages/**`
- fenced SQL queries
- BigValue KPI cards
- LineChart / BarChart
- DataTable
- Grid layouts
- simple input-driven interactivity such as Dropdown filters
- Evidence's strength as reproducible BI reports and lightweight interactive dashboards
- limitations to avoid, such as generic drag-and-drop BI builders, writeback, collaborative commenting, or heavy custom frontend behavior

The AI JSON schema now includes:

```json
{
  "suggestedDashboardOptions": []
}
```

Verified with a real opencode call that the model now suggests Evidence-grounded options such as:

- KPI summary with BigValue cards
- Dropdown-filtered service type comparisons
- LineChart daily revenue trends
- DataTable pickup-zone rankings
- BarChart hourly trip distributions

Also ran a mocked full onboarding test and verified:

- `suggestedDashboardOptions` are displayed in the terminal
- accepted options are stored as `intention.dashboardOptions`
- `.cmux/pi-context.md` renders them under `Evidence dashboard direction`

### 10. Pi-default model and styled onboarding regression

Passed.

Verified:

- `python3 -m py_compile bin/cmux-evidence` passes
- non-interactive `new --no-open ... </dev/null` still does not block
- onboarding reads Pi's default model settings before falling back to `.cmux/evidence.json`
- the extra model-choice step is no longer shown
- `pi --list-models` is not called during normal AI enrichment onboarding
- suggestions still run with the configured/default provider/model/thinking
- ANSI styling is used only for TTY output and remains disabled for plain non-TTY output

## Cleanup

All temporary QA worktrees, branches, fake Pi binaries, and registry entries were removed after inspection.

Confirmed:

```bash
./bin/cmux-evidence list
# No analysis workspaces found for company-bi.
```

## Issues / improvements for next session

No blocking issues currently known after the latest fixes.

Possible polish items later:

1. The numbered multi-select prompt is simpler than a true checkbox/space UI. It works, but a richer TUI could be nicer.
2. The model picker currently parses `pi --list-models` table output. A future Pi JSON output for model listing would be more robust if available.
3. Non-interactive onboarding still has no CLI flags for setting intention fields (`--goal`, `--question`, etc.). This is optional future scripting polish.
