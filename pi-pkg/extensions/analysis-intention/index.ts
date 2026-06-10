/**
 * Analysis Intention Extension
 *
 * Drives the in-session analysis intention interview for Evidence BI workspaces.
 * Replaces the CLI's `collect_analysis_intention` with an iterative, cumulative,
 * LLM-driven flow using `ask_user`.
 *
 * Surfaces:
 *   - Slash command: /analysis-intention
 *   - LLM-callable tools: start_analysis_intention, save_intention_draft, read_intention_draft
 *   - session_start hook: muted tip when no intention exists
 *   - before_agent_start hook: small hint in dynamic context when intention is empty
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
  type Intention,
  emptyIntention,
  isEmptyIntention,
  renderIntentionBullets,
} from "./intention";
import { renderAnalysisPage, renderQuestionPage } from "./page-render";
import { updateIntention, readCurrentWorkspaceJson } from "./registry-update";

// ── Helpers ──────────────────────────────────────────────────────────

type JsonObject = Record<string, unknown>;

function safeReadJson(path: string): JsonObject | undefined {
  try {
    if (!existsSync(path)) return undefined;
    const text = readFileSync(path, "utf8");
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonObject)
      : undefined;
  } catch {
    return undefined;
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function findEvidenceRoot(start = process.cwd()): string | undefined {
  let current = resolve(start);
  while (true) {
    if (existsSync(join(current, ".cmux", "evidence.json"))) return current;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function readWorkspaceJson(root?: string): JsonObject | undefined {
  const evidenceRoot = root ?? findEvidenceRoot();
  if (!evidenceRoot) return undefined;
  return safeReadJson(join(evidenceRoot, ".cmux", "workspace.json"));
}

function readEvidenceConfig(root?: string): JsonObject | undefined {
  const evidenceRoot = root ?? findEvidenceRoot();
  if (!evidenceRoot) return undefined;
  return safeReadJson(join(evidenceRoot, ".cmux", "evidence.json"));
}

function readCurrentIntention(root?: string): Intention {
  const workspace = readWorkspaceJson(root);
  if (!workspace) return emptyIntention();
  const raw = workspace.intention;
  if (!raw || typeof raw !== "object") return emptyIntention();
  return raw as unknown as Intention;
}

function isWorkspaceValid(root?: string): boolean {
  const evidenceRoot = root ?? findEvidenceRoot();
  if (!evidenceRoot) return false;
  return existsSync(join(evidenceRoot, ".cmux", "workspace.json"));
}

// ── State ────────────────────────────────────────────────────────────

let sessionStartTipShown = false;

// ── Interview protocol (read from file on first call) ────────────────

let cachedProtocol: string | undefined;

function loadInterviewProtocol(): string {
  if (cachedProtocol) return cachedProtocol;
  const protoPath = join(__dirname, "interview-protocol.md");
  try {
    cachedProtocol = readFileSync(protoPath, "utf8");
  } catch {
    cachedProtocol = `# Analysis Intention Interview Protocol

You are conducting an iterative, cumulative interview to capture the analysis intention.

1. BEFORE ASKING — gather context from .cmux/workspace.json, sources/**/*.sql, and the dynamic context.
2. ASK ONE FOCUSED QUESTION PER TURN (allowFreeform: true).
3. CUMULATIVE — reference prior answers, refine as you go.
4. FIELD ORDER: goal → questions → stakeholders → successCriteria → dashboardOptions → assumptions → openQuestions.
5. STOP CONDITION: goal + ≥1 question + ≥1 stakeholder + ≥1 success criterion. Then call save_intention_draft.
6. NEVER WRITE FILES DIRECTLY — only use the tools provided by this extension.`;
  }
  return cachedProtocol;
}

// ── Render intention summary for the slash command ────────────────────

function renderIntentionSummary(intention: Intention): string {
  const lines: string[] = [];
  const goal = intention.goal?.trim();
  if (goal) lines.push(`  Goal: ${goal}`);

  const sections: Array<[keyof Intention, string]> = [
    ["questions", "Questions"],
    ["stakeholders", "Stakeholders"],
    ["successCriteria", "Success criteria"],
    ["dashboardOptions", "Dashboard direction"],
    ["assumptions", "Assumptions"],
    ["openQuestions", "Open questions"],
  ];

  for (const [key, label] of sections) {
    const values = (intention[key] ?? []) as string[];
    const strings = values.map(String).filter(Boolean);
    if (strings.length) {
      lines.push(`  ${label}:`);
      for (const s of strings) lines.push(`    - ${s}`);
    }
  }

  const clarifications = intention.clarifications ?? [];
  if (clarifications.length) {
    lines.push(`  Clarifications:`);
    for (const c of clarifications) {
      const q = c.question?.trim() ?? "";
      const a = c.answer?.trim() ?? "";
      if (q && a) lines.push(`    - ${q} — ${a}`);
      else if (q) lines.push(`    - ${q}`);
    }
  }

  return lines.length ? lines.join("\n") : "  (empty)";
}

// ── Extension entry point ─────────────────────────────────────────────

export default function analysisIntentionExtension(pi: ExtensionAPI) {

  // ── Tool: start_analysis_intention ────────────────────────────────
  // Returns the interview protocol so the LLM knows how to drive the flow.

  pi.registerTool({
    name: "start_analysis_intention",
    label: "Start Analysis Intention",
    description:
      "Start the analysis intention interview for this workspace. Returns the interview protocol and current intention state. Call this first, then drive the interview using ask_user, and finish by calling save_intention_draft.",
    promptSnippet:
      "Starts the analysis-intention interview and returns the protocol + current intention state. The interview is creative: before asking, read the source catalog AND profile the registered data tables (using duckdb_describe_table/duckdb_summarize_table) to understand date ranges, row counts, and service types. Surface any data limitations to the user immediately. Suggest 3-4 concrete options per field. Use ask_user with allowMultiple:true for multi-select fields (questions, stakeholders, successCriteria, dashboardOptions, assumptions, openQuestions). After core fields, do a final-suggestions step: review the brief and suggest 2-3 additional angles the user might have missed. Then call save_intention_draft.",
    promptGuidelines: [
      "Use start_analysis_intention to begin capturing the analysis brief for a new or existing workspace.",
      "Before asking, read sources/**/*.sql and .cmux/workspace.json to build context. Suggest 3-4 concrete options per field based on the data, never ask blank open-ended questions.",
      "Use ask_user with allowMultiple:true for multi-select fields: questions, stakeholders, successCriteria, dashboardOptions, assumptions, openQuestions. Use allowMultiple:false (default) for the single goal.",
      "After capturing all core fields, do a final-suggestions step: review the brief and ask the user if they want to add 2-3 additional angles you spotted from the data.",
      "When the brief is complete (including final suggestions), call save_intention_draft with the full Intention object.",
      "Do not edit .cmux/workspace.json, pages/analysis/<slug>.md, or .cmux/registry.json by hand.",
    ],
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      if (!isWorkspaceValid()) {
        return {
          content: [{
            type: "text" as const,
            text: "You are not in an Evidence workspace worktree. Run `cmux-evidence new \"title\"` to create one first, or `cmux-evidence open <slug>` to jump to an existing workspace.",
          }],
        };
      }

      const currentIntention = readCurrentIntention();
      const protocol = loadInterviewProtocol();
      const status = isEmptyIntention(currentIntention)
        ? "No intention captured yet. Start the interview from scratch."
        : "Existing intention found. The user wants to refine or replace it. Current state:\n" +
          renderIntentionSummary(currentIntention);

      return {
        content: [{
          type: "text" as const,
          text: `${status}\n\n${protocol}`,
        }],
      };
    },
  });

  // ── Tool: save_intention_draft ────────────────────────────────────
  // Takes the full Intention object, persists it, re-renders the page,
  // updates the registry.

  pi.registerTool({
    name: "save_intention_draft",
    label: "Save Intention Draft",
    description:
      "Save the complete analysis intention for this workspace. Writes to .cmux/workspace.json, re-renders the page, and updates the registry. Call this AFTER the final-suggestions step, when the user has confirmed the brief is complete.",
    promptSnippet:
      "Persists the complete Intention, re-renders the workspace page, and updates the registry.",
    promptGuidelines: [
      "Call save_intention_draft with the full Intention object AFTER the final-suggestions step (when the user has confirmed the brief is complete).",
      "The intention object must include: goal, questions, stakeholders, successCriteria, dashboardOptions, assumptions, clarifications, openQuestions.",
      "Include dataRequirements if you profiled the data during intake — capture what time period, service types, row count, and source the analysis expects.",
      "After saving, the page will be re-rendered and the registry updated automatically.",
      "Do not attempt to write files directly — use this tool.",
    ],
    parameters: Type.Object({
      goal: Type.String({ description: "The main goal of this analysis" }),
      questions: Type.Array(Type.String(), { description: "Questions the dashboard should answer" }),
      stakeholders: Type.Array(Type.String(), { description: "Stakeholders or audience" }),
      successCriteria: Type.Array(Type.String(), { description: "What would make this analysis successful" }),
      dashboardOptions: Type.Array(Type.String(), { description: "Proposed dashboard directions or options" }),
      assumptions: Type.Array(Type.String(), { description: "Assumptions to record" }),
      clarifications: Type.Array(
        Type.Object({
          question: Type.String(),
          answer: Type.String(),
        }),
        { description: "Clarifications captured during interview" },
      ),
      openQuestions: Type.Array(Type.String(), { description: "Open questions to address later" }),
      dataRequirements: Type.Optional(
        Type.Object({
          timePeriod: Type.Optional(Type.String({ description: "Expected time period, e.g. 'Jan-Mar 2024'" })),
          serviceTypes: Type.Optional(Type.Array(Type.String(), { description: "Expected service types, e.g. ['yellow', 'green']" })),
          minimumRows: Type.Optional(Type.Number({ description: "Minimum expected row count" })),
          source: Type.Optional(Type.String({ description: "Expected data source, e.g. 'NYC TLC trip data'" })),
          notes: Type.Optional(Type.String({ description: "Additional data context or limitations" })),
        }),
        { description: "Data requirements discovered during intake profiling" },
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!isWorkspaceValid()) {
        return {
          content: [{
            type: "text" as const,
            text: "You are not in an Evidence workspace worktree. Cannot save intention.",
          }],
        };
      }

      const intention = params as unknown as Intention;

      // Validate minimal content
      if (!intention.goal?.trim()) {
        return {
          content: [{
            type: "text" as const,
            text: "Error: intention must have a non-empty goal.",
          }],
          isError: true,
        };
      }

      // Persist: workspace.json + registry.json
      const result = updateIntention(intention);

      // Re-render the page
      const pageContent = renderAnalysisPage(result.title, result.slug, intention);
      writeFileSync(result.pagePath, pageContent, "utf8");

      // ── Auto-scaffold question pages (idempotent) ──
      const pageDir = dirname(result.pagePath);
      const isIndexPage = basename(result.pagePath) === "index.md";
      const questionDir = isIndexPage ? pageDir : join(pageDir, result.slug);
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

      // Offer commit
      let commitMessage = "Intention saved and page re-rendered.";
      if (createdQuestions.length) {
        commitMessage += ` ${createdQuestions.length} question page(s) created.`;
      }
      if (skippedQuestions.length) {
        commitMessage += ` ${skippedQuestions.length} existing page(s) left untouched.`;
      }
      try {
        const { execSync } = require("node:child_process") as typeof import("node:child_process");
        const worktreeDir = findEvidenceRoot();
        if (worktreeDir) {
          const allPaths = [
            `"${result.pagePath}"`,
            `".cmux/workspace.json"`,
            ...createdQuestions.map((p) => `"${p}"`),
          ].join(" ");
          execSync(`git add ${allPaths}`, {
            cwd: worktreeDir,
            stdio: "pipe",
            timeout: 5000,
          });
          execSync(`git commit -m "Capture analysis intention"`, {
            cwd: worktreeDir,
            stdio: "pipe",
            timeout: 5000,
          });
          commitMessage += " Committed.";
        }
      } catch {
        commitMessage += " (git commit skipped — you can commit manually.)";
      }

      return {
        content: [{
          type: "text" as const,
          text: commitMessage,
        }],
      };
    },
  });

  // ── Tool: read_intention_draft ────────────────────────────────────
  // Reads and returns the current intention for inspection.

  pi.registerTool({
    name: "read_intention_draft",
    label: "Read Intention Draft",
    description:
      "Read the current analysis intention for this workspace. Returns the Intention object or an empty state if none has been captured yet.",
    promptSnippet: "Returns the current analysis intention from .cmux/workspace.json.",
    promptGuidelines: [
      "Use read_intention_draft to inspect the current intention before starting or refining an interview.",
    ],
    parameters: Type.Object({}),
    async execute() {
      if (!isWorkspaceValid()) {
        return {
          content: [{
            type: "text" as const,
            text: "No workspace found. You are not in an Evidence workspace worktree.",
          }],
        };
      }

      const intention = readCurrentIntention();
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(intention, null, 2),
        }],
      };
    },
  });

  // ── Slash command: /analysis-intention ────────────────────────────

  pi.registerCommand("analysis-intention", {
    description:
      "Capture or refine the analysis intention for this workspace. Prompts the LLM to drive an iterative interview using ask_user.",
    handler: async (_args, ctx) => {
      if (!isWorkspaceValid()) {
        const msg =
          "You're not in a workspace worktree. Run `cmux-evidence new \"title\"` to create one first, or `cmux-evidence open <slug>` to jump to one.";
        if (ctx.hasUI) {
          ctx.ui.notify(msg, "warning");
        } else {
          console.log(`\n${msg}\n`);
        }
        return;
      }

      const currentIntention = readCurrentIntention();

      if (isEmptyIntention(currentIntention)) {
        // Empty — nudge the LLM to start the interview
        if (ctx.hasUI) {
          ctx.ui.notify("Starting analysis intention interview...", "info");
        }
        pi.sendUserMessage(
          "I'd like to capture the analysis intention for this workspace. " +
          "Please call start_analysis_intention to get the protocol, then drive the interview " +
          "using ask_user (one question at a time, cumulative), and finish by calling save_intention_draft.",
          { deliverAs: "user" },
        );
      } else {
        // Non-empty — show current and offer options
        const summary = renderIntentionSummary(currentIntention);
        const text = `Current analysis intention:\n${summary}\n\nTo refine, call start_analysis_intention and drive a new interview.\nTo replace, call save_intention_draft with a new Intention object.`;
        if (ctx.hasUI) {
          ctx.ui.notify("Intention already captured. See details in the conversation.", "info");
          console.log(`\n${text}\n`);
        } else {
          console.log(`\n${text}\n`);
        }
        pi.sendUserMessage(
          "The user invoked /analysis-intention on a workspace that already has a brief. " +
          "Show the current intention summary and ask if they want to Refine, Replace, or Discard it.",
          { deliverAs: "user" },
        );
      }
    },
  });

  // ── Hook: session_start — muted tip ───────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    if (sessionStartTipShown) return;
    sessionStartTipShown = true;

    if (!isWorkspaceValid()) return;
    const intention = readCurrentIntention();
    if (!isEmptyIntention(intention)) return;

    ctx.ui.notify(
      "No analysis intention captured. Type /analysis-intention to start one.",
      "info",
    );
  });

  // ── Hook: before_agent_start — dynamic context hint ───────────────

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
}
