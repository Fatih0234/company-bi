# Reviewer Prompt — Workspace Data Registry Refactor

Review the implementation of the workspace data registry refactor.

## Inspect first

- `03-non-negotiable-invariants.md`
- `04-file-by-file-refactor-plan.md`
- changed files in the repo
- tests added/modified

## Review questions

1. Does a new workspace still work without data?
2. Does `data refresh` work without MinIO/TLC?
3. Are registered tables stable as `files.<alias>`?
4. Are generated source files in the shadow runtime only?
5. Do Evidence pages avoid raw file paths?
6. Is raw `data/**` excluded from publish by default?
7. Are aliases stable across refreshes?
8. Are missing/deleted files handled gracefully?
9. Did Pi context and skills update correctly?
10. Did the implementation preserve existing tests?

## Output format

```text
Summary:
Blocking issues:
Non-blocking suggestions:
Tests/validation checked:
Risks remaining:
Final recommendation: Looks good / Looks good after validation / Needs changes
```
