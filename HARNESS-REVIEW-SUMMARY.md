# Harness Review Summary: company-bi

**Date:** 2024-06-10
**Workspace:** try11 (SwiftRide NYC Market Entry Analysis)
**Full Report:** `pi-pkg/extensions/evidence-quality-guard/HARNESS-REVIEW-2024-06-10.md`

---

## Executive Summary

The `company-bi` harness performed **mostly well** in workspace try11. The evidence-bi-thinking skill produced a solid Insight Candidate Scan and Report Design Plan. The quality guard caught critical rendering errors and blocked broken page writes. The analysis-intention extension successfully imported a comprehensive brief from a previous workspace.

However, the **CMUX browser preview workflow is broken** (P0), which prevents visual validation of Evidence dashboards. The static analysis gaps (markdown lists in components, angle brackets in text) caused avoidable page load failures.

---

## Top 3 Problems

| # | Problem | Severity | Priority | Target File |
|---|---------|----------|----------|-------------|
| 1 | **CMUX browser preview broken** — browser opens Kagi instead of local Evidence server | High | P0 | `bin/cmux-evidence` + CMUX browser extension |
| 2 | **Static analysis misses markdown lists inside `<Callout>`** — caused "Component was left open" error | High | P1 | `pi-pkg/extensions/evidence-quality-guard/static-analysis.ts` |
| 3 | **Angle-bracket `<50%` not caught by static analysis** — caused Svelte parsing error | Medium | P1 | `pi-pkg/extensions/evidence-quality-guard/static-analysis.ts` |

---

## What the Harness Did Well

- ✅ **Insight Candidate Scan** — evidence-bi-thinking skill produced 8 candidates (6 kept, 2 explored, 3 dropped)
- ✅ **Report Design Plan** — well-structured plan with archetype, story arc, and proposed sections
- ✅ **Quality guard caught errors** — blocked page write when unclosed `<Callout>` detected
- ✅ **Data profiling before analysis** — ran `duckdb_summarize_table` on all tables
- ✅ **SQL validation before page writes** — ran all queries via `duckdb_run_sql` first
- ✅ **Clear workspace structure** — content-only model with index, draft, report, and question pages

---

## Prioritized Implementation Backlog

| Priority | Change | Target File | Expected Impact |
|---|---|---|---|
| P0 | Fix CMUX browser preview to connect to local servers | `bin/cmux-evidence` + CMUX browser extension | Enables visual validation of Evidence dashboards |
| P1 | Improve static analysis for markdown lists inside components | `pi-pkg/extensions/evidence-quality-guard/static-analysis.ts` | Prevents "Component was left open" errors |
| P1 | Add angle-bracket-in-text detection for component content | `pi-pkg/extensions/evidence-quality-guard/static-analysis.ts` | Prevents `<50%` parsing errors |
| P1 | Improve health check to detect Svelte runtime errors | `pi-pkg/extensions/evidence-health-check.ts` | Gives accurate page health feedback |
| P2 | Make documentation lookup enforcement more granular | `pi-pkg/extensions/evidence-quality-guard/index.ts` | Ensures agents look up specific component docs |
| P2 | Add pre-write validation提示 to evidence-dashboard skill | `pi-pkg/skills/evidence-dashboard/SKILL.md` | Encourages proactive validation |
| P2 | Add CMUX browser preview troubleshooting guide | `pi-pkg/skills/cmux-browser/SKILL.md` | Helps agents diagnose preview failures |

---

## Quick Reference: Problem Details

### Problem 1: CMUX Browser Preview Broken (P0)

**Symptom:** Browser opens Kagi login instead of local Evidence server
**Root Cause:** CMUX browser automation doesn't handle localhost URLs properly
**Fix:** Investigate browser proxy/extensions, add `--no-proxy` flag, add troubleshooting guide

### Problem 2: Markdown Lists Inside Components (P1)

**Symptom:** `Component was left open` error when `<Callout>` contains markdown list
**Root Cause:** Static analysis doesn't detect markdown lists inside non-layout components
**Fix:** Add detection rule for `- item` or `1. item` inside `<Callout>`, `<Alert>`, `<Info>`

### Problem 3: Angle-Bracket `<50%` (P1)

**Symptom:** `Expected valid tag name` error when `<50%` in markdown text
**Root Cause:** Static analysis misses angle brackets inside component text content
**Fix:** Extend angle-bracket detection to check text inside component tags

### Problem 4: Health Check False Positives (P1)

**Symptom:** `check_evidence_health` returns "All Clear" but browser shows errors
**Root Cause:** Health check only verifies HTTP status, not Svelte runtime errors
**Fix:** Check for Svelte error patterns (`Component was left open`, `Expected valid tag name`)

---

## Test Cases to Add

```typescript
// 1. Markdown list inside Callout
test("detects markdown list inside Callout component", () => {
  const content = `
<Callout type="warning">
**Warning:**

- Item 1
- Item 2
</Callout>
`;
  const issues = analyzeEvidenceMarkdown(content);
  assert.ok(issues.length > 0, "should detect markdown list inside Callout");
});

// 2. Angle bracket <50% in component text
test("detects <50% inside component text content", () => {
  const content = `
<Callout type="info">
Green zones have <50% yellow share.
</Callout>
`;
  const issues = analyzeEvidenceMarkdown(content);
  assert.ok(issues.length > 0, "should detect <50%");
});

// 3. Health check detects Svelte error patterns
test("health check detects Component was left open pattern", () => {
  const html = `
<div>
  <li>Item 1</li>
  <li>Item 2</li>
</Callout></li>
</div>
`;
  const errors = detectErrorsInHtml(html);
  assert.ok(errors.length > 0, "should detect Component was left open");
});
```

---

## Next Steps

1. **Immediate (P0):** Fix CMUX browser preview workflow
2. **This week (P1):** Add static analysis for markdown lists and angle brackets
3. **Next sprint (P2):** Improve documentation lookup enforcement and add troubleshooting guide

---

## Files Changed in This Review

- `pi-pkg/extensions/evidence-quality-guard/HARNESS-REVIEW-2024-06-10.md` — Full review report
- `HARNESS-REVIEW-SUMMARY.md` — This summary file
