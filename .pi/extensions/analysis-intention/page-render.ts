/**
 * TypeScript port of `render_brief_page` from `bin/cmux-evidence`.
 *
 * Produces the Brief page Markdown output for the analysis workspace.
 * The page includes: frontmatter, Workspace Brief, Build Checklist, Workspace
 * Pages map, and Notes for Pi. The Draft page is created separately by the CLI.
 */

import type { Intention, Clarification } from "./intention";

/**
 * Render a list of items as Markdown bullets, with a fallback if empty.
 * Mirrors the Python `bullets(values, fallback)` helper.
 */
function bullets(values: string[], fallback = "Not specified yet."): string {
  return values.length
    ? values.map((v) => `- ${v}`).join("\n")
    : fallback;
}

/**
 * Render a checklist of items, with default items if the input is empty.
 * Mirrors the Python `checklist(values, fallback_items)` helper.
 */
function checklist(values: string[], fallbackItems: string[]): string {
  const items = values.length ? values : fallbackItems;
  return items.map((v) => `- [ ] ${v}`).join("\n");
}

/**
 * Extract a list of strings from an intention field, handling both
 * string arrays and clarification objects ({ question, answer }).
 * Mirrors the Python `list_value(key)` inner function.
 */
function listValue(intention: Intention, key: keyof Intention): string[] {
  const raw = intention[key];
  if (!Array.isArray(raw)) return [];

  const result: string[] = [];
  for (const item of raw) {
    if (item && typeof item === "object" && "question" in (item as Clarification)) {
      const c = item as Clarification;
      const question = (c.question ?? "").trim();
      const answer = (c.answer ?? "").trim();
      if (question && answer) {
        result.push(`${question} — ${answer}`);
      } else if (question || answer) {
        result.push(question || answer);
      }
    } else {
      const text = String(item).trim();
      if (text) result.push(text);
    }
  }
  return result;
}

/**
 * Render a single question page Markdown.
 *
 * @param title - The workspace title
 * @param question - The question text
 * @param questionNumber - 1-based index of this question
 * @param totalQuestions - Total number of questions
 * @returns The complete Markdown content for the question page
 */
export function renderQuestionPage(
  title: string,
  question: string,
  questionNumber: number,
  totalQuestions: number,
): string {
  const fullTitle = `Q${questionNumber}: ${question}`;
  const titleYaml = JSON.stringify(fullTitle);
  return `---
title: ${titleYaml}
---

# ${question}

> Question ${questionNumber} of ${totalQuestions} from the analysis intention for **${title}**.

## Findings

_Explore the data and add queries, charts, and insights here._

## Notes

_Add assumptions, data quality notes, or decisions made with the user here._
`;
}

/**
 * Render the full analysis page Markdown.
 *
 * @param title - The workspace title (used in frontmatter and heading)
 * @param slug - The workspace slug (used for question page links)
 * @param intention - The Intention object (empty if not yet captured)
 * @returns The complete Markdown content for the page
 */
export function renderAnalysisPage(title: string, slug: string, intention: Intention): string {
  const goal = intention.goal?.trim() || "Describe the business question this dashboard should answer.";
  const questions = listValue(intention, "questions");
  const stakeholders = listValue(intention, "stakeholders");
  const successCriteria = listValue(intention, "successCriteria");
  const dashboardOptions = listValue(intention, "dashboardOptions");
  const assumptions = listValue(intention, "assumptions");
  const clarifications = listValue(intention, "clarifications");
  const openQuestions = listValue(intention, "openQuestions");

  const dashboardChecklist = checklist(
    dashboardOptions,
    [
      "Create KPI cards for the core operating metrics.",
      "Add at least one trend chart for time-based analysis.",
      "Add a ranking table or chart for important dimensions.",
      "Add useful filters if the data supports them.",
      "Validate the rendered dashboard in the CMUX browser preview.",
    ],
  );

  const questionRows = questions.length
    ? questions
        .map((q, i) => {
          const num = i + 1;
          const shortQ = q.length > 60 ? q.slice(0, 57) + "..." : q;
          return `| ${num} | ${shortQ} | [Q${num}](q${num}) |`;
        })
        .join("\n")
    : "| — | No questions captured yet. | — |";

  // JSON-encode the title for YAML frontmatter (handles quotes, escapes)
  const titleYaml = JSON.stringify(title);

  return `---
title: ${titleYaml}
---

# ${title}

This is an agent-created Evidence analysis workspace. The brief below comes from the onboarding conversation and should stay visible so the user and Pi can stay aligned while the dashboard evolves.

## Workspace Brief

### Goal

${goal}

### Questions this dashboard should answer

${bullets(questions)}

### Stakeholders / audience

${bullets(stakeholders)}

### Success criteria

${bullets(successCriteria)}

### Proposed dashboard direction

${bullets(dashboardOptions)}

### Assumptions

${bullets(assumptions)}

### Clarifications captured during onboarding

${bullets(clarifications, "No clarifications captured yet.")}

### Open questions

${bullets(openQuestions, "No open questions captured yet.")}

### Questions

| # | Question | Page |
|---|----------|------|
${questionRows}

Each question has its own dedicated page for focused exploration.

## Build Checklist

Pi should update this checklist as it turns the brief into an Evidence dashboard.

${dashboardChecklist}

## Workspace Pages

| Page | Purpose | Status |
|------|---------|--------|
| Draft | Exploration, hypothesis testing, messy queries | 🔄 Active |
| Report | Polished dashboard with validated findings | 📝 Not started |

The **Draft** page is the sandbox. Put experiments, raw queries, and work-in-progress there.
The **Report** page is the polished dashboard. Move validated findings there.
This **Brief** page (this page) is the workspace map and intention.

## Notes for Pi

- Keep the Workspace Brief aligned with \`.cmux/workspace.json\` when the user's goal changes.
- Prefer Evidence-native Markdown, SQL, KPI cards, charts, filters, and tables.
- Use the CMUX browser preview to verify visible dashboard quality after meaningful edits.
`;
}
