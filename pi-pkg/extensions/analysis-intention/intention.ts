/**
 * Analysis intention types and helpers.
 *
 * The Intention shape is preserved from the CLI's `collect_analysis_intention`
 * in `bin/cmux-evidence` so existing worktrees remain compatible.
 */

export interface Clarification {
  question: string;
  answer: string;
}

export interface DataRequirements {
  timePeriod?: string;       // e.g., "Jan-Mar 2024", "Q1 2024"
  serviceTypes?: string[];   // e.g., ["yellow", "green"]
  minimumRows?: number;      // e.g., 100000
  source?: string;           // e.g., "NYC TLC trip data"
  notes?: string;            // any additional data context
}

export interface Intention {
  goal: string;
  questions: string[];
  stakeholders: string[];
  successCriteria: string[];
  dashboardOptions: string[];
  assumptions: string[];
  clarifications: Clarification[];
  openQuestions: string[];
  dataRequirements?: DataRequirements;
}

export function emptyIntention(): Intention {
  return {
    goal: "",
    questions: [],
    stakeholders: [],
    successCriteria: [],
    dashboardOptions: [],
    assumptions: [],
    clarifications: [],
    openQuestions: [],
  };
}

export function isEmptyIntention(value: unknown): boolean {
  if (!value || typeof value !== "object") return true;
  const obj = value as Record<string, unknown>;
  if (typeof obj.goal === "string" && obj.goal.trim()) return false;
  if (Array.isArray(obj.questions) && obj.questions.length > 0) return false;
  return true;
}

/**
 * Render the intention as a bullet-list string for the dynamic context injection.
 * Mirrors `render_intention_context` in `bin/cmux-evidence`.
 */
export function renderIntentionBullets(intention: Intention): string[] {
  const lines: string[] = [];
  const goal = intention.goal?.trim();
  if (goal) lines.push(`- Goal: ${goal}`);

  const sections: Array<[keyof Intention, string]> = [
    ["questions", "Questions"],
    ["dashboardOptions", "Evidence dashboard direction"],
    ["successCriteria", "Success criteria"],
    ["assumptions", "Assumptions"],
    ["openQuestions", "Open questions"],
  ];

  for (const [key, label] of sections) {
    const values = (intention[key] ?? []) as string[];
    const strings = values.map(String).filter(Boolean);
    if (strings.length) lines.push(`- ${label}: ${strings.join("; ")}`);
  }

  const clarifications = intention.clarifications ?? [];
  if (clarifications.length) {
    const rendered = clarifications
      .map((c) => {
        const q = c.question?.trim() ?? "";
        const a = c.answer?.trim() ?? "";
        if (q && a) return `${q} — ${a}`;
        return q || a;
      })
      .filter(Boolean);
    if (rendered.length) lines.push(`- Clarifications: ${rendered.join("; ")}`);
  }

  const dr = intention.dataRequirements;
  if (dr) {
    const parts: string[] = [];
    if (dr.timePeriod) parts.push(`time period: ${dr.timePeriod}`);
    if (dr.serviceTypes?.length) parts.push(`service types: ${dr.serviceTypes.join(", ")}`);
    if (dr.minimumRows) parts.push(`minimum rows: ${dr.minimumRows.toLocaleString()}`);
    if (dr.source) parts.push(`source: ${dr.source}`);
    if (dr.notes) parts.push(`notes: ${dr.notes}`);
    if (parts.length) lines.push(`- Data requirements: ${parts.join("; ")}`);
  }

  return lines;
}
