# Implementation Spec: Question-Driven Scaffold Pages

## Goal
After `save_intention_draft` captures the analysis intention, automatically create a dedicated page for each question under `pages/analysis/<slug>/q{N}.md`. The main brief page gets a Questions Hub table linking to each one. A soft one-line hint is injected into the dynamic context when the workspace has a non-empty intention.

**Principles:** Minimal, idempotent, no state tracking, no new tools, no new hooks beyond what's already there.

---

## Files to Modify

### 1. `.pi/extensions/analysis-intention/page-render.ts`

#### A. Add `renderQuestionPage()` (new function)

```typescript
export function renderQuestionPage(
  title: string,
  question: string,
  questionNumber: number,
  totalQuestions: number,
): string {
  const questionYaml = JSON.stringify(question);
  return `---
title: Q${questionNumber}: ${questionYaml}
---

# ${question}

> Question ${questionNumber} of ${totalQuestions} from the analysis intention for **${title}**.

## Findings

_Explore the data and add queries, charts, and insights here._

## Notes

_Add assumptions, data quality notes, or decisions made with the user here._
`;
}
```

#### B. Modify `renderAnalysisPage()` (add Questions Hub section)

Insert a new section after `### Open questions` and before `## Build Checklist`:

```typescript
  // Generate questions table
  const questionRows = questions.length
    ? questions
        .map((q, i) => {
          const num = i + 1;
          const shortQ = q.length > 60 ? q.slice(0, 57) + "..." : q;
          return `| ${num} | ${shortQ} | [Q${num}](analysis/${slug}-q${num}) |`;
        })
        .join("\n")
    : "| — | No questions captured yet. | — |";

  // ... in the template string, add:
```

Add this Markdown block to the template:

```markdown
### Questions

| # | Question | Page |
|---|----------|------|
${questionRows}

Each question has its own dedicated page for focused exploration.
```

The `slug` parameter needs to be passed into `renderAnalysisPage()` (currently it only takes `title` and `intention`). Update the signature to:

```typescript
export function renderAnalysisPage(
  title: string,
  slug: string,
  intention: Intention,
): string
```

Update all call sites.

---

### 2. `.pi/extensions/analysis-intention/index.ts`

#### A. Import `mkdirSync` from `node:fs`

Add to existing imports:
```typescript
import { mkdirSync } from "node:fs";
```

Import `renderQuestionPage` from `./page-render`:
```typescript
import { renderAnalysisPage, renderQuestionPage } from "./page-render";
```

#### B. Modify `save_intention_draft` execute block (add auto-scaffold)

After the line:
```typescript
const pageContent = renderAnalysisPage(result.title, intention);
writeFileSync(result.pagePath, pageContent, "utf8");
```

Add:

```typescript
// ── Auto-scaffold question pages (idempotent) ──
const questionDir = join(dirname(result.pagePath), result.slug);
if (!existsSync(questionDir)) {
  mkdirSync(questionDir, { recursive: true });
}

const createdQuestions: string[] = [];
const skippedQuestions: string[] = [];

for (let i = 0; i < intention.questions.length; i++) {
  const question = intention.questions[i].trim();
  if (!question) continue;

  const questionPath = join(questionDir, `q${i + 1}.md`);
  if (existsSync(questionPath)) {
    skippedQuestions.push(questionPath);
    continue;
  }

  const questionPage = renderQuestionPage(
    result.title,
    question,
    i + 1,
    intention.questions.length,
  );
  writeFileSync(questionPath, questionPage, "utf8");
  createdQuestions.push(questionPath);
}
```

Update the git commit section to stage all created question pages:

```typescript
// Before:
execSync(`git add "${result.pagePath}" .cmux/workspace.json`, ...)

// After:
const allPaths = [
  `"${result.pagePath}"`,
  `".cmux/workspace.json"`,
  ...createdQuestions.map((p) => `"${p}"`),
].join(" ");
execSync(`git add ${allPaths}`, ...)
```

Update the commit message to include question page info:

```typescript
commitMessage += ` ${createdQuestions.length} question page(s) created.`;
if (skippedQuestions.length) {
  commitMessage += ` ${skippedQuestions.length} existing page(s) left untouched.`;
}
```

Update the `renderAnalysisPage` call to pass `slug`:

```typescript
const pageContent = renderAnalysisPage(result.title, result.slug, intention);
```

#### C. Modify `before_agent_start` hook (soft guidance for non-empty intention)

Change the hook from:

```typescript
pi.on("before_agent_start", async (event) => {
    if (!isWorkspaceValid()) return undefined;
    const intention = readCurrentIntention();
    if (!isEmptyIntention(intention)) return undefined;

    const hint =
      "\n\n## Analysis intention\n" +
      "This workspace has no captured intention yet. The user can run `/analysis-intention` " +
      "to capture one, or continue without it.";

    return {
      systemPrompt: `${event.systemPrompt}${hint}`,
    };
});
```

To:

