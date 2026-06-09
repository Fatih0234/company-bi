// Unit tests for static-analysis.ts
//
// Run with: node --experimental-strip-types --test tests/static-analysis.test.ts
//
// These tests verify the static analysis logic that detects
// rendering issues in Evidence markdown files.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeEvidenceMarkdown,
  renderingIssuesToErrors,
} from "../static-analysis.ts";

// ---------------------------------------------------------------------------
// analyzeEvidenceMarkdown - Dangerous angle brackets
// ---------------------------------------------------------------------------

test("detects dangerous angle bracket <1", () => {
  const content = `
# My Dashboard

The value is <100 trips per day.
`;
  const issues = analyzeEvidenceMarkdown(content);
  
  assert.ok(issues.length > 0, "should detect <1");
  const hasAngleIssue = issues.some(i => i.message.includes("<1"));
  assert.ok(hasAngleIssue, "should have issue about <1");
});

test("detects dangerous angle bracket <2", () => {
  const content = `
# My Dashboard

We have <2 trips.
`;
  const issues = analyzeEvidenceMarkdown(content);
  
  assert.ok(issues.length > 0, "should detect <2");
});

test("does NOT flag valid HTML tags", () => {
  const content = `
# My Dashboard

<div>This is valid</div>
<span>Also valid</span>
`;
  const issues = analyzeEvidenceMarkdown(content);
  
  // Should not have issues about div or span
  const hasInvalidTag = issues.some(i => i.message.includes("div") || i.message.includes("span"));
  assert.equal(hasInvalidTag, false, "should not flag valid HTML tags");
});

test("does NOT flag Evidence components", () => {
  const content = `
# My Dashboard

<BarChart data={query} x=date y=count />
<DataTable data={query} />
`;
  const issues = analyzeEvidenceMarkdown(content);
  
  // Should not have issues about BarChart or DataTable
  const hasComponentIssue = issues.some(i => 
    i.message.includes("BarChart") || i.message.includes("DataTable")
  );
  assert.equal(hasComponentIssue, false, "should not flag Evidence components");
});

test("ignores angle brackets in code blocks", () => {
  const content = `
# My Dashboard

\`\`\`sql
SELECT * FROM trips WHERE id < 100
\`\`\`
`;
  const issues = analyzeEvidenceMarkdown(content);
  
  // Should not flag <100 in code block
  const hasAngleIssue = issues.some(i => i.message.includes("<100"));
  assert.equal(hasAngleIssue, false, "should not flag angle brackets in code blocks");
});

test("ignores angle brackets in inline code", () => {
  const content = `
# My Dashboard

Use \`id < 100\` to filter.
`;
  const issues = analyzeEvidenceMarkdown(content);
  
  const hasAngleIssue = issues.some(i => i.message.includes("<100"));
  assert.equal(hasAngleIssue, false, "should not flag angle brackets in inline code");
});

// ---------------------------------------------------------------------------
// analyzeEvidenceMarkdown - _pct in stacked100
// ---------------------------------------------------------------------------

test("detects _pct columns in stacked100 charts", () => {
  const content = `
<BarChart 
  data={data} 
  x=category 
  y={["value_pct", "other_pct"]} 
  type="stacked100"
/>
`;
  const issues = analyzeEvidenceMarkdown(content);
  
  assert.ok(issues.length > 0, "should detect _pct issue");
  const hasPctIssue = issues.some(i => i.message.includes("_pct"));
  assert.ok(hasPctIssue, "should have issue about _pct");
});

test("does NOT flag _pct in non-stacked100 charts", () => {
  const content = `
<BarChart 
  data={data} 
  x=category 
  y={["value_pct", "other_pct"]} 
/>
`;
  const issues = analyzeEvidenceMarkdown(content);
  
  // Should not have _pct issue for non-stacked100
  const hasPctIssue = issues.some(i => i.message.includes("_pct"));
  assert.equal(hasPctIssue, false, "should not flag _pct in non-stacked100");
});

test("does NOT flag _share columns in stacked100 charts", () => {
  const content = `
<BarChart 
  data={data} 
  x=category 
  y={["value_share", "other_share"]} 
  type="stacked100"
/>
`;
  const issues = analyzeEvidenceMarkdown(content);
  
  const hasPctIssue = issues.some(i => i.message.includes("_pct"));
  assert.equal(hasPctIssue, false, "should not flag _share columns");
});

// ---------------------------------------------------------------------------
// analyzeEvidenceMarkdown - seriesColors mismatch
// ---------------------------------------------------------------------------

test("detects seriesColors keys that don't match y columns", () => {
  const content = `
<BarChart 
  data={data} 
  x=category 
  y={["col1", "col2"]} 
  seriesColors={{"col1": "red", "col3": "blue"}}
/>
`;
  const issues = analyzeEvidenceMarkdown(content);
  
  assert.ok(issues.length > 0, "should detect seriesColors mismatch");
  const hasMismatch = issues.some(i => i.message.includes("col3") && i.message.includes("seriesColors"));
  assert.ok(hasMismatch, "should have issue about col3 mismatch");
});

test("does NOT flag matching seriesColors keys", () => {
  const content = `
<BarChart 
  data={data} 
  x=category 
  y={["col1", "col2"]} 
  seriesColors={{"col1": "red", "col2": "blue"}}
/>
`;
  const issues = analyzeEvidenceMarkdown(content);
  
  const hasMismatch = issues.some(i => i.message.includes("seriesColors"));
  assert.equal(hasMismatch, false, "should not flag matching seriesColors");
});

// ---------------------------------------------------------------------------
// analyzeEvidenceMarkdown - swapXY issues
// ---------------------------------------------------------------------------

