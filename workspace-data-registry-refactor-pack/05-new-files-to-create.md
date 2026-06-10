# 05 — New Files to Create

This file lists proposed new repository files for the refactor. Not every file must be created in the first patch, but the coding agent should understand the intended structure.

## MVP new files

### `scripts/ensure_workspace_sources.sh`

Purpose: generic source bootstrap script for workspace-local data.

Responsibilities:

- locate content workspace and shadow runtime,
- ensure `data/` exists,
- ensure/generate registry if data files exist,
- generate shadow runtime `sources/files/*`,
- run Evidence sources for `files` only when there are registered tables,
- exit successfully for empty workspaces.

Must not:

- require MinIO,
- require TLC data,
- read secrets,
- publish data.

### `tests/test_workspace_data_registry.py`

Purpose: regression tests for workspace data registry behavior.

Test cases:

- empty data refresh succeeds,
- CSV registration creates stable alias,
- duplicate aliases are stable and deterministic,
- shadow runtime source files are generated,
- content workspace does not receive generated `sources/files`,
- publish excludes raw data.

### `tests/fixtures/workspace-data/orders.csv`

Tiny CSV fixture for tests and docs.

### `tests/fixtures/workspace-data/customers.csv`

Tiny CSV fixture for tests and docs.

## Strongly recommended new files

### `scripts/workspace_data_registry.py`

Purpose: reusable Python logic for scanning files, refreshing registry, and generating source SQL.

Create this if `bin/cmux-evidence` would become too large.

Suggested public functions:

```python
scan_workspace_data_files(workspace_root: Path) -> list[DataFile]
refresh_registry(workspace_root: Path) -> dict[str, Any]
generate_shadow_sources(workspace_root: Path, shadow_root: Path, registry: dict[str, Any]) -> None
print_registry_summary(registry: dict[str, Any]) -> None
```

### `pi-pkg/extensions/duckdb-bi/src/lib/workspace-data-registry.ts`

Purpose: TypeScript reader/normalizer for `.cmux/data-registry.json`.

Suggested exports:

```ts
loadWorkspaceDataRegistry(config)
registeredTablesForContext(config)
registryWarnings(config)
```

### `pi-pkg/extensions/duckdb-bi/src/tools/refresh-workspace-data.ts`

Purpose: optional Pi tool to trigger the same safe refresh flow as the CLI.

MVP may skip this if CLI refresh is enough.

If created, register it in `src/register-tools.ts` and `src/constants.ts`.

## Possible later files

### `examples/tlc/README.md`

Purpose: preserve old TLC/MinIO demo as optional advanced example.

### `examples/tlc/sources/tlc/*`

Purpose: move TLC source SQL out of the default root flow.

### `examples/tlc/scripts/*`

Purpose: preserve MinIO/TLC sync scripts as optional example utilities.

### `docs/workspace-data.md`

Purpose: user-facing docs after implementation.

Only create if README becomes too long.

## Files not recommended for MVP

Do not create these yet:

- Excel-specific importer,
- database credential UI,
- publish-with-data implementation,
- cloud storage connectors,
- automatic schema editing UI,
- upload server.

Keep the MVP small and local-first.
