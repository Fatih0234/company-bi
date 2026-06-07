# Analysis: The `ask_user` → "Questions" Feature in Analysis Intention

## Executive Summary

The feature under analysis is the **iterative interview question** that asks users: *"What questions do you want to answer or what questions do you have within this analysis?"* This is the **second field** (`questions`) in the analysis intention capture flow, collected via the `ask_user` interactive TUI primitive. It sits at the intersection of the `pi-ask-user` vendored extension, the `analysis-intention` Pi extension, the `evidence-context.ts` dynamic context injector, and the rendered Evidence dashboard page.

---

## 1. Architecture Overview

The feature spans **four layers**:

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 1: pi-ask-user extension (vendored v0.11.2)       │
│  ─ Interactive TUI primitive for agent→user questions   │
│  ─ Renders overlay/inline modal, multi-select, freeform  │
├─────────────────────────────────────────────────────────┤
│  LAYER 2: analysis-intention extension (custom)          │
│  ─ Interview protocol (interview-protocol.md)             │
│  ─ LLM-driven, iterative, cumulative field capture        │
│  ─ Tools: start_analysis_intention, save_intention_draft  │
├─────────────────────────────────────────────────────────┤
│  LAYER 3: evidence-context.ts (dynamic context)          │
│  ─ Reads .cmux/workspace.json on every Pi turn          │
│  ─ Injects intention bullets into the system prompt      │
├─────────────────────────────────────────────────────────┤
│  LAYER 4: Evidence Dashboard Page (rendered Markdown)     │
│  ─ Workspace Brief page visible in the browser          │
│  ─ Build Checklist, Notes for Pi, Page map               │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Layer 1: `ask_user` — The Interactive Primitive

### What it is
A vendored extension (`edlsh/pi-ask-user@0.11.2`) that provides a **single LLM-callable tool** called `ask_user`. It is an **interactive blocking TUI primitive** — the agent calls it, the user answers, and the agent receives the response before any other tools can run.

### Key parameters

| Parameter | Type | Default | Purpose |
|---|---|---|---|
| `question` | `string` | **required** | The question text shown to the user |
| `context` | `string` | optional | A summary of findings shown *before* the question |
| `options` | `Array<QuestionOption \| string>` | optional | Multiple-choice options with titles + descriptions |
| `allowMultiple` | `boolean` | `false` | Allow selecting multiple options |
| `allowFreeform` | `boolean` | `true` | Add a "Type custom response..." freeform option |
| `allowComment` | `boolean` | `false` | Collect an optional comment after selection |
| `displayMode` | `"overlay" \| "inline"` | `"overlay"` | UI rendering mode |
| `timeout` | `number` | optional | Auto-dismiss after N ms |

### UI Modes

**Overlay mode (default):**
- Centered modal with 92% width, 40 min-width, 85% max-height
- Box-border drawn with `╭─╮│╰─╯` characters
- Title bar shows `ask_user` in accent color
- Keyboard shortcuts: `alt+o` to toggle visibility, `ctrl+g` to toggle comment
- Vim-style navigation: `ctrl+j`/`ctrl+k` or `tab`/`shift+tab`

**Inline mode:**
- Renders in-place in the terminal stream
- No overlay, no modal

### Multi-select UI
- Uses checkbox-style indicators: `[ ]` and `[✓]`
- Spacebar to toggle selection
- Supports fuzzy filtering for long option lists
- Freeform row always at the bottom when `allowFreeform: true`

### Response shapes

```typescript
type AskResponse =
  | { kind: "selection"; selections: string[]; comment?: string }
  | { kind: "freeform"; text: string };
```

**Critical behavior:** `executionMode: "sequential"` — the tool blocks ALL other tool calls in the same assistant turn until the user answers. This prevents the model from batching `ask_user` with `bash`/`edit`/`write` and letting those run with side effects before the user sees the prompt.

---

## 3. Layer 2: `analysis-intention` — The Interview Protocol

