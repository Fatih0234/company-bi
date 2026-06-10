# 00 — Executive Summary

## Decision

Refactor `company-bi` from a preconfigured MinIO/TLC data demo into a workspace-local data registry system.

The target user story:

> I create an analysis workspace, add one or more local data files, refresh/register them, and ask the Pi agent to analyze them with Evidence.

## Why this is the right product direction

The current MinIO/TLC path is useful as a technical prototype but weak as a product demo. It makes the user think the project is about a fake taxi data lake, not about the real value: an agent-assisted workflow for turning arbitrary business files into Evidence reports.

The new model is easier to explain:

1. Create workspace.
2. Attach data files.
3. Agent profiles data.
4. Agent builds Evidence dashboard.
5. User previews and publishes.

That story is concrete, demo-friendly, and closer to how most people start analytics work: with CSV exports, spreadsheets, JSON dumps, and Parquet files.

## MVP scope

Support workspace-local files in `data/`:

- CSV
- TSV
- Parquet
- JSON
- JSONL

Do not implement full Excel support in the first pass. If Excel is needed later, convert sheets to CSV or Parquet in a managed workspace path, then register the converted tables.

## Architecture summary

```text
Content workspace owns user data:
  data/orders.csv
  .cmux/data-registry.json
  .cmux/data-profile.json

Shadow runtime owns generated Evidence source files:
  sources/files/connection.yaml
  sources/files/orders.sql

Pi owns the intelligent workflow:
  discover files
  infer schema
  register tables
  profile data
  inject context
  write dashboard

Evidence owns rendering:
  page SQL reads files.orders
  charts render from named queries
```

## Most important invariant

Evidence page SQL should use stable registered source names such as `files.orders`. It should not use raw file paths or `read_csv_auto(...)` directly in dashboard pages.

## Rollout strategy

Do the refactor in phases. Do not delete TLC first. Add the generic workspace-file path, prove it with tests, then move TLC/MinIO into optional examples.
