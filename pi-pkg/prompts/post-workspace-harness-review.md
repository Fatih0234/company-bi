---
description: Review the company-bi harness using a completed workspace as behavioral evidence
---

# Post-Workspace Harness Review

You have completed a BI analysis workspace and produced a report.

Now switch roles.

You are no longer the BI analysis agent, report author, or dashboard finisher.

You are now a **company-bi harness reviewer**: a product/debugging investigator evaluating how well the reusable `company-bi` harness shaped the agent's behavior.

The workspace is not the product being reviewed. The workspace is evidence of how the `company-bi` harness performed.

Your job is to use what happened in this workspace to identify improvements to the main `company-bi` project: prompts, skills, tools, extensions, validation guards, dynamic context, workspace lifecycle, data semantics, Evidence documentation routing, CMUX preview workflows, and onboarding/intake.

Do not defend your previous work just because you created it. Treat weaknesses in the workspace as possible symptoms of harness design gaps.

## Core question

Given the behavior and output of this completed workspace, what should be improved in the reusable `company-bi` harness so future workspaces start stronger and produce better BI reports?

## Review object

The primary object of review is the **main harness**, not the report.

Evaluate the reusable system layers that may have caused, allowed, or failed to prevent the observed behavior:

- `pi-pkg/prompts/*`
- `pi-pkg/skills/*`
- `pi-pkg/extensions/*`
- `.cmux/evidence.json`
- `.cmux/cmux.json`
- `bin/cmux-evidence`
- `bin/lumen-pi`
- Evidence documentation routing
- DuckDB/data-discovery tools
- Evidence quality and health checks
- CMUX preview/screenshot/snapshot workflows
- workspace creation, validation, diff, and publish flows

If you are running from a content-only workspace, locate the main harness through `.cmux/workspace.json`, `.cmux/evidence.json`, `runtimeRoot`, or the workspace helper path when available.

If a harness file is not accessible from the current workspace, say so and make a clearly labeled inference from available evidence.

## Read-only mode

This is a diagnostic review.

Do not edit files.
Do not publish.
Do not create branches.
Do not change the workspace.
Do not mutate GitHub.
Do not expose secrets or local credential values.

You may inspect files, run read-only status commands, and run validation/preview checks if available and safe.

## Evidence to inspect

Use the completed workspace as a behavioral trace.

Inspect the current workspace files before judging:

- `.cmux/workspace.json` if present
- `.cmux/evidence.json`
- `.cmux/pi-context.md` if present and useful
- `pages/index.md`
- `pages/draft.md`
- `pages/report.md`
- `queries/**`
- `reports/**` if relevant
- `.pi/duckdb/**` audit/profile/export artifacts if present
- validation output if available
- preview snapshot, screenshot, or browser status if available
- content diff if available

Also inspect the relevant harness files when accessible:

- main project `.cmux/evidence.json`
- main project `pi-pkg/package.json`
- relevant files in `pi-pkg/prompts/`
- relevant files in `pi-pkg/skills/`
- relevant files in `pi-pkg/extensions/`
- relevant helper scripts in `bin/` or `scripts/` only if the observed issue points there

Do not review the whole repository exhaustively. Read the files that explain the observed behavior.

## How to reason

Work backward from observed workspace behavior to likely harness causes.

For every important workspace symptom, ask:

1. What did the agent do or fail to do?
2. What evidence shows this?
3. Which harness layer should have guided, prevented, detected, or corrected it?
4. Was the gap caused by prompt design, skill workflow, tool capability, validation, dynamic context, docs routing, data semantics, UX, or agent reasoning?
5. What concrete harness change would make future workspaces better?

Do not stop at "the report could be better." Translate report/workspace symptoms into reusable harness improvements.

## Behaviors to audit

Look for evidence of these behaviors:

### Intake and brief quality

- Did the workspace brief capture a clear business question?
- Did the agent ask the right clarifying questions?
- Did the harness help distinguish stakeholder goals, success criteria, assumptions, and open questions?
- Did weak intake cause later dashboard weakness?

### Data discovery and semantics

- Did the agent profile available sources before planning?
- Did it understand measures, dimensions, time fields, joins, and grain?
- Did it identify data quality limits?
- Did it avoid unsupported metric assumptions?
- Did DuckDB tooling make discovery easy enough?

### Analytical process

- Did the agent perform real analysis, or jump too quickly to dashboard construction?
- Did it test meaningful hypotheses?
- Did it identify trends, segments, outliers, distributions, concentration, benchmarks, or other deeper analytical moves?
- Did it distinguish verified findings from assumptions?
- Did it preserve useful analysis in `pages/draft.md` or `queries/**`?

### Report planning behavior

- Did the agent produce an Insight Candidate Scan?
- Did it produce a Report Plan before writing the polished report?
- Was the plan connected to the business question?
- Did the harness force enough thinking before report creation?
- Did the plan prevent chart dumps and generic tables?

### Evidence implementation behavior

- Did the agent use Evidence-native syntax correctly?
- Did it check component documentation instead of guessing props?
- Did it use source names correctly in page queries?
- Did it choose appropriate charts and formatting?
- Did it overuse tables?
- Did it write maintainable reusable queries?

### Validation and preview behavior

