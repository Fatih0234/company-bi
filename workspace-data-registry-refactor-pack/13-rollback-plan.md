# 13 — Rollback Plan

## Purpose

If the refactor causes severe breakage, use this plan to restore working behavior.

## When to rollback

Rollback if:

- new workspaces cannot be created,
- dev server cannot start for empty workspaces,
- validate is broken for normal workspaces,
- publish privacy is broken,
- raw `data/**` is accidentally published,
- Pi package loading breaks,
- generated files appear in the user-facing workspace incorrectly.

## Rollback steps

1. Revert changes to `bin/cmux-evidence`.
2. Revert changes to `scripts/run_evidence_dev.sh`.
3. Restore old `scripts/ensure_evidence_sources.sh` behavior.
4. Restore root `sources/tlc/*` if moved.
5. Revert `pi-pkg/extensions/evidence-context.ts` changes.
6. Revert `duckdb-bi` changes if they break tools.
7. Revert skill/prompt docs only if they no longer match the code.
8. Run existing tests.

## Partial rollback option

If registry code works but Pi context breaks, keep registry/source generation and only rollback:

- `pi-pkg/extensions/evidence-context.ts`,
- skill/prompt changes.

If Pi works but Evidence source generation breaks, rollback:

- generated source integration,
- `run_evidence_dev.sh`,
- registry-to-source generation.

## Post-rollback report

Report:

```text
Rollback reason:
Files reverted:
Tests run:
Current behavior restored:
Known remaining issues:
```
