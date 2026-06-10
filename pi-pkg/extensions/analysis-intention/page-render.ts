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
 * Extract a short, sidebar-friendly label from a question string.
 *
 * Most questions follow the pattern "Topic \u2014 Details" where the part before
 * the em-dash is the natural short label. If there is no em-dash, we fall back
 * to the first few words.
 *
 * @param question - The full question text
 * @returns A short label (2-5 words ideal, never more than ~40 chars)
 */
function extractShortLabel(question: string): string {
  const trimmed = question.trim();

  // Split on em-dash (—) — the most common pattern in LLM-generated questions
  const emDashParts = trimmed.split(/\s*—\s*/);
  if (emDashParts.length > 1) {
    const candidate = emDashParts[0].trim();
    if (candidate.length <= 40 && candidate.split(/\s+/).length <= 6) {
      return candidate;
    }
  }

  // Split on en-dash (–) as fallback
  const enDashParts = trimmed.split(/\s*–\s*/);
  if (enDashParts.length > 1) {
    const candidate = enDashParts[0].trim();
    if (candidate.length <= 40 && candidate.split(/\s+/).length <= 6) {
      return candidate;
    }
  }

  // Split on regular dash (-) if preceded/followed by spaces
  const dashParts = trimmed.split(/\s+-\s+/);
  if (dashParts.length > 1) {
    const candidate = dashParts[0].trim();
    if (candidate.length <= 40 && candidate.split(/\s+/).length <= 6) {
      return candidate;
    }
  }

  // No dash found — take the first 4 words, truncated at 40 chars
  const words = trimmed.split(/\s+/).slice(0, 4).join(' ');
  return words.length > 40 ? words.slice(0, 37) + '...' : words;
}

export function renderQuestionPage(
  title: string,
  question: string,
  questionNumber: number,
  totalQuestions: number,
): string {
  const shortLabel = extractShortLabel(question);
  const sidebarTitle = `Q${questionNumber}: ${shortLabel}`;
  const titleYaml = JSON.stringify(sidebarTitle);
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
          const shortLabel = extractShortLabel(q);
          return `| ${num} | ${shortLabel} | [Q${num}](q${num}) |`;
        })
        .join("\n")
    : "| — | No questions captured yet. | — |";

  // Build data requirements section
  const dr = intention.dataRequirements;
  let dataRequirementsSection = "";
  if (dr) {
    const parts: string[] = [];
    if (dr.timePeriod) parts.push(`- **Time period**: ${dr.timePeriod}`);
    if (dr.serviceTypes?.length) parts.push(`- **Service types**: ${dr.serviceTypes.join(", ")}`);
    if (dr.minimumRows) parts.push(`- **Minimum rows**: ${dr.minimumRows.toLocaleString()}`);
    if (dr.source) parts.push(`- **Source**: ${dr.source}`);
    if (dr.notes) parts.push(`- **Notes**: ${dr.notes}`);
    if (parts.length) {
      dataRequirementsSection = `\n### Data requirements\n\n${parts.join("\n")}\n`;
    }
  }

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
${dataRequirementsSection}
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