### Entry point: `/analysis-intention` slash command
1. Checks if user is in a valid workspace (`isWorkspaceValid()`)
2. If empty intention → sends a user message nudging the LLM to call `start_analysis_intention`
3. If non-empty → shows current summary and asks if user wants to Refine, Replace, or Discard

### The `start_analysis_intention` tool
Returns two things:
1. **Current state** — "No intention captured yet" or a rendered summary of existing fields
2. **Interview protocol** — the full text of `interview-protocol.md` loaded into the LLM's context

### The interview protocol's golden rules

1. **Before asking anything:** Read `.cmux/workspace.json` and all `sources/**/*.sql` files. Build a mental model of tables, entities, time fields, measures, dimensions, categorical fields.

2. **Always suggest options:** Never ask a blank open-ended question. Suggest 3-4 concrete analysis angles as options, plus a freeform option.

3. **One focused question per turn:** Never bundle multi-part questions. Never ask numbered sub-questions inside one call.

4. **Cumulative and refining:** Each turn references prior answers. If goal was "compare yellow vs green taxis", question suggestions should be about that comparison, not generic.

5. **Suggest answers when appropriate:** Pre-populate reasonable answers in the `context` field.

6. **Field order:** `goal → questions → stakeholders → successCriteria → dashboardOptions → assumptions → openQuestions`

7. **Stop condition:** `goal + ≥1 question + ≥1 stakeholder + ≥1 success criterion` minimum.

8. **Final suggestions step:** Before saving, review the brief and suggest 2-3 additional angles the user might have missed.

### The "Questions" field specifically

This is the **second field** in the interview, after `goal`. From the protocol:

> **Specific questions** (multi-select, `allowMultiple: true`) — 2-5 concrete questions the dashboard should answer

**Example from the protocol:**
```
Based on your TLC taxi data (yellow/green trips, zones, fares, times), 
here are some analysis directions:
- A. Compare yellow vs green taxi performance across NYC zones
- B. Identify peak revenue hours and underserved pickup areas
- C. Analyze tip patterns by payment type and borough
- D. Something else — describe your own idea
```

### The `save_intention_draft` tool

- Accepts a full `Intention` object with all 8 fields
- Validates: `goal` must be non-empty
- Writes atomically to `.cmux/workspace.json` (tmp + rename)
- Updates `.cmux/registry.json` too (finds project → workspace → sets `intention`)
- Re-renders the analysis page Markdown via `renderAnalysisPage()`
- Commits automatically: `git add <page> .cmux/workspace.json && git commit -m "Capture analysis intention"`

### Intention data shape

```typescript
interface Intention {
  goal: string;                    // Single overarching question
  questions: string[];           // 2-5 concrete dashboard questions ← THIS IS THE TARGET FIELD
  stakeholders: string[];        // Who will use the dashboard
  successCriteria: string[];     // How we know it succeeded
  dashboardOptions: string[];      // Visualizations and components
  assumptions: string[];          // Data-quality assumptions
  clarifications: { question: string; answer: string }[];
  openQuestions: string[];        // Need to clarify later
}
```

---

## 4. Layer 3: `evidence-context.ts` — Dynamic Context Injection

### How intention is consumed on every Pi turn

The `evidence-context.ts` extension reads `.cmux/workspace.json` on **every** `before_agent_start` hook and renders the intention as Markdown bullets appended to the system prompt.

### The `renderIntention` function

```typescript
function renderIntention(metadata: JsonObject | undefined): string[] {
  const intention = metadata?.intention;
  if (!intention || typeof intention !== "object" || Array.isArray(intention)) return [];
  const obj = intention as JsonObject;
  const lines: string[] = [];
  const goal = stringValue(obj.goal);
  if (goal) lines.push(`- Goal: ${goal}`);
  const sections: Array<[string, string]> = [
    ["questions", "Questions"],
    ["dashboardOptions", "Evidence dashboard direction"],
    ["successCriteria", "Success criteria"],
    ["assumptions", "Assumptions"],
    ["openQuestions", "Open questions"],
  ];
  for (const [key, label] of sections) {
    const values = stringArray(obj[key]);
    if (values.length) lines.push(`- ${label}: ${values.join("; ")}`);
  }
  return lines;
}
```

