# 12 — Migration Plan

## Objective

Move TLC/MinIO out of the default workflow without losing useful demo material.

## Phase A — Add generic path first

Before touching TLC files:

1. Implement workspace registry.
2. Generate `sources/files/*` in shadow runtime.
3. Prove Evidence can query `files.orders`.
4. Prove empty workspaces still work.

## Phase B — Update default docs

Update root README to make bring-your-own-files the primary story.

Replace default data story:

```text
TLC taxi data synced from MinIO
```

with:

```text
Workspace-local CSV/Parquet/JSON files registered as Evidence tables
```

## Phase C — Demote TLC

Move or label old TLC assets.

Preferred:

```text
examples/tlc/
  README.md
  sources/tlc/connection.yaml
  sources/tlc/trips.sql
  sources/tlc/zones.sql
  scripts/download_tlc_seed_data.py
  scripts/upload_tlc_seed_to_minio.sh
  scripts/sync_tlc_lake_from_minio.sh
```

Alternative:

Keep root TLC files temporarily but remove them from default startup/dev flow and document them as legacy.

## Phase D — Clean prompts/skills

Search repo for these terms:

```text
tlc
MinIO
taxi
sources/tlc
sync_tlc
```

Make sure none remain in default instructions unless clearly marked as optional example.

## Phase E — Update demo script

New demo should use simple sales/customer files instead of TLC.

## Migration acceptance criteria

- New users do not need MinIO.
- New workspaces do not depend on TLC data.
- Old TLC example can still be understood if preserved.
- Tests do not require network or MinIO.
