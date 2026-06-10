# Phase 1 Prompt — Data Registry MVP

Goal: implement the minimal `.cmux/data-registry.json` refresh path for workspace `data/` files.

## Files to inspect first

- `bin/cmux-evidence`
- `tests/test_cmux_evidence_content_workspace.py`
- `06-data-registry-spec.md`
- `03-non-negotiable-invariants.md`

## Files likely to modify/create

- Modify: `bin/cmux-evidence`
- Create: `tests/test_workspace_data_registry.py`
- Create: `tests/fixtures/workspace-data/orders.csv`
- Create: `tests/fixtures/workspace-data/customers.csv`

## Do not touch in this phase

- `pi-pkg/extensions/evidence-context.ts`
- `pi-pkg/skills/*`
- root README
- TLC files
- publish implementation unless needed for tests

## Task

Add helper logic to scan workspace `data/` and write `.cmux/data-registry.json`.

Support only:

- `.csv`
- `.tsv`
- `.parquet`
- `.json`
- `.jsonl`

Implement:

```bash
./bin/cmux-evidence data list
./bin/cmux-evidence data refresh
```

For Phase 1, `data refresh` may update registry only. Shadow source generation can happen in Phase 2.

## Acceptance criteria

- Empty workspace refresh succeeds.
- CSV file registers as `files.orders`.
- Duplicate aliases are deterministic.
- Existing tests still pass.

## Validation commands

```bash
python -m unittest tests/test_cmux_evidence_content_workspace.py
python -m unittest tests/test_workspace_data_registry.py
```

## Report back

```text
Files changed:
New files:
Commands run:
Tests passed/failed:
Known gaps:
```