**Key observation:** The `questions` field is rendered as **semicolon-separated** on a single line, not as a bullet list. For example:
```
- Questions: Understand when and where taxi demand is highest; How does trip volume vary by hour?; Which pickup zones have the most trips?
```

This is different from the `renderIntentionBullets` helper in `intention.ts` which renders them as a multi-line list with `-` prefixes.

---

## 5. Layer 4: The Rendered Evidence Page

### `renderAnalysisPage()` in `page-render.ts`

Produces a Markdown page with this structure:

```markdown
---
title: "Workspace Title"
---

# Workspace Title

## Workspace Brief

### Goal
{goal text}

### Questions this dashboard should answer
- {question 1}
- {question 2}
...

### Stakeholders / audience
- {stakeholder 1}
...

### Success criteria
- {criterion 1}
...

### Proposed dashboard direction
- {direction 1}
...

### Assumptions
- {assumption 1}
...

### Clarifications captured during onboarding
- {clarification 1}
...

### Open questions
- {open question 1}
...

## Build Checklist
- [ ] {dashboard option 1}
- [ ] {dashboard option 2}
...

## Workspace Pages
| Page | Purpose | Status |
|------|---------|--------|
| Draft | Exploration... | 🔄 Active |
| Report | Polished dashboard... | 📝 Not started |

## Notes for Pi
- Keep the Workspace Brief aligned with `.cmux/workspace.json`
- Prefer Evidence-native Markdown, SQL, KPI cards, charts, filters, tables
- Use the CMUX browser preview to verify visible dashboard quality
```

**Key observation:** The `questions` field drives the **Build Checklist** (via `dashboardOptions`) and is prominently displayed as the second section after Goal. It is the primary user-facing articulation of what the analysis should answer.

---

## 6. Real-World Examples of Captured `questions`

### Example A: `my-first` workspace (9 questions)
```json
"questions": [
  "Understand when and where taxi demand is highest.",
  "How does trip volume vary by hour?",
  "Which pickup zones have the most trips?",
  "How does revenue differ by taxi service type?",
  "What is the total trip count by hour of day across all dates?",
  "Which pickup zones have the highest trip volume?",
  "How do yellow and green taxi services compare in total revenue?",
  "What is the average fare and tip amount by service type?",
  "How does trip volume vary by day of week?"
]
```

**Observation:** The questions are a mix of natural-language questions and SQL-like metric descriptions. Some are clearly LLM-suggested ("What is the total trip count by hour of day across all dates?" sounds like a generated query). There's duplication: "Which pickup zones have the most trips?" and "Which pickup zones have the highest trip volume?" are essentially the same.

### Example B: `airport-taxi-demand-and-revenue-patterns` (7 questions)
```json
"questions": [
  "airport-related trips.",  // ← BUG: This looks like a fragment, not a question
  "Which pickup zones associated with airports generate the most taxi trips?",
  "What is the average fare, tip, trip distance, and trip duration for airport-related trips?",
  "What are the peak demand hours for airport taxi pickups across the dataset?",
  "Which specific airport pickup zones (e.g., JFK, LaGuardia, Newark) have the highest trip volumes?",
  "How do taxi fares, tips, and trip distances compare between yellow and green airport services?",
  "What is the average trip duration for airport-related taxi trips by zone and service type?",
  "How does airport taxi demand vary by day of week or month?"
]
```

**Observation:** First item is clearly malformed — it looks like a fragment that got appended to the goal string ("Help airport operations... understand taxi demand, revenue, and service patterns for airport-related trips."). The goal was truncated and the remainder spilled into the first question.

