# 16 — Risk Register

## Risk 1: Breaking content-only workspaces

Impact: high.

Mitigation:

- preserve split root model,
- run existing tests,
- generate sources only in shadow runtime.

## Risk 2: Publishing raw data accidentally

Impact: high.

Mitigation:

- keep publish allowlist restricted,
- add explicit tests with `data/private.csv`,
- do not add `data/**` to default publish.

## Risk 3: Raw file paths leak into dashboard pages

Impact: medium-high.

Mitigation:

- update skills,
- inject context rules,
- generate stable `files.<alias>` tables,
- add review checks.

## Risk 4: Alias instability

Impact: high.

Mitigation:

- preserve aliases by path,
- deterministic collision handling,
- tests for repeated refresh.

## Risk 5: Large files slow refresh/build

Impact: medium.

Mitigation:

- do shallow metadata by default,
- profile only on request,
- document memory flags for Evidence sources,
- keep fixtures small.

## Risk 6: Excel scope creep

Impact: medium.

Mitigation:

- explicitly exclude Excel from MVP,
- later convert sheets to CSV/Parquet extracts.

## Risk 7: Weak agent edits blocked/runtime files incorrectly

Impact: high.

Mitigation:

- follow this pack,
- phase prompts specify allowed files,
- invariants repeat boundaries,
- report files changed after each phase.

## Risk 8: MinIO/TLC references remain in default workflow

Impact: medium.

Mitigation:

- search for `tlc`, `MinIO`, `taxi`, `sync_tlc`,
- move old flow to examples,
- update README/prompts/skills.

## Risk 9: Evidence source generation assumptions are wrong

Impact: medium.

Mitigation:

- validate against current Evidence docs,
- keep generated files conventional under `sources/files`,
- run `npm run sources -- --sources files`,
- run `npm run build`.

## Risk 10: Registry/profile exposes sensitive samples

Impact: medium-high.

Mitigation:

- do not store large row samples by default,
- avoid storing raw values unless needed,
- profile columns/types/counts first,
- keep `.cmux/data-profile.json` private by default.