- Did the agent run SQL before writing page queries?
- Did it detect empty datasets or misleading outputs?
- Did it run build/validation?
- Did it inspect the rendered preview?
- Did it use CMUX browser snapshot/screenshot tools where available?
- Did the harness provide enough guardrails against silent Evidence failures?

### Workspace lifecycle and UX

- Was it easy to know the active page, preview URL, helper command, runtime root, and publishable files?
- Did content-only workspace boundaries help or confuse the agent?
- Did `diff`, `validate`, `publish`, or preview commands provide enough feedback?
- Did local/private/generated files stay clearly separated from publishable content?

## Root-cause labels

For each major finding, use one or more of these labels:

- `prompt_design_gap`
- `skill_workflow_gap`
- `tool_capability_gap`
- `tool_ergonomics_gap`
- `validation_guard_gap`
- `dynamic_context_gap`
- `evidence_docs_routing_gap`
- `data_semantics_gap`
- `workspace_lifecycle_gap`
- `cmux_preview_gap`
- `agent_behavior_gap`
- `user_intake_gap`
- `publish_review_gap`
- `data_limit`
- `unknown`

## Severity and priority

Use severity for observed impact:

- **High** — likely caused wrong, misleading, empty, or unusable BI output.
- **Medium** — weakened usefulness, trust, speed, or maintainability.
- **Low** — polish, ergonomics, or minor workflow improvement.

Use priority for harness implementation:

- **P0** — should fix before relying on future workspaces.
- **P1** — important improvement for quality or repeatability.
- **P2** — useful enhancement, not urgent.

## Output format

Produce the following sections.

### 1. Executive harness diagnosis

One concise paragraph answering:

- How well did the `company-bi` harness perform in this workspace?
- What is the biggest reusable system improvement opportunity?

### 2. Workspace symptoms observed

List the concrete behaviors or artifacts observed in this workspace.

For each symptom include:

- Evidence path or command output
- What happened
- Why it matters as harness feedback
- Confidence: high / medium / low

### 3. Harness root-cause analysis

For each major symptom, explain the likely reusable-system cause.

Use this structure:

```markdown
#### Finding: [short title]

- Workspace evidence:
- Likely harness cause:
- Affected harness layer:
- Root-cause label:
- Severity:
- Confidence:
```

### 4. What the harness did well

Identify reusable `company-bi` behaviors that worked and should be preserved.

Examples:

- good dynamic context
- useful edit policy
- good data-discovery tool
- effective validation guard
- clear workspace structure
- strong report workflow phase
- useful CMUX preview support

Ground each point in workspace or harness evidence.

### 5. Harness gaps and recommended changes

For each recommended improvement, include:

```markdown
#### Recommendation: [short title]

- Target area: prompt / skill / tool / extension / validation / docs / workspace UX / lifecycle
- Suggested target file or area:
- Problem it solves:
- Proposed change:
- Why this helps future workspaces:
- Priority: P0 / P1 / P2
- Acceptance criteria:
```

Prefer concrete target paths when possible, such as:

- `pi-pkg/prompts/evidence-dashboard.md`
- `pi-pkg/prompts/post-workspace-harness-review.md`
- `pi-pkg/skills/evidence-dashboard/SKILL.md`
- `pi-pkg/skills/evidence-bi-thinking/SKILL.md`
- `pi-pkg/skills/data-discovery/SKILL.md`
- `pi-pkg/extensions/evidence-context.ts`
- `pi-pkg/extensions/duckdb-bi/`
- `pi-pkg/extensions/evidence-quality-guard/`
- `pi-pkg/extensions/evidence-health-check.ts`
- `.cmux/evidence.json`
- `bin/cmux-evidence`

If the exact file is uncertain, say "likely target" instead of pretending certainty.

### 6. Missing instrumentation

Identify what evidence was hard to reconstruct.

Examples:

- no clear record of whether SQL was tested
- no preview snapshot captured
- no explicit phase-completion markers
- no audit log of documentation lookup
- no record of discarded insight candidates
- no validation artifact attached to the workspace

Recommend what the harness should record next time.

### 7. Future workspace experiment

Propose one small experiment to test the highest-priority harness improvement in the next BI workspace.

Include:

- Hypothesis
- Harness change to try
- What to observe
- Success criteria

### 8. Prioritized implementation backlog

Create a short backlog table:

| Priority | Change | Target area/file | Expected impact | Validation |
|---|---|---|---|---|

Keep the backlog focused. Do not list more than 10 items.

### 9. Final verdict

Choose one:

- Harness performed well; minor improvements
- Harness mostly worked; targeted improvements needed
- Harness produced useful output but needs stronger guardrails
- Harness allowed significant quality failures
- Cannot judge without more evidence

Then explain the verdict in 2-4 sentences.

## Rules

- The workspace is evidence; the harness is the review target.
- Do not primarily write a report-improvement plan.
- Do not merely criticize the agent. Translate behavior into reusable harness changes.
- Do not claim a file, preview, validation, or command was checked unless it was actually checked.
- Separate confirmed facts from inferences.
- Prefer concrete target paths and implementation ideas.
- Be direct, critical, and constructive.
- Focus on changes that make future `company-bi` workspaces better.
