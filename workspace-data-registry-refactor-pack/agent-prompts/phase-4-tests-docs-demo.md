# Phase 4 Prompt — Tests, Docs, Demo, and TLC Demotion

Goal: complete the refactor by updating docs/skills and moving TLC/MinIO out of the default story.

## Files to inspect first

- root `README.md`
- `pi-pkg/skills/evidence-dashboard/SKILL.md`
- `pi-pkg/skills/data-discovery/SKILL.md`
- `pi-pkg/extensions/duckdb-bi/README.md`
- `12-migration-plan.md`
- `14-demo-script.md`

## Files likely to modify

- root `README.md`
- `pi-pkg/skills/evidence-dashboard/SKILL.md`
- `pi-pkg/skills/data-discovery/SKILL.md`
- `pi-pkg/extensions/duckdb-bi/README.md`
- maybe move `sources/tlc/*` to `examples/tlc/`
- maybe move TLC scripts to `examples/tlc/scripts/`

## Task

Update default project story to bring-your-own-files.

Demote TLC/MinIO to optional example only after generic flow passes tests.

Search for:

```text
tlc
MinIO
taxi
sync_tlc
sources/tlc
```

Update only default-flow references. Keep optional example references clearly labeled.

## Acceptance criteria

- README no longer requires MinIO for default workflow.
- Skills instruct agents to use registered workspace tables.
- Data discovery starts from registered tables.
- TLC is optional/example-only.
- All tests pass.