```typescript
pi.on("before_agent_start", async (event) => {
    if (!isWorkspaceValid()) return undefined;
    const intention = readCurrentIntention();

    if (isEmptyIntention(intention)) {
      const hint =
        "\n\n## Analysis intention\n" +
        "This workspace has no captured intention yet. The user can run `/analysis-intention` " +
        "to capture one, or continue without it.";
      return { systemPrompt: `${event.systemPrompt}${hint}` };
    }

    // Soft guidance for non-empty intention: one question at a time
    const questionCount = intention.questions?.length ?? 0;
    if (questionCount > 0) {
      const hint =
        `\n\n## Analysis Build Mode\n` +
        `This workspace has ${questionCount} question(s), each at ` +
        `\`pages/analysis/<slug>/q{N}.md\`. ` +
        `Work on one question at a time, report findings to the user, ` +
        `and ask for validation before moving to the next.`;
      return { systemPrompt: `${event.systemPrompt}${hint}` };
    }

    return undefined;
});
```

---

### 3. `.pi/extensions/evidence-context.ts` (optional, if we want brief page links)

If the Evidence sidebar renders page links nicely, we might not need any change here. But if we want the dynamic context to also list the question page paths, we could add a line in `renderIntention()`:

```typescript
const questionCount = stringArray(obj.questions).length;
if (questionCount) {
  lines.push(`- ${questionCount} question page(s) at pages/analysis/<slug>/q{N}.md`);
}
```

**Recommendation:** Skip this. The `before_agent_start` hook already provides the hint, and `evidence-context.ts` already lists the questions. Adding page paths to the dynamic context might clutter it. The brief page table is the canonical navigation.

---

## No Changes Needed

| File | Why No Change |
|------|--------------|
| `interview-protocol.md` | The protocol already captures questions. Page creation is a side effect of `save_intention_draft`, not part of the interview flow. |
| `intention.ts` | The `Intention` type stays `questions: string[]`. No structured question objects needed. |
| `registry-update.ts` | No new metadata to persist. The existing `updateIntention` function handles the save. Directory creation happens in `index.ts` at the call site. |
| `pi-ask-user` | The vendored extension is untouched. No new `ask_user` flows needed. |
| New files | No new extension files. All changes are in existing files. |

---

## Behavioral Specification

### Idempotency Rules

| Scenario | Behavior |
|----------|----------|
| First save, 5 questions | Creates `q1.md`–`q5.md`, updates brief page with table, commits all. |
| Second save, 6 questions (1 new) | Creates `q6.md` only. Leaves `q1.md`–`q5.md` untouched. Updates brief page table. Commits `q6.md` + brief + workspace.json. |
| Save with 0 questions | Creates no question pages. Brief page table shows "No questions captured yet." |
| Question reordered (e.g., Q2 and Q3 swapped) | `q2.md` and `q3.md` already exist → **left untouched**. Brief page table reflects the new order. The page titles might be slightly off, but content is preserved. This is an acceptable edge case. |
| Question text changed for Q3 | `q3.md` already exists → **left untouched**. The user or agent can manually edit the page if needed. |

### Git Commit Behavior

- Stages: brief page, workspace.json, all **newly created** question pages.
- Does **not** re-stage existing question pages (they were already committed, or have uncommitted edits).
- Commit message: `Capture analysis intention` (unchanged). The return message text includes the count of created/skipped pages.

### Evidence Routing

- Main brief: `pages/analysis/<slug>.md` → `/analysis/<slug>`
- Question pages: `pages/analysis/<slug>/q1.md` → `/analysis/<slug>/q1`
- The Evidence sidebar should show a collapsible folder `<slug>` containing `q1`, `q2`, etc.

---

## Open Implementation Decision

### The `renderAnalysisPage` slug parameter

Currently `updateIntention` returns `{ pagePath, slug, title }`. The `slug` is already available. We just need to pass it through to `renderAnalysisPage`.

**Verify:** `pagePath` is something like `pages/analysis/my-first.md`. `dirname(pagePath)` is `pages/analysis`. The question directory is `pages/analysis/my-first/`. The `slug` value from `workspace.json` is `my-first`. This matches.

---

## Testing Checklist (for verification after implementation)

1. [ ] Run `/analysis-intention` in a fresh workspace, capture 3 questions, save.
2. [ ] Verify `pages/analysis/<slug>/q1.md`, `q2.md`, `q3.md` exist.
3. [ ] Verify `q1.md` has the correct question as the title and heading.
4. [ ] Verify the brief page has a Questions table with 3 rows linking to each page.
5. [ ] Re-run `save_intention_draft` with 4 questions (1 new). Verify only `q4.md` is created; `q1`–`q3` are unchanged.
6. [ ] Edit `q2.md` manually, re-save intention. Verify manual edits are preserved.
7. [ ] Verify git log shows the staged files correctly.
8. [ ] Verify the `before_agent_start` hook injects the soft guidance line when intention is non-empty.
9. [ ] Verify the empty-intention hint still works (regression test).