### Example C: `test123456` (2 questions)
```json
"questions": [
  "How do yellow and green taxis differ across NYC zones and boroughs?",
  "What are the geographic patterns in trip distribution by taxi type?"
]
```

**Observation:** Clean, focused, aligned with the goal. Only 2 questions — minimal but sufficient.

### Example D: `test1234567` (4 questions)
```json
"questions": [
  "When are peak revenue hours?",
  "Which zones have highest demand?",
  "Yellow vs green geographic split?",
  "Do demand patterns differ between weekdays and weekends?"
]
```

**Observation:** Very concise, almost like keywords rather than full sentences. This suggests the user typed freeform responses rather than selecting from LLM-suggested options.

---

## 7. Strengths of the Current Implementation

### 1. **Creative, collaborative interview design**
The protocol is excellent. It frames the LLM as a "data-savvy analyst suggesting angles" rather than a form-filling clerk. The "always suggest options" rule prevents blank-slate paralysis.

### 2. **Data-aware suggestions**
By reading `sources/**/*.sql` before asking, the LLM can suggest concrete, data-grounded analysis angles. For example, knowing the dataset has `yellow`/`green` taxi types, `pickup_zone`, `fare`, `tip` enables specific suggestions.

### 3. **Multi-select with freeform fallback**
`allowMultiple: true` + `allowFreeform: true` gives users flexibility: they can pick suggested angles, type their own, or do both. The `allowComment` option lets them add nuance.

### 4. **Cumulative context**
Each turn builds on the previous. The `context` field lets the LLM show the user a synthesized summary before each question. This keeps the user oriented.

### 5. **Durable, multi-consumer storage**
The intention is stored in `.cmux/workspace.json` (workspace-level) and mirrored in `.cmux/registry.json` (project-level). Both the dynamic context injector and the Evidence page renderer consume the same source of truth.

### 6. **Auto-commit on save**
`save_intention_draft` automatically stages and commits the page + workspace.json, so the brief is versioned from the start.

### 7. **Sequential execution mode**
`ask_user` blocks other tools, preventing the model from running destructive commands before the user sees the question. This is a critical safety feature.

---

## 8. Weaknesses and Observations

### 1. **Question quality is inconsistent**
Real-world examples show:
- **Duplication** (Example A: two questions about "pickup zones with most trips")
- **Fragmentation** (Example B: "airport-related trips." as a standalone question)
- **Over-generation** (Example A has 9 questions; the protocol says "2-5 concrete questions")
- **Varying verbosity** (Example D is keyword-like; Example A is SQL-like)

**Root cause:** The LLM has no quality gate between the `ask_user` response and the `Intention.questions` array. Whatever the user selects or types goes in verbatim. There's no deduplication, no validation, no rewording.

### 2. **The `context` field in `ask_user` is under-utilized for the questions field**
The protocol says: *"Pass this summary in the `context` field of `ask_user` so the user sees it before every question."* But in practice, the `context` is often just a generic data summary, not a tailored synthesis of what the goal implies for the questions field.

### 3. **No cross-field validation**
The `questions` are not validated against the `goal`. A user could set goal="compare yellow vs green taxis" but then select questions about weather patterns (if the LLM suggested them). The protocol says "cumulative and refining" but there's no enforcement.

### 4. **The `questions` field is semantically overloaded**
It mixes:
- Natural-language research questions ("How do yellow and green taxis differ...?")
- Metric definitions ("What is the total trip count by hour...")
- Dashboard feature requests ("Show a map of NYC zones...")
- Descriptive fragments ("airport-related trips.")

There's no typing or categorization. All are just strings in an array.

### 5. **Rendering inconsistency**
- `evidence-context.ts` renders questions as semicolon-separated on one line (`- Questions: Q1; Q2; Q3`)
- `page-render.ts` renders them as a bulleted list (`- Q1\n- Q2\n- Q3`)
- The protocol's example shows them as a numbered list in the `ask_user` options

This inconsistency means the same data looks different in different contexts.

