// Validates pi-pkg/skills/data-discovery/SKILL.md against the Agent Skills spec
// and checks that every tool name referenced in the skill is actually
// registered by the duckdb-bi extension.
//
// Run with: node --test tests/skill-discovery.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ROOT = path.resolve(EXT_DIR, "..", "..", "..");
const SKILL_PATH = path.join(PROJECT_ROOT, "pi-pkg", "skills", "data-discovery", "SKILL.md");

// All tool names the duckdb-bi extension actually registers.
const REAL_TOOL_NAMES = new Set([
  "duckdb_run_sql",
  "duckdb_list_tables",
  "duckdb_describe_table",
  "duckdb_sample_rows",
  "duckdb_summarize_table",
  "duckdb_quality_report",
  "duckdb_export_query",
  "duckdb_data_sources",
  "duckdb_make_report",
  "duckdb_query_audit_log",
  "duckdb_join_coverage",
  "duckdb_validate_evidence_sql",
]);

function parseFrontmatter(text) {
  // Match `---\n...\n---\n` at the start of the file.
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return null;
  const fm = m[1];
  const body = m[2];
  const fields = {};
  for (const line of fm.split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return { fields, body };
}

test("skill file exists at pi-pkg/skills/data-discovery/SKILL.md", async () => {
  const text = await readFile(SKILL_PATH, "utf-8");
  assert.ok(text.length > 0, "skill file is empty");
});

test("frontmatter parses as --- ... --- block at the start of the file", async () => {
  const text = await readFile(SKILL_PATH, "utf-8");
  const parsed = parseFrontmatter(text);
  assert.ok(parsed, "frontmatter not found or malformed");
});

test("name field is valid: lowercase a-z, 0-9, hyphens, 1-64 chars, no leading/trailing/consecutive hyphens", async () => {
  const text = await readFile(SKILL_PATH, "utf-8");
  const { fields } = parseFrontmatter(text);
  const name = fields.name;
  assert.ok(name, "name is required");
  assert.match(name, /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/, "name format invalid");
  assert.ok(!name.includes("--"), "name has consecutive hyphens");
  assert.ok(name.length <= 64, `name too long (${name.length})`);
  assert.equal(name, "data-discovery");
});

test("description field is present, <= 1024 chars, and is specific enough to auto-load", async () => {
  const text = await readFile(SKILL_PATH, "utf-8");
  const { fields } = parseFrontmatter(text);
  const desc = fields.description;
  assert.ok(desc, "description is required");
  assert.ok(desc.length <= 1024, `description too long (${desc.length} chars)`);
  // Specificity heuristics per the Agent Skills spec and the pi docs:
  //   - mentions at least one concrete action (verb)
  //   - mentions a domain (DuckDB BI / project data)
  //   - has trigger conditions (verbs the user might say)
  assert.match(desc, /\b(discover|explore|understand|explain|describe|audit|profile)\b/i,
    "description should mention trigger verbs");
  assert.match(desc, /duckdb|csv|parquet|json|data/i, "description should mention the data domain");
});

test("body covers the 7-step workflow (orient → shape → identify → quality → join coverage → narrative → persist)", async () => {
  const text = await readFile(SKILL_PATH, "utf-8");
  const { body } = parseFrontmatter(text);
  const sections = {
    orient: /###\s*1\..*Orient/i.test(body),
    shape: /###\s*2\..*Shape/i.test(body),
    identify: /###\s*3\..*Identify|table kind/i.test(body),
    quality: /###\s*4\..*Quality/i.test(body),
    joinCoverage: /###\s*5\..*[Jj]oin [Cc]overage/i.test(body),
    narrative: /###\s*6\..*[Nn]arrative/i.test(body),
    persist: /###\s*7\..*[Pp]ersist/i.test(body),
  };
  for (const [k, ok] of Object.entries(sections)) {
    assert.ok(ok, `missing 7-step workflow section: ${k}`);
  }
});

test("body includes the style rules (story not stats, cite query_id, ask 2-3 follow-ups)", async () => {
  const text = await readFile(SKILL_PATH, "utf-8");
  const { body } = parseFrontmatter(text);
  assert.match(body, /story.{0,20}stats|lead with a one-line summary|narrative/i);
  assert.match(body, /query_id/i);
  assert.match(body, /follow-?up questions?/i);
});

test("body includes a ## Reference queries section with copy-paste SQL", async () => {
  const text = await readFile(SKILL_PATH, "utf-8");
  const { body } = parseFrontmatter(text);
  assert.match(body, /##\s*Reference queries/i);
  // Count ```sql fenced code blocks; there should be at least 1.
  const sqlBlocks = (body.match(/```sql\b/g) ?? []).length;
  assert.ok(sqlBlocks >= 1, `expected at least 1 \`\`\`sql block, got ${sqlBlocks}`);
});

test("every duckdb_* tool name referenced in the body is actually registered", async () => {
  const text = await readFile(SKILL_PATH, "utf-8");
  const { body } = parseFrontmatter(text);
  // Match `duckdb_snake_case` tokens; ignore ones inside fenced code that are obvious SQL (none expected).
  const referenced = new Set();
  for (const m of body.matchAll(/\bduckdb_[a-z][a-z0-9_]*\b/g)) {
    referenced.add(m[0]);
  }
  assert.ok(referenced.size > 0, "no duckdb_* tool names referenced");
  for (const name of referenced) {
    assert.ok(REAL_TOOL_NAMES.has(name),
      `skill references unregistered tool: ${name} (registered: ${[...REAL_TOOL_NAMES].join(", ")})`);
  }
});

test("the duckdb-bi extension's tool prompts still recommend the same workflow steps the skill describes", async () => {
  // Sanity check: the tool's promptGuidelines and the skill should agree on the
  // "run summarize first, then join_coverage" sequence. If a tool's guideline
  // contradicts the skill, the skill is the one that should change — but this
  // test guards against the two drifting apart silently.
  const summarizePath = path.join(EXT_DIR, "src", "tools", "summarize-table.ts");
  const summarizeText = await readFile(summarizePath, "utf-8");
  assert.match(summarizeText, /duckdb_join_coverage/,
    "summarize-table promptGuidelines should mention duckdb_join_coverage");

  const skillText = await readFile(SKILL_PATH, "utf-8");
  assert.match(skillText, /duckdb_summarize_table/);
  assert.match(skillText, /duckdb_join_coverage/);
});

test("skill is discoverable at pi-pkg/skills/data-discovery/SKILL.md (no other file structure required)", async () => {
  const dirEntries = await readdir(path.join(PROJECT_ROOT, "pi-pkg", "skills", "data-discovery"));
  assert.ok(dirEntries.includes("SKILL.md"), "SKILL.md not present in skill directory");
});
