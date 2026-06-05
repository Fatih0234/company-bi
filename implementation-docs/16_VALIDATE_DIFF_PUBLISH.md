# Step 16: Validate, Diff, and Publish Workflow

References: `10_CMUX_EVIDENCE_WORKSPACE_OS_SPEC.md` sections **Git remains the collaboration model**, **Story 4**, **Story 5**, and **Success criteria**.

## Goal

Add safe commands for taking an analysis from draft to reviewable Git work.

Commands:

```bash
cmux-evidence validate
cmux-evidence diff
cmux-evidence publish
```

Version 1 should be conservative. It should validate and show the diff before making commits or opening PRs.

## Why this matters

The workspace creation and agent loop are useful, but the workflow becomes real when a dashboard can be reviewed and merged. This step turns an analysis into a normal Git collaboration artifact.

## Add `validate`

Usage:

```bash
cmux-evidence validate
```

Behavior:

1. Read current workspace metadata.
2. Print the active title, branch, page, port, and URL.
3. Run a project validation command.
4. Set CMUX status/progress if running inside CMUX.
5. Exit 0 on success, non-zero on failure.

## Validation command source

Extend `.cmux/evidence.json`:

```json
{
  "validateCommand": "npm run build"
}
```

Fallback order:

1. `validateCommand` from `.cmux/evidence.json`.
2. `npm run build` if package script exists.
3. `npm run sources` or another Evidence-specific command if configured later.
4. Print a clear message if no validation command exists.

Implementation rule: do not invent production validation too early. Start with the existing project scripts.

## Optional path-focused validation

For faster checks later, support:

```bash
cmux-evidence validate --page
```

But do not block version 1 on page-specific validation.

## Add `diff`

Usage:

```bash
cmux-evidence diff
```

Behavior:

1. Print current workspace metadata.
2. Run:

```bash
git status --short
git diff --stat
git diff
```

For long diffs, allow:

```bash
cmux-evidence diff --stat
```

Initial implementation can simply print full diff.

## Add `publish`

Usage:

```bash
cmux-evidence publish
```

Version 1 behavior:

1. Verify current directory is an analysis worktree.
2. Run `validate`.
3. Run `diff --stat`.
4. Ask for confirmation.
5. Commit changes with a generated message.
6. Push branch.
7. Create a GitHub PR if `gh` is installed and authenticated.
8. Otherwise print the push/PR instructions.

## Confirmation requirement

Do not commit or push without confirmation.

Prompt:

```text
Publish this analysis branch?

Title:  Revenue Quality by Segment
Branch: analysis/revenue-quality-by-segment
Page:   pages/analysis/revenue-quality-by-segment.md

Type 'publish' to continue:
```

Only continue if the user types exactly:

```text
publish
```

## Commit message

Default message:

```text
Add analysis: <title>
```

Example:

```text
Add analysis: Revenue Quality by Segment
```

Allow later override:

```bash
cmux-evidence publish --message "Add revenue quality dashboard"
```

Not required for first implementation.

## GitHub PR behavior

If `gh` exists:

```bash
gh pr create \
  --title "Add analysis: Revenue Quality by Segment" \
  --body-file .cmux/pr-body.md
```

Generate `.cmux/pr-body.md` before calling `gh`:

```md
# Evidence analysis

## Summary

Adds the Revenue Quality by Segment analysis dashboard.

## Workspace metadata

- Branch: analysis/revenue-quality-by-segment
- Page: pages/analysis/revenue-quality-by-segment.md
- Local preview: http://localhost:3104/analysis/revenue-quality-by-segment

## Validation

- [ ] `cmux-evidence validate` passed locally
- [ ] Dashboard preview reviewed
- [ ] Diff reviewed

## Notes

Generated from a CMUX Evidence analysis workspace.
```

If `gh` does not exist, print:

```bash
git push -u origin analysis/revenue-quality-by-segment
# then open a PR from the branch
```

## CMUX integration

During validation/publish:

```bash
cmux set-progress 0.2 --label "Validating" --workspace "$CMUX_WORKSPACE_ID"
cmux set-progress 0.6 --label "Committing" --workspace "$CMUX_WORKSPACE_ID"
cmux set-progress 0.9 --label "Opening PR" --workspace "$CMUX_WORKSPACE_ID"
cmux notify --title "Evidence Publish" --body "PR is ready" --workspace "$CMUX_WORKSPACE_ID"
```

Only run CMUX commands when `CMUX_WORKSPACE_ID` is present. Failures in status updates should not fail publishing.

## Registry update

On successful publish preparation:

- Set workspace status to `published` or `pr-opened` if PR creation succeeded.
- Update `updatedAt`.
- Write `.cmux/workspace.json`.
- Update global registry.

If only commit succeeds but push/PR fails, use status `committed`.

## Acceptance criteria

- `cmux-evidence validate` runs a real project validation command or clearly says none is configured.
- `cmux-evidence diff` shows Git status and diff.
- `cmux-evidence publish` refuses to run outside an analysis worktree.
- `publish` runs validation before committing.
- `publish` requires exact user confirmation.
- `publish` creates a commit only when there are changes.
- `publish` pushes the analysis branch or prints exact manual instructions.
- Registry/workspace status updates after publish steps.

## Test plan

Inside an analysis worktree:

```bash
./bin/cmux-evidence current
./bin/cmux-evidence validate
./bin/cmux-evidence diff --stat
```

Create a harmless change:

```bash
echo "\n<!-- publish smoke test -->" >> pages/analysis/<slug>.md
./bin/cmux-evidence diff --stat
./bin/cmux-evidence publish
```

For first test, use a throwaway branch and stop before typing `publish` unless ready.

## Failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| Validate command missing | No `validateCommand`, no build script | Add `validateCommand` to `.cmux/evidence.json` |
| Publish outside analysis | No `.cmux/workspace.json` | Run inside a generated analysis worktree |
| No changes to commit | Dashboard not modified | Print clean message and exit |
| Push fails | No remote/auth | Print manual push instructions |
| PR create fails | `gh` missing/auth failed | Print GitHub URL/manual instructions |

## Keep version 1 safe

Do not auto-merge.
Do not deploy.
Do not bypass validation.
Do not edit protected branches.
Do not commit secrets.