### 6. **No "question importance" or "priority"**
All questions are treated as equal. In a dashboard with 9 questions, some are clearly more important than others. There's no way for the user to rank or weight them.

### 7. **The final-suggestions step is LLM-dependent**
The protocol says: *"Before calling save_intention_draft, review the assembled brief and suggest 2-3 additional angles."* But this depends entirely on the LLM's quality. There's no structured way to ensure this step happens, and no fallback if the LLM skips it.

### 8. **No way to link questions to specific data sources**
A question like "Which pickup zones have the most trips?" implicitly maps to a specific table/column, but that mapping is never captured. If the data source changes, the question might become invalid, but there's no way to detect that.

### 9. **The `allowMultiple: true` UX can be confusing**
Users might not realize they can select multiple options. The `ask_user` UI shows `[ ]` checkboxes, but the prompt doesn't explicitly say "Select all that apply." The protocol says to use `allowMultiple: true` for questions, but the tool description doesn't emphasize this to the user.

### 10. **No edit/review after selection**
Once the user selects questions and hits enter, the interview proceeds to the next field. There's no "Review your selected questions" step. The user can only see the full list at the end, in the final-suggestions step.

---

## 9. Interaction Patterns Between Layers

### Pattern A: Normal flow (user selects from options)
```
User: /analysis-intention
LLM: start_analysis_intention → reads protocol + current state
LLM: reads sources/**/*.sql, builds context
LLM: ask_user(question="What questions...", context=<data summary>, options=[A, B, C, D], allowMultiple=true)
User: selects A, C in TUI overlay
ask_user returns: { kind: "selection", selections: ["A", "C"] }
LLM: stores in Intention.questions
LLM: proceeds to stakeholders field
```

### Pattern B: Freeform flow (user types custom)
```
LLM: ask_user(..., allowFreeform=true)
User: navigates to "Type something. — Enter a custom response" option
User: types custom question in freeform editor
ask_user returns: { kind: "freeform", text: "When are peak revenue hours?" }
LLM: stores in Intention.questions
```

### Pattern C: Fragment bug (Example B)
```
LLM: ask_user for goal
User: selects "Help airport operations... understand taxi demand, revenue, and service patterns for airport-related trips."
[The goal is actually longer than the UI shows; the truncated remainder is stored in the goal field]
LLM: ask_user for questions
User: selects some option or freeform
[Somehow the first question becomes "airport-related trips." — likely a parsing bug where the goal string was split and the tail spilled into questions]
```

### Pattern D: Dynamic context injection (every turn)
```
Pi: before_agent_start hook
  evidence-context.ts: reads .cmux/workspace.json
  evidence-context.ts: renderIntention() → lines
  System prompt gets: "## Analysis intention\n- Goal: ...\n- Questions: Q1; Q2; Q3\n- ..."
LLM: uses this context to generate SQL queries, charts, etc.
```

---

## 10. What Works Well for Building On Top

### A. The `ask_user` primitive is robust
It's a well-tested, vendored component with:
- Overlay and inline rendering
- Multi-select with freeform
- Comment collection
- Keyboard navigation
- Fuzzy filtering
- Timeout support
- Sequential execution blocking

**Building on it:** You can reuse `ask_user` for any new interview fields or flows without modifying the extension.

### B. The Intention shape is extensible
The `Intention` interface is a flat JSON object. Adding new fields (e.g., `questionPriorities`, `questionCategories`, `linkedDataSources`) is straightforward. Both `workspace.json` and `registry.json` would accept them without migration.

### C. The protocol is text-based and LLM-readable
`interview-protocol.md` is a Markdown file read at runtime. You can modify the interview flow by editing this file — no code changes needed. The LLM reads it and follows the instructions.

### D. The page renderer is decoupled
`page-render.ts` is a pure function: `renderAnalysisPage(title, intention) → string`. You can change the Markdown template without touching the interview logic or the registry updater.

