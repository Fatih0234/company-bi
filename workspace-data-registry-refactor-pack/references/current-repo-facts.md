# Current Repo Facts

These facts were gathered from the live `Fatih0234/company-bi` repository before creating this handoff pack.

## Repo identity

- Repo: `Fatih0234/company-bi`
- Default branch: `main`
- Type: Evidence BI app + CMUX workspace tooling + Pi package/agent workspace.

## Important current files

- `README.md` — describes Company BI / LUMEN.
- `package.json` — Evidence app scripts and dependencies.
- `.cmux/evidence.json` — CMUX/Evidence project config and path policies.
- `bin/cmux-evidence` — main Python CLI.
- `scripts/run_evidence_dev.sh` — dev server wrapper.
- `scripts/ensure_evidence_sources.sh` — current TLC/MinIO-aware source bootstrap.
- `sources/tlc/trips.sql` — current TLC trips source.
- `sources/tlc/zones.sql` — current zones source.
- `pi-pkg/package.json` — Pi package manifest.
- `pi-pkg/extensions/duckdb-bi/` — safe DuckDB BI tools.
- `pi-pkg/extensions/evidence-context.ts` — dynamic context injection.
- `pi-pkg/skills/evidence-dashboard/SKILL.md` — dashboard workflow.
- `tests/test_cmux_evidence_content_workspace.py` — content workspace regression tests.

## Current key commands

```bash
npm install
npm run dev
npm run sources
npm run build
npm run preview
./bin/cmux-evidence new "Analysis Title"
./bin/cmux-evidence open <slug>
./bin/cmux-evidence validate
./bin/cmux-evidence diff
./bin/cmux-evidence publish
```

## Existing safety boundary

Normal dashboard agents can edit content paths such as `pages/**`, `queries/**`, `reports/**`, and `data/**`. Implementation refactor agents may need to edit runtime/tooling files, but only for this explicit refactor.