test("detects swapXY with time x-axis", () => {
  const content = `
<BarChart 
  data={data} 
  x=date 
  y=count 
  swapXY=true 
  xType="time"
/>
`;
  const issues = analyzeEvidenceMarkdown(content);
  
  assert.ok(issues.length > 0, "should detect swapXY with time");
  const hasSwapIssue = issues.some(i => i.message.includes("swapXY") || i.message.includes("Horizontal"));
  assert.ok(hasSwapIssue, "should have issue about swapXY");
});

test("detects swapXY with y2 axis", () => {
  const content = `
<BarChart 
  data={data} 
  x=category 
  y=count 
  y2=revenue
  swapXY=true
/>
`;
  const issues = analyzeEvidenceMarkdown(content);
  
  assert.ok(issues.length > 0, "should detect swapXY with y2");
  const hasY2Issue = issues.some(i => i.message.includes("y2") || i.message.includes("secondary"));
  assert.ok(hasY2Issue, "should have issue about y2");
});

// ---------------------------------------------------------------------------
// analyzeEvidenceMarkdown - yLog with stacked
// ---------------------------------------------------------------------------

test("detects yLog with stacked chart", () => {
  const content = `
<BarChart 
  data={data} 
  x=category 
  y=count 
  yLog=true
  type="stacked"
/>
`;
  const issues = analyzeEvidenceMarkdown(content);
  
  assert.ok(issues.length > 0, "should detect yLog with stacked");
  const hasLogIssue = issues.some(i => i.message.includes("Log") || i.message.includes("log"));
  assert.ok(hasLogIssue, "should have issue about log axis");
});

test("detects yLog with stacked100 chart", () => {
  const content = `
<BarChart 
  data={data} 
  x=category 
  y=count 
  yLog=true
  type="stacked100"
/>
`;
  const issues = analyzeEvidenceMarkdown(content);
  
  assert.ok(issues.length > 0, "should detect yLog with stacked100");
});

// ---------------------------------------------------------------------------
// analyzeEvidenceMarkdown - Valid content
// ---------------------------------------------------------------------------

test("returns no issues for valid content", () => {
  const content = `
# My Dashboard

\`\`\`sql daily_metrics
SELECT pickup_date, COUNT(*) as trip_count
FROM trips
GROUP BY pickup_date
\`\`\`

<BarChart data={daily_metrics} x=pickup_date y=trip_count />

This is a valid dashboard with no issues.
`;
  const issues = analyzeEvidenceMarkdown(content);
  
  // Should have no issues (or only warnings, not errors)
  const errors = issues.filter(i => i.severity === 'error');
  assert.equal(errors.length, 0, "should have no errors for valid content");
});

test("returns no issues for empty content", () => {
  const issues = analyzeEvidenceMarkdown("");
  assert.equal(issues.length, 0, "should have no issues for empty content");
});

test("returns no issues for content with only frontmatter", () => {
  const content = `
---
title: My Dashboard
---
`;
  const issues = analyzeEvidenceMarkdown(content);
  assert.equal(issues.length, 0, "should have no issues for frontmatter only");
});

// ---------------------------------------------------------------------------
// analyzeEvidenceMarkdown - Multiple issues
// ---------------------------------------------------------------------------

test("detects multiple issues in same file", () => {
  const content = `
# My Dashboard

The value is <100 trips.

<BarChart 
  data={data} 
  x=category 
  y={["value_pct"]} 
  type="stacked100"
/>
`;
  const issues = analyzeEvidenceMarkdown(content);
  
  // Should detect both <1 and _pct issues
  assert.ok(issues.length >= 2, "should detect multiple issues");
  const hasAngleIssue = issues.some(i => i.message.includes("<100"));
  const hasPctIssue = issues.some(i => i.message.includes("_pct"));
  assert.ok(hasAngleIssue, "should have angle bracket issue");
  assert.ok(hasPctIssue, "should have _pct issue");
});

// ---------------------------------------------------------------------------
// renderingIssuesToErrors
// ---------------------------------------------------------------------------

test("renderingIssuesToErrors: converts issues to validation errors", () => {
  const issues = [
    { line: 10, message: "Test issue", fixHint: "Fix it", severity: "error" as const },
    { line: 20, message: "Another issue", fixHint: "Fix that", severity: "warning" as const },
  ];
  
  const errors = renderingIssuesToErrors(issues);
  
  assert.equal(errors.length, 2);
  assert.equal(errors[0].type, "static_analysis");
  assert.equal(errors[0].line, 10);
  assert.equal(errors[0].message, "Test issue");
  assert.equal(errors[0].fixHint, "Fix it");
});

test("renderingIssuesToErrors: handles empty array", () => {
  const errors = renderingIssuesToErrors([]);
  assert.equal(errors.length, 0);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("handles content with only SQL blocks", () => {
  const content = `
\`\`\`sql query1
SELECT * FROM trips
\`\`\`

\`\`\`sql query2
SELECT * FROM zones
\`\`\`
`;
  const issues = analyzeEvidenceMarkdown(content);
  assert.equal(issues.length, 0, "should have no issues for SQL-only content");
});

test("handles content with only components", () => {
  const content = `
<BarChart data={query} x=date y=count />
<DataTable data={query} />
`;
  const issues = analyzeEvidenceMarkdown(content);
  assert.equal(issues.length, 0, "should have no issues for component-only content");
});

test("handles very long content", () => {
  let content = "# Dashboard\n\n";
  for (let i = 0; i < 100; i++) {
    content += `Line ${i} with some text.\n`;
  }
  content += "\n<BarChart data={query} x=date y=count />\n";
  
  const issues = analyzeEvidenceMarkdown(content);
  // Should not crash and should handle long content
  assert.ok(Array.isArray(issues), "should return array of issues");
});