### E. The evidence-context injector is modular
`renderIntention()` in `evidence-context.ts` is a small, isolated function. You can change how questions are rendered in the dynamic context without affecting the page or the interview.

---

## 11. What Needs Attention for Building On Top

### A. The `questions` field lacks structure
If you want to add metadata to questions (priority, category, linked source, SQL template), you'll need to:
1. Change the `Intention` type from `string[]` to an array of objects
2. Update the `ask_user` response parsing in the LLM prompt (currently just strings)
3. Update `renderIntention()` to handle the new shape
4. Update `renderAnalysisPage()` to render the new shape
5. Update all existing workspaces (or handle backward compatibility)

### B. The `ask_user` response is just strings
The `ask_user` tool returns `selections: string[]` — the selected option titles. If you want to capture richer metadata from the options (e.g., each option has a `questionType`, `suggestedSQL`, `dataSource`), you'd need to either:
- Encode that metadata in the option title string (fragile)
- Change the `ask_user` tool to return option indices instead of strings (requires modifying the vendored extension)
- Post-process the strings in the LLM to match them back to the suggested options (unreliable)

### C. The interview is LLM-driven, not script-driven
The field order, validation, and flow are all determined by the LLM reading the protocol text. There's no state machine or script enforcing the flow. If the LLM skips the final-suggestions step or asks questions out of order, there's no programmatic catch.

### D. The `allowMultiple: true` UI doesn't show the count
When a user selects 5 questions in multi-select mode, they don't see "5 selected" until they submit. There's no running tally. This could lead to over-selection (Example A has 9 questions).

### E. No intermediate save/checkpoint
The entire interview must complete before `save_intention_draft` is called. If the user abandons mid-interview, nothing is saved. There's no "Save progress" or "Resume later" mechanism.

---

## 12. Summary Table: Key Files and Their Roles

| File | Role | Relevant to `questions` field? |
|---|---|---|
| `.pi/extensions/pi-ask-user/index.ts` | TUI primitive for `ask_user` | Yes — renders the UI |
| `.pi/extensions/pi-ask-user/single-select-layout.ts` | Layout logic for option rendering | Yes — renders question options |
| `.pi/extensions/analysis-intention/index.ts` | Extension entry point, tools, hooks | Yes — orchestrates the interview |
| `.pi/extensions/analysis-intention/interview-protocol.md` | LLM-readable interview instructions | Yes — defines the `questions` field rules |
| `.pi/extensions/analysis-intention/intention.ts` | Type definitions and helpers | Yes — defines `questions: string[]` |
| `.pi/extensions/analysis-intention/page-render.ts` | Renders Evidence page Markdown | Yes — renders questions as bullets |
| `.pi/extensions/analysis-intention/registry-update.ts` | Reads/writes workspace.json and registry.json | Yes — persists the questions array |
| `.pi/extensions/evidence-context.ts` | Dynamic context injection on every turn | Yes — renders questions in system prompt |
| `.cmux/workspace.json` | Workspace metadata + intention | Yes — stores the actual questions array |
| `.cmux/registry.json` | Project-level registry of workspaces | Yes — mirrors the intention |

---

## 13. Open Questions for the Next Phase

1. **Should the `questions` field be typed?** (e.g., `{ text: string, priority: number, category: string }[]` instead of `string[]`)
2. **Should there be a programmatic state machine** enforcing the interview flow, rather than relying on the LLM to read the protocol?
3. **Should `ask_user` support returning option indices** (enabling richer metadata per option) rather than just string titles?
4. **Should there be a "review and edit" step** between the interview and `save_intention_draft`?
5. **Should the dynamic context render questions as a bulleted list** instead of semicolon-separated, for better LLM comprehension?
6. **Should questions be validated against available data sources** — e.g., a question about "tip patterns" should fail if the dataset has no `tip_amount` column?
7. **Should the interview support partial save/resume** — save progress after each field so the user can abandon and resume?

---

*End of analysis. Ready to discuss what we want to build on top of this foundation.*
