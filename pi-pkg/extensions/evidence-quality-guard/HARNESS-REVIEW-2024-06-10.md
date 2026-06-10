# Harness Review: company-bi Workspace try11

**Date:** 2024-06-10
**Workspace:** try11 (SwiftRide NYC Market Entry Analysis)
**Reviewer:** Post-workspace harness review prompt

---

## Executive Summary

The `company-bi` harness performed **mostly well** in workspace try11. The evidence-bi-thinking skill produced a solid Insight Candidate Scan and Report Design Plan. The quality guard caught critical rendering errors and blocked broken page writes. The analysis-intention extension successfully imported a comprehensive brief from a previous workspace.

However, the **CMUX browser preview workflow is broken** (P0), which prevents visual validation of Evidence dashboards. The static analysis gaps (markdown lists in components, angle brackets in text) caused avoidable page load failures.

---

## Problems Observed

### Problem 1: CMUX Browser Preview Broken (P0)

**Symptom:** Multiple attempts to take screenshots via `cmux open-browser`, `cmux navigate`, and `preview-screenshot` all failed. Browser surfaces showed Kagi login pages or "New tab" instead of the Evidence dashboard.

**Evidence:**
```
$ cmux open-browser --workspace "41173EF1-CAF6-481D-93C3-F100E336AF53" --url "http://localhost:3141/q1"
OK surface=surface:150 pane=pane:118 placement=reuse

$ /Volumes/T7/projects/company-bi/bin/cmux-evidence browser-surfaces
[
  {"ref": "surface:143", "title": "Sign In - Kagi Search", "url": "https://kagi.com/signin?s=search"},
  {"ref": "surface:146", "title": "Sign In - Kagi Search", "url": "https://kagi.com/signin?s=search"},
  {"ref": "surface:150", "title": "New tab", "url": ""}
]
```

**Root Cause:** The CMUX browser automation doesn't properly handle local server URLs. The browser may have a default homepage, proxy, or extension that intercepts localhost requests.

**Impact:** Visual validation is essential for Evidence dashboards. Without screenshots, the agent can't confirm the dashboard renders correctly, charts display properly, and layout is appropriate.

**Recommended Fix:**
1. Investigate why `cmux open-browser --url "http://localhost:3141/q1"` doesn't load the local page
2. Check if the browser has a proxy, extension, or default page that intercepts localhost requests
3. Consider adding a `--no-proxy` flag or using a dedicated browser profile for local development
4. Add a troubleshooting section to `pi-pkg/skills/cmux-browser/SKILL.md` that covers common preview failures

**Target Files:**
- `bin/cmux-evidence` (preview commands)
- CMUX browser extension (not in this repo)
- `pi-pkg/skills/cmux-browser/SKILL.md`

---

### Problem 2: Static Analysis Misses Markdown Lists Inside Components (P1)

**Symptom:** Error overlay showing `Component was left open. Ensure all components are closed, either with a self-closing tag ending in '/>' or with a closing tag like '</DataTable>'`.

**Evidence:**
```
1213 |  <li class="markdown"><strong class="markdown">Zone name duplicates:</strong> "Corona" and "Governor's Island" appear twice in zone lookup — use LocationID for precision.</Callout></li>
                                                                                                                                                                                            ^
```

**Root Cause:** The agent wrapped a markdown bullet list inside a `<Callout>` component:
```markdown
<Callout type="warning">
**What could make us wrong:**

- **Seasonality:** Jan–Mar data may not reflect spring/summer patterns.
- **Green taxi sample size:** Green trips are ~50x smaller than yellow.
</Callout>
```

Svelte couldn't parse this correctly because the markdown list generates nested HTML (`<ul><li>...</li></ul>`) inside the component, and the `</Callout>` tag was being interpreted as closing a list item.

**Impact:** This caused a page load failure that blocked the agent from viewing the dashboard.

**Recommended Fix:**
Add a detection rule in `static-analysis.ts` that flags markdown lists (`- item` or `1. item`) inside Evidence component tags that aren't `<Grid>` or `<Tabs>`. Suggest moving the list outside the component or using HTML `<ul>/<li>` tags instead.

**Test Case:**
```typescript
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
  const hasListIssue = issues.some(i => i.message.includes("markdown list"));
  assert.ok(hasListIssue, "should have issue about markdown list");
});
```

**Target File:** `pi-pkg/extensions/evidence-quality-guard/static-analysis.ts`

---

### Problem 3: Angle-Bracket `<50%` Not Caught by Static Analysis (P1)

