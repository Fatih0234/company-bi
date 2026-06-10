# Phase 2 Prompt — Shadow Runtime Evidence Sources

Goal: generate Evidence source files from the workspace data registry inside the shadow runtime.

## Files to inspect first

- `bin/cmux-evidence`
- `scripts/run_evidence_dev.sh`
- `07-shadow-runtime-source-generation-spec.md`
- `tests/test_workspace_data_registry.py`

## Files likely to modify/create

- Modify: `bin/cmux-evidence`
- Maybe create: `scripts/ensure_workspace_sources.sh`
- Modify: `scripts/run_evidence_dev.sh`
- Modify/add tests in `tests/test_workspace_data_registry.py`

## Do not touch in this phase

- Pi skills/prompts
- README public narrative
- TLC files

## Task

Generate these files in the shadow runtime:

```text
sources/files/connection.yaml
sources/files/<alias>.sql
```

Do not generate them in the content workspace.

Generated SQL should read from `workspace-data/...`.

## Acceptance criteria

- registered CSV produces `shadow/sources/files/orders.sql`,
- generated SQL references `workspace-data/orders.csv`,
- content workspace has no `sources/files/orders.sql`,
- empty workspace still works,
- `validate` repairs/regenerates shadow runtime.

## Validation commands

```bash
python -m unittest tests/test_cmux_evidence_content_workspace.py
python -m unittest tests/test_workspace_data_registry.py
```

Run Evidence build manually if local dependencies are installed:

```bash
npm run build
```
