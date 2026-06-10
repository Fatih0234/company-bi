# 15 — Acceptance Criteria

The refactor is complete only when all required criteria pass.

## Product behavior

- [ ] A new workspace starts without preconfigured business data.
- [ ] User can put supported files under workspace `data/`.
- [ ] `cmux-evidence data refresh` registers those files.
- [ ] Registered files become stable source tables like `files.orders`.
- [ ] Pi sees registered tables in dynamic context.
- [ ] Evidence page SQL uses `files.<alias>` table names.
- [ ] Dashboard pages do not use raw file paths.
- [ ] Empty workspaces still open and validate gracefully.

## Technical behavior

- [ ] `.cmux/data-registry.json` is created/updated deterministically.
- [ ] Shadow runtime generates `sources/files/connection.yaml`.
- [ ] Shadow runtime generates `sources/files/<alias>.sql`.
- [ ] Generated source SQL references `workspace-data/...`.
- [ ] Generated source files are not written to content workspace.
- [ ] Duplicate aliases are handled deterministically.
- [ ] Missing files are handled gracefully.

## Pi behavior

- [ ] `duckdb_data_sources` shows registered tables.
- [ ] Registered tables are marked recommended for dashboard use.
- [ ] Raw discovered files are treated as candidates, not final dashboard tables.
- [ ] Evidence dashboard skill tells agents to use registered table names.
- [ ] Data discovery skill starts from registered tables.

## Privacy/publish behavior

- [ ] Default publish excludes raw `data/**`.
- [ ] Default publish excludes `.pi/duckdb/**`.
- [ ] Default publish excludes raw uploads and profiles unless explicitly designed otherwise.

## Test behavior

- [ ] Existing content workspace tests pass.
- [ ] New workspace data registry tests pass.
- [ ] No tests require MinIO.
- [ ] No tests require network.
- [ ] No tests require large data.

## Documentation behavior

- [ ] README explains bring-your-own-files as default.
- [ ] TLC/MinIO is optional/example-only or removed from default docs.
- [ ] Skills/prompts no longer default to TLC.
- [ ] New CLI commands are documented.

## Final recommendation gate

If any item above fails, the refactor is not done.