**Symptom:** Error overlay showing `Expected valid tag name: Line 1128, column 105` with `<50%` being parsed as an HTML tag.

**Evidence:**
```
1126: >The chart below shows yellow's share of total trips by zone. <strong
1127:   class="markdown"
1128: >Yellow zones</strong> (100% yellow) are Manhattan core. <strong class="markdown">Green zones</strong> (<50% yellow) are outer boroughs. <strong class="markdown">Mixed zones</strong> are the battleground.</p>
                                                                                                               ^
```

**Root Cause:** The agent wrote `<50%` in plain markdown text inside a component's text content. The static analysis checks for dangerous angle brackets (`/<(?![a-zA-Z\/\!])\S/g`) in non-code parts, but may have missed this case because it was inside a component context.

**Impact:** This caused a page load failure.

**Recommended Fix:**
Extend the angle-bracket detection to specifically check text content inside Evidence component tags (between `<Component>` and `</Component>` or `/>`). Add specific patterns for common cases like `<50%`, `<$100`, `<3 items`.

**Test Case:**
```typescript
test("detects <50% inside component text content", () => {
  const content = `
<Callout type="info">
**Reading this chart:** Zones near 100% are yellow fortresses. Zones below 50% are green territory.
</Callout>
`;
  const issues = analyzeEvidenceMarkdown(content);
  
  // This should NOT be flagged because "below 50%" is safe
  // But <50% SHOULD be flagged
  const content2 = `
<Callout type="info">
Green zones have <50% yellow share.
</Callout>
`;
  const issues2 = analyzeEvidenceMarkdown(content2);
  assert.ok(issues2.length > 0, "should detect <50%");
});
```

**Target File:** `pi-pkg/extensions/evidence-quality-guard/static-analysis.ts`

---

### Problem 4: Health Check Gives False Positives for Client-Side Errors (P1)

**Symptom:** `check_evidence_health` returned "All Clear ✅" with `q1 | ✅ 200 | OK`, but the browser showed rendering errors.

**Evidence:**
```
## Evidence Health Check — All Clear ✅

**Server:** ✅ Running on port 3141
**Build:** ✅ No compilation errors

### Pages
| Page | Status | Notes |
|------|--------|-------|
| q1 | ✅ 200 | OK |
```

But the browser showed:
```
Error
Component was left open. Ensure all components are closed...
```

**Root Cause:** The health check only verifies HTTP status codes and HTML structure, not Svelte runtime rendering. Client-side errors (like component parsing failures) only appear in the browser console, not in the HTTP response.

**Impact:** The health check gives false confidence — it says the page is healthy when it actually has rendering errors that only appear in the browser.

**Recommended Fix:**
After checking HTTP status, also check for Svelte error patterns in the HTML response:
- `Component was left open`
- `Expected valid tag name`
- `is not defined`
- `Cannot read propert`

If these patterns are found, report them as warnings or errors.

**Target File:** `pi-pkg/extensions/evidence-health-check.ts`

---

### Problem 5: Documentation Lookup Enforcement Not Granular Enough (P2)

**Symptom:** Agent used `<Callout>` component without reading its documentation, leading to the nested list issue.

**Evidence:** The agent read `/Volumes/T7/projects/company-bi/pi-pkg/skills/evidence/SKILL.md` which counts as a documentation read, so the enforcement was bypassed for specific components.

**Root Cause:** The quality guard checks if *any* documentation was read, not if the *specific* component's documentation was read.

**Impact:** Agents can bypass documentation lookup by reading any documentation file, not the specific component docs they need.

**Recommended Fix:**
Track which specific component documentation files were read (e.g., `BigValue.md`, `BarChart.md`, `Callout.md`). Enforce documentation lookup for each component used in the page, not just any documentation.

**Target File:** `pi-pkg/extensions/evidence-quality-guard/index.ts`

---

### Problem 6: Agent Didn't Call evidence_validate_page Proactively (P2)

**Symptom:** The agent wrote the page directly without calling `evidence_validate_page` first, relying on the automatic blocking behavior of the quality guard.

**Root Cause:** The evidence-dashboard skill doesn't explicitly recommend calling `evidence_validate_page` before writing.

**Impact:** Proactive validation would have caught the issues earlier and saved time.

**Recommended Fix:**
Add a step in the Phase 6 (Report Creation) workflow that says "Before writing the page, call `evidence_validate_page` to check for issues. This is faster than writing and having the guard block."

**Target File:** `pi-pkg/skills/evidence-dashboard/SKILL.md`

