/**
 * Update the intention field in .cmux/registry.json.
 *
 * Mirrors `upsert_workspace_registry` from `bin/cmux-evidence` — a direct
 * JSON read-modify-write with atomic write (tmp + rename).
 */

import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import type { Intention } from "./intention";

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

function isContentWorkspace(evidenceConfig: JsonObject | undefined, workspace: JsonObject | undefined): boolean {
  if (stringValue(workspace?.kind) === "lumen-analysis-workspace") return true;
  const mode = stringValue(workspace?.workspaceMode) || stringValue(evidenceConfig?.workspaceMode);
  const hasSplitRoots = Boolean(workspace?.workspaceRoot || workspace?.shadowRuntimeRoot || evidenceConfig?.workspaceRoot || evidenceConfig?.shadowRuntimeRoot);
  return mode === "content-only" && hasSplitRoots;
}

function runtimeRootFor(root: string, evidenceConfig: JsonObject | undefined, workspace: JsonObject | undefined): string {
  const configured = stringValue(workspace?.runtimeRoot) || stringValue(evidenceConfig?.runtimeRoot);
  return configured ? resolve(root, configured) : root;
}

/**
 * Find the project root by walking up from cwd looking for .cmux/evidence.json.
 */
function findEvidenceRoot(start = process.cwd()): string | undefined {
  let current = resolve(start);
  while (true) {
    if (existsSync(join(current, ".cmux", "evidence.json"))) return current;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

/**
 * Read the current workspace.json from the evidence root.
 */
export function readCurrentWorkspaceJson(root?: string): JsonObject | undefined {
  const evidenceRoot = root ?? findEvidenceRoot();
  if (!evidenceRoot) return undefined;
  return safeReadJson(join(evidenceRoot, ".cmux", "workspace.json"));
}

/**
 * Update the intention in both .cmux/workspace.json and .cmux/registry.json.
 *
 * @param intention - The complete Intention object to persist
 * @param root - The evidence root (worktree or project root)
 * @returns Object with updated paths for page rendering
 */
export function updateIntention(
  intention: Intention,
  root?: string,
): { pagePath: string; slug: string; title: string } {
  const evidenceRoot = root ?? findEvidenceRoot();
  if (!evidenceRoot) {
    throw new Error("No Evidence workspace found. Run `cmux-evidence new` first.");
  }

  const workspace = safeReadJson(join(evidenceRoot, ".cmux", "workspace.json"));
  if (!workspace) {
    throw new Error("No .cmux/workspace.json found. Are you in an Evidence workspace?");
  }

  const slug = stringValue(workspace.slug) || "unknown";
  const title = stringValue(workspace.title) || slug;
  const page = stringValue(workspace.page) || `pages/analysis/${slug}.md`;
  const projectId = stringValue(workspace.projectId) || "unknown";

  // Update workspace.json
  workspace.intention = intention;
  const workspacePath = join(evidenceRoot, ".cmux", "workspace.json");
  atomicWrite(workspacePath, workspace);

  // Update registry.json
  const evidenceConfig = safeReadJson(join(evidenceRoot, ".cmux", "evidence.json"));
  const configuredRegistry = evidenceConfig
    ? stringValue(evidenceConfig.registryPath)
    : "";
  const registryBaseRoot = isContentWorkspace(evidenceConfig, workspace)
    ? runtimeRootFor(evidenceRoot, evidenceConfig, workspace)
    : evidenceRoot;
  const registryPath = configuredRegistry
    ? resolve(registryBaseRoot, configuredRegistry)
    : join(registryBaseRoot, ".cmux", "registry.json");

  if (existsSync(registryPath)) {
    const registry = safeReadJson(registryPath);
    if (registry) {
      const projects = registry.projects as JsonObject | undefined;
      const project = projects?.[projectId] as JsonObject | undefined;
      const workspaces = project?.workspaces as JsonObject | undefined;
      const ws = workspaces?.[slug] as JsonObject | undefined;
      if (ws) {
        ws.intention = intention;
        atomicWrite(registryPath, registry);
      }
    }
  }

  return {
    pagePath: join(evidenceRoot, page),
    slug,
    title,
  };
}

/**
 * Atomic write: write to a .tmp file, then rename.
 */
function atomicWrite(filePath: string, data: JsonObject): void {
  const dir = dirname(filePath);
  const tmpPath = join(dir, `.tmp-intention-${Date.now()}.json`);
  writeFileSync(tmpPath, JSON.stringify(data, null, 2) + "\n");
  renameSync(tmpPath, filePath);
}