---

## What the Harness Did Well

### 1. Insight Candidate Scan and Report Design Plan

The evidence-bi-thinking skill produced a well-structured Insight Candidate Scan with 8 candidates (6 kept, 2 explored, 3 dropped) and a Report Design Plan with archetype, primary question, story arc, and proposed sections.

**Evidence:** `pages/draft.md` contains:
- Insight Candidate Scan table with analytical moves, business questions, query shapes, and Evidence components
- Discarded Candidates section explaining why 3 candidates were dropped
- Report Design Plan with report archetype, primary question, headline answer, story arc, and proposed Evidence sections

### 2. Quality Guard Caught Critical Errors

The quality guard blocked the page write when it detected the unclosed `<Callout>` component, preventing a broken page from being persisted.

**Evidence:** The agent received `PAGE WRITE BLOCKED — Component was left open` and had to fix the issue before proceeding.

### 3. Data Profiling Before Analysis

The agent ran `duckdb_summarize_table` on yellow, green, and zone lookup tables before writing any queries.

**Evidence:**
```
duckdb_summarize_table(table="files.yellow_tripdata_2024_01")
duckdb_summarize_table(table="files.green_tripdata_2024_01")
duckdb_summarize_table(table="files.taxi_zone_lookup")
```

### 4. SQL Validation Before Page Writes

The agent ran all SQL queries via `duckdb_run_sql` before writing them to the page, and the quality guard enforced this by blocking writes with unvalidated queries.

**Evidence:** The agent ran 6 queries (`summary`, `top5zones`, `yellow_share`, `revenue_per_trip`, `airport_comparison`, `opportunity_zones`) via `duckdb_run_sql` before writing the page.

### 5. Clear Workspace Structure

The workspace followed the content-only model with `pages/index.md`, `pages/draft.md`, `pages/report.md`, and question pages (`q1.md` through `q7.md`).

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

## Test Cases to Add

### 1. Markdown list inside Callout

```typescript
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
```

### 2. Angle bracket `<50%` in component text

```typescript
test("detects <50% inside component text content", () => {
  const content = `
<Callout type="info">
Green zones have <50% yellow share.
</Callout>
`;
  const issues = analyzeEvidenceMarkdown(content);
  assert.ok(issues.length > 0, "should detect <50%");
});
```

### 3. Health check detects Svelte error patterns

```typescript
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

## Missing Instrumentation

### 1. Record of which Evidence component docs were read

**Problem:** The agent read the evidence skill file but not specific component documentation. The quality guard tracked this as "documentation read" but didn't distinguish between skill files and component docs.

**Recommendation:** Track reads of `.agent/docs/evidence-oss/components/*.md` separately from skill files. Only count component doc reads as evidence of documentation lookup for that specific component.

### 2. Record of browser preview attempts and failures

**Problem:** The agent attempted multiple browser preview commands but none are recorded in the session.

**Recommendation:** Log browser preview attempts (success/failure) to a session artifact or the query audit log.

### 3. Record of Svelte rendering errors encountered

**Problem:** The Svelte rendering errors are only visible in the browser console or error overlay. They're not captured in any workspace artifact.

**Recommendation:** When `check_evidence_health` detects error patterns in HTML, log them to a `.pi/evidence-errors.log` file with timestamps and page names.

### 4. Record of evidence_validate_page calls

**Problem:** The agent didn't call `evidence_validate_page` before writing. The quality guard blocked the write, but there's no record of whether proactive validation was attempted.

**Recommendation:** Track `evidence_validate_page` calls in the session state. If a page write is blocked by the quality guard and no prior `evidence_validate_page` call was made for that page, log a warning.

---

## Future Workspace Experiment

### Hypothesis

The CMUX browser preview failure is caused by a browser extension or proxy that intercepts localhost requests, not by a fundamental CMUX issue.

### Experiment

1. Create a new workspace with `cmux-evidence new "test-preview"`
2. Immediately try `cmux open-browser --url "http://localhost:<port>/index"`
3. If it fails, try disabling browser extensions or using an incognito profile
4. Check if the browser surface shows the Evidence dashboard or an external page

### Success Criteria

The browser surface shows the Evidence dashboard, not an external page (Kagi, Google, etc.).

---

## Conclusion

The harness is mostly working well with targeted improvements needed. The highest priority fix is the CMUX browser preview workflow (P0), which prevents visual validation. The static analysis gaps (P1) cause avoidable page load failures. These are targeted fixes that would significantly improve future workspaces.
