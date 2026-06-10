import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { DynamicBorder, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Box, Container, type SelectItem, SelectList, Text, truncateToWidth } from "@earendil-works/pi-tui";

type JsonObject = Record<string, unknown>;

type SourceQuerySummary = {
	source: string;
	name: string;
	file: string;
	columns: string[];
	timeFields: string[];
	measures: string[];
	dimensions: string[];
	sqlPreview: string;
};

type WorkspaceListItem = {
	slug: string;
	title: string;
	status: string;
	branch: string;
	url: string;
	updatedAt: string;
	path: string;
	current: boolean;
};

const MAX_SQL_PREVIEW_CHARS = 700;
const MAX_CONTEXT_CHARS = 12000;
const MAX_PROFILE_CHARS = 5000;
const WORKSPACE_REPORT_MESSAGE_TYPE = "evidence-workspace-report";

function safeReadText(path: string, maxChars = 20000): string | undefined {
	try {
		if (!existsSync(path) || !statSync(path).isFile()) return undefined;
		const text = readFileSync(path, "utf8");
		return text.length > maxChars ? `${text.slice(0, maxChars).trimEnd()}\n...` : text;
	} catch {
		return undefined;
	}
}

function safeReadJson(path: string): JsonObject | undefined {
	const text = safeReadText(path, 200000);
	if (!text) return undefined;
	try {
		const parsed = JSON.parse(text);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as JsonObject) : undefined;
	} catch {
		return undefined;
	}
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

function stringValue(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.map((item) => String(item).trim()).filter(Boolean);
}

function compactSql(sql: string, maxChars = MAX_SQL_PREVIEW_CHARS): string {
	const withoutComments = sql
		.replace(/\/\*[\s\S]*?\*\//g, " ")
		.replace(/--.*$/gm, " ");
	const compacted = withoutComments.replace(/\s+/g, " ").trim();
	return compacted.length > maxChars ? `${compacted.slice(0, maxChars).trimEnd()}...` : compacted;
}

function unique(values: string[], maxItems = 18): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const raw of values) {
		const value = raw.trim().replace(/^"|"$/g, "");
		const key = value.toLowerCase();
		if (!value || seen.has(key)) continue;
		if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) continue;
		seen.add(key);
		result.push(value);
		if (result.length >= maxItems) break;
	}
	return result;
}

function inferColumns(sql: string): string[] {
	const aliases = Array.from(sql.matchAll(/\bas\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/gi)).map((match) => match[1]);
	const finalSelect = sql.match(/select\s+([\s\S]*?)\s+from\s+/i)?.[1] ?? "";
	const simpleSelectColumns = finalSelect
		.split(/,(?![^()]*\))/)
		.map((part) => part.trim())
		.map((part) => {
			const alias = part.match(/\bas\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/i)?.[1];
			if (alias) return alias;
			const simple = part.match(/(?:^|\.)([a-zA-Z_][a-zA-Z0-9_]*)$/)?.[1];
			return simple ?? "";
		});
	return unique([...aliases, ...simpleSelectColumns]);
}

function classifyColumns(columns: string[]) {
	const timeRe = /(date|time|timestamp|_ts$|month|week|year|quarter|hour|day|created|updated)/i;
	const measureRe = /(count|amount|revenue|sales|cost|price|total|value|volume|quantity|qty|rate|ratio|percent|pct|avg|average|sum|median|distance|duration|minutes|seconds|score|margin|profit|tip|fare)/i;
	const idOnlyRe = /(^id$|_id$|id$)/i;
	const timeFields = columns.filter((column) => timeRe.test(column));
	const measures = columns.filter((column) => measureRe.test(column) && !timeFields.includes(column));
	const dimensions = columns.filter(
		(column) => !timeFields.includes(column) && !measures.includes(column) && !idOnlyRe.test(column),
	);
	return { timeFields, measures, dimensions };
}

function buildSourceCatalog(root: string): SourceQuerySummary[] {
	const sourcesDir = join(root, "sources");
	if (!existsSync(sourcesDir) || !statSync(sourcesDir).isDirectory()) return [];

	const summaries: SourceQuerySummary[] = [];
	for (const sourceName of readdirSync(sourcesDir).sort()) {
		const sourceDir = join(sourcesDir, sourceName);
		if (!statSync(sourceDir).isDirectory()) continue;
		for (const fileName of readdirSync(sourceDir).sort()) {
			if (!fileName.endsWith(".sql")) continue;
			const filePath = join(sourceDir, fileName);
			const sql = safeReadText(filePath, 50000) ?? "";
			const columns = inferColumns(sql);
			const classified = classifyColumns(columns);
			summaries.push({
				source: sourceName,
				name: fileName.replace(/\.sql$/i, ""),
				file: `sources/${sourceName}/${fileName}`,
				columns,
				...classified,
				sqlPreview: compactSql(sql),
			});
		}
	}
	return summaries;
}

function inferEvidenceDatasourcePlugins(root: string): string[] {
	const config = safeReadText(join(root, "evidence.config.yaml"), 50000);
	if (!config) return [];
	const datasourceSection = config.match(/datasources:\s*([\s\S]*?)(?:\n\S|$)/i)?.[1] ?? config;
	return unique(Array.from(datasourceSection.matchAll(/["'](@evidence-dev\/[^"']+)["']/g)).map((match) => match[1]), 12);
}

function renderList(values: string[], fallback = "not inferred"): string {
	return values.length ? values.join(", ") : fallback;
}

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

function safeExec(command: string, args: string[], cwd: string): string | undefined {
	try {
		return execFileSync(command, args, {
			cwd,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
			timeout: 5000,
		}).trim();
	} catch {
		return undefined;
	}
}

function currentGitBranch(root: string): string {
	return safeExec("git", ["branch", "--show-current"], root) || "not detected";
}

function gitStatusLines(root: string): string[] {
	const output = safeExec("git", ["status", "--short"], root);
	if (output === undefined) return ["- Git status: not available"];
	if (!output) return ["- Git status: clean"];

	const lines = output.split("\n").filter(Boolean);
	const maxShown = 12;
	const rendered = [`- Git status: ${lines.length} changed file${lines.length === 1 ? "" : "s"}`];
	for (const line of lines.slice(0, maxShown)) {
		rendered.push(`  - ${line}`);
	}
	if (lines.length > maxShown) rendered.push(`  - ... ${lines.length - maxShown} more`);
	return rendered;
}

function formatDate(value: unknown): string {
	const text = stringValue(value);
	if (!text) return "not recorded";
	const date = new Date(text);
	if (Number.isNaN(date.getTime())) return text;
	return date.toISOString().slice(0, 10);
}

function isContentWorkspace(evidenceConfig: JsonObject | undefined, workspace?: JsonObject | undefined): boolean {
	if (stringValue(workspace?.kind) === "lumen-analysis-workspace") return true;
	const mode = stringValue(workspace?.workspaceMode) || stringValue(evidenceConfig?.workspaceMode);
	const hasSplitRoots = Boolean(workspace?.workspaceRoot || workspace?.shadowRuntimeRoot || evidenceConfig?.workspaceRoot || evidenceConfig?.shadowRuntimeRoot);
	return mode === "content-only" && hasSplitRoots;
}

function runtimeRootFor(root: string, evidenceConfig: JsonObject | undefined, workspace?: JsonObject | undefined): string {
	const configured = stringValue(workspace?.runtimeRoot) || stringValue(evidenceConfig?.runtimeRoot);
	if (configured) return isAbsolute(configured) ? configured : resolve(root, configured);
	return root;
}

function registryPathFor(root: string, evidenceConfig: JsonObject | undefined, workspace?: JsonObject | undefined): string {
	const configured = stringValue(evidenceConfig?.registryPath) || join(".cmux", "registry.json");
	if (isAbsolute(configured)) return configured;
	const baseRoot = isContentWorkspace(evidenceConfig, workspace) ? runtimeRootFor(root, evidenceConfig, workspace) : root;
	return join(baseRoot, configured);
}

function projectIdFor(root: string, evidenceConfig: JsonObject | undefined): string {
	return stringValue(evidenceConfig?.projectId) || basename(root);
}

function workspaceItems(root = findEvidenceRoot()): { items: WorkspaceListItem[]; projectId: string; registryPath: string } {
	if (!root) throw new Error("No Evidence CMUX workspace found from the current directory.");
	const evidenceConfig = safeReadJson(join(root, ".cmux", "evidence.json"));
	const currentWorkspace = safeReadJson(join(root, ".cmux", "workspace.json"));
	const currentSlug = stringValue(currentWorkspace?.slug);
	const currentPath = resolve(root);
	const projectId = projectIdFor(root, evidenceConfig);
	const registryPath = registryPathFor(root, evidenceConfig, currentWorkspace);
	const registry = safeReadJson(registryPath);
	const projects = registry?.projects;
	const project = projects && typeof projects === "object" && !Array.isArray(projects) ? (projects as JsonObject)[projectId] : undefined;
	const workspaces = project && typeof project === "object" && !Array.isArray(project) ? (project as JsonObject).workspaces : undefined;
	if (!workspaces || typeof workspaces !== "object" || Array.isArray(workspaces)) {
		return { items: [], projectId, registryPath };
	}

	const items = Object.entries(workspaces as JsonObject).map(([slug, raw]) => {
		const row = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as JsonObject) : {};
		const path = stringValue(row.path);
		const resolvedPath = path ? resolve(path) : "";
		return {
			slug: stringValue(row.slug) || slug,
			title: stringValue(row.title) || stringValue(row.slug) || slug,
			status: stringValue(row.status) || "unknown",
			branch: stringValue(row.branch),
			url: stringValue(row.url),
			updatedAt: stringValue(row.updatedAt),
			path,
			current: Boolean((currentSlug && (stringValue(row.slug) || slug) === currentSlug) || (resolvedPath && resolvedPath === currentPath)),
		};
	});

	items.sort((a, b) => {
		if (a.current !== b.current) return a.current ? -1 : 1;
		return (b.updatedAt || "").localeCompare(a.updatedAt || "") || a.title.localeCompare(b.title);
	});
	return { items, projectId, registryPath };
}

function renderWorkspaceListText(root = findEvidenceRoot()): string {
	const { items, projectId, registryPath } = workspaceItems(root);
	const lines = ["# Evidence Analysis Workspaces", "", `Project: ${projectId}`, `Registry: ${registryPath}`, ""];
	if (!items.length) {
		lines.push("No analysis workspaces found.");
		return lines.join("\n");
	}
	for (const [index, item] of items.entries()) {
		lines.push(`${index + 1}. ${item.title}${item.current ? " (current)" : ""}`);
		lines.push(`   Slug: ${item.slug}`);
		lines.push(`   Status: ${item.status}`);
		if (item.branch) lines.push(`   Branch: ${item.branch}`);
		if (item.url) lines.push(`   URL: ${item.url}`);
		if (item.updatedAt) lines.push(`   Updated: ${formatDate(item.updatedAt)}`);
		lines.push("");
	}
	return lines.join("\n").trimEnd();
}

function projectRootForCommand(root: string, evidenceConfig: JsonObject | undefined, workspace?: JsonObject | undefined): string {
	const runtimeRoot = runtimeRootFor(root, evidenceConfig, workspace);
	if (existsSync(join(runtimeRoot, "bin", "cmux-evidence"))) return runtimeRoot;
	const workspaceDir = stringValue(evidenceConfig?.workspaceDir);
	if (workspaceDir) {
		const resolvedWorkspaceDir = isAbsolute(workspaceDir) ? workspaceDir : join(root, workspaceDir);
		if (basename(resolvedWorkspaceDir) === ".workspaces") return dirname(resolvedWorkspaceDir);
	}
	if (existsSync(join(root, "bin", "cmux-evidence"))) return root;
	const parent = dirname(root);
	if (existsSync(join(parent, "bin", "cmux-evidence"))) return parent;
	return root;
}

function openWorkspaceBySlug(root: string, slug: string): void {
	const evidenceConfig = safeReadJson(join(root, ".cmux", "evidence.json"));
	const workspace = safeReadJson(join(root, ".cmux", "workspace.json"));
	const commandRoot = projectRootForCommand(root, evidenceConfig, workspace);
	const script = join(commandRoot, "bin", "cmux-evidence");
	const command = existsSync(script) ? script : "cmux-evidence";
	execFileSync(command, ["open", slug], {
		cwd: commandRoot,
		stdio: "inherit",
		timeout: 30000,
	});
}

function dashboardStateEntries(root: string, page: string): Array<[string, string]> {
	if (!page) return [["Page", "not recorded"]];
	const pagePath = join(root, page);
	const pageText = safeReadText(pagePath, 120000) || "";
	const entries: Array<[string, string]> = [];

	// Brief page
	if (!pageText) {
		entries.push(["Brief page", `${page} (missing)`]);
	} else {
		entries.push(["Brief page", `${page} ✓`]);
		entries.push(["Brief", /##\s+Workspace Brief/i.test(pageText) ? "yes" : "no"]);
		entries.push(["Checklist", /##\s+Build Checklist/i.test(pageText) || /- \[[ xX]\]/.test(pageText) ? "yes" : "no"]);
		entries.push(["Workspace map", /##\s+Workspace Pages/i.test(pageText) ? "yes" : "no"]);
	}

	// Draft page
	const draftPage = page.replace(/index\.md$/, "draft.md");
	const draftPath = join(root, draftPage);
	const draftText = safeReadText(draftPath, 120000) || "";
	if (!draftText) {
		entries.push(["Draft page", `${draftPage} (missing)`]);
	} else {
		entries.push(["Draft page", `${draftPage} ✓`]);
		entries.push(["Starter query", /```sql\s+draft_query[\s\S]*?select\s+1\s+as\s+example_metric/i.test(draftText) ? "still present" : "replaced"]);
		entries.push(["KPI cards", /<BigValue\b/i.test(draftText) ? "yes" : "no"]);
		entries.push(["Charts", /<(LineChart|BarChart|AreaChart|ScatterPlot|BubbleChart)\b/i.test(draftText) ? "yes" : "no"]);
		entries.push(["Tables", /<DataTable\b/i.test(draftText) ? "yes" : "no"]);
		entries.push(["Inputs", /<(Dropdown|Checkbox|ButtonGroup|Slider|TextInput|DateInput|DateRange)\b/i.test(draftText) ? "yes" : "no"]);
	}

	// Report page
	const reportPage = page.replace(/index\.md$/, "report.md");
	const reportPath = join(root, reportPage);
	if (existsSync(reportPath)) {
		entries.push(["Report page", `${reportPage} ✓`]);
	} else {
		entries.push(["Report page", "not created"]);
	}

	return entries;
}

function detectDashboardState(root: string, page: string): string[] {
	return dashboardStateEntries(root, page).map(([label, value]) => `${label.padEnd(16)} ${value}`);
}

function formatKeyValue(label: string, value: unknown, width = 14): string {
	return `${label.padEnd(width)} ${String(value ?? "")}`;
}

function formatReportList(items: string[], limit: number): string[] {
	if (!items.length) return ["none"];
	const shown = items.slice(0, limit);
	const lines = shown.map((item) => `  ${item}`);
	if (items.length > limit) lines.push(`  … ${items.length - limit} more`);
	return lines;
}

function renderWorkspaceSummary(root = findEvidenceRoot(), options: { full?: boolean } = {}): string {
	if (!root) return "No Evidence CMUX workspace found from the current directory.";

	const evidenceConfig = safeReadJson(join(root, ".cmux", "evidence.json"));
	const workspace = safeReadJson(join(root, ".cmux", "workspace.json"));
	const title = stringValue(workspace?.title) || basename(root);
	const page = stringValue(workspace?.page);
	const url = stringValue(workspace?.url) || stringValue(evidenceConfig?.url);
	const intention = workspace?.intention && typeof workspace.intention === "object" && !Array.isArray(workspace.intention)
		? (workspace.intention as JsonObject)
		: undefined;

	const goal = stringValue(intention?.goal) || "Not specified yet.";
	const questions = stringArray(intention?.questions);
	const successCriteria = stringArray(intention?.successCriteria);
	const dashboardOptions = stringArray(intention?.dashboardOptions);
	const openQuestions = stringArray(intention?.openQuestions);
	const questionLimit = options.full ? 12 : 4;
	const successLimit = options.full ? 12 : 4;
	const optionLimit = options.full ? 10 : 3;

	const lines = [
		"Workspace Summary",
		"─────────────────",
		title,
		"",
		"Goal",
		goal,
		"",
		"Main questions",
		...(questions.length ? formatReportList(questions, questionLimit) : ["  Not specified yet."]),
	];
	if (!options.full && questions.length > questionLimit) lines.push("  Tip: /workspace-summary --full shows the complete brief.");

	lines.push("", "Dashboard state", ...detectDashboardState(root, page).map((line) => `  ${line}`));
	if (url) lines.push("", formatKeyValue("Preview", url));

	if (successCriteria.length) {
		lines.push("", "Success criteria", ...formatReportList(successCriteria, successLimit));
	}
	if (dashboardOptions.length) {
		lines.push("", "Dashboard direction", ...formatReportList(dashboardOptions, optionLimit));
	}
	if (options.full && openQuestions.length) {
		lines.push("", "Open questions", ...formatReportList(openQuestions, 12));
	}

	lines.push("", "Recommended next step");
	if (!page) {
		lines.push("Create or identify the primary Evidence analysis page for this workspace.");
	} else {
		const draftPage = page.replace(/index\.md$/, "draft.md");
		const draftText = safeReadText(join(root, draftPage), 120000) || "";
		const reportPage = draftPage.replace(/draft\.md$/, "report.md");
		if (!draftText) {
			lines.push("Create the Draft page and start exploring the data.");
		} else if (/```sql\s+draft_query[\s\S]*?select\s+1\s+as\s+example_metric/i.test(draftText)) {
			lines.push("Replace the starter draft query with real metrics mapped to the brief.");
		} else if (!/<(BigValue|LineChart|BarChart|DataTable)\b/i.test(draftText)) {
			lines.push("Add Evidence-native KPI cards, at least one chart, and a supporting table to the Draft page.");
		} else if (!existsSync(join(root, reportPage))) {
			lines.push("Move validated findings from Draft to the Report page.");
		} else {
			lines.push("Review the rendered preview, fix visible issues, then update the build checklist and remaining questions.");
		}
	}
	return lines.join("\n");
}

function renderWorkspaceCleanupPlan(root = findEvidenceRoot()): string {
	if (!root) return "No Evidence CMUX workspace found from the current directory.";

	const evidenceConfig = safeReadJson(join(root, ".cmux", "evidence.json"));
	const workspace = safeReadJson(join(root, ".cmux", "workspace.json"));
	const title = stringValue(workspace?.title) || basename(root);
	const slug = stringValue(workspace?.slug) || basename(root);
	const status = stringValue(workspace?.status) || (workspace ? "unknown" : "project");
	const branch = stringValue(workspace?.branch) || currentGitBranch(root);
	const page = stringValue(workspace?.page);
	const url = stringValue(workspace?.url) || stringValue(evidenceConfig?.url);
	const registryPath = registryPathFor(root, evidenceConfig, workspace);
	const contentMode = isContentWorkspace(evidenceConfig, workspace);
	const runtimeRoot = runtimeRootFor(root, evidenceConfig, workspace);
	const shadowRuntimeRoot = stringValue(workspace?.shadowRuntimeRoot) || stringValue(evidenceConfig?.shadowRuntimeRoot);
	const gitStatus = safeExec("git", ["status", "--short"], root);
	const changedLines = gitStatus === undefined || !gitStatus ? [] : gitStatus.split("\n").filter(Boolean);
	const upstream = safeExec("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], root);
	const aheadBehind = upstream ? safeExec("git", ["rev-list", "--left-right", "--count", `${upstream}...HEAD`], root) : undefined;
	const hasChanges = changedLines.length > 0;
	const isAnalysisWorkspace = Boolean(workspace?.kind === "evidence-analysis" || page || slug !== basename(root));

	if (contentMode) {
		const lines = [
			"# Workspace Cleanup Plan",
			"",
			"This is a read-only safety review. It does not archive, delete, switch, or mutate any workspace.",
			"",
			"## Current content workspace",
			"",
			`- Title: ${title}`,
			`- Slug: ${slug}`,
			`- Status: ${status}`,
			`- Workspace root: ${root}`,
			`- Runtime root: ${runtimeRoot} (runtime-managed)`,
			`- Shadow runtime: ${shadowRuntimeRoot || "not recorded"} (generated; safe to regenerate)`,
			`- Registry: ${registryPath}`,
		];
		if (page) lines.push(`- Primary page: ${page} (${existsSync(join(root, page)) ? "exists" : "missing"})`);
		if (url) lines.push(`- Preview URL: ${url}`);
		lines.push(
			"",
			"## Risk checks",
			"",
			"- Git checkout: no; this is a content-only analysis workspace.",
			`- Content files present: ${existsSync(join(root, "pages")) ? "pages/ exists" : "pages/ missing"}`,
			`- Shadow runtime present: ${shadowRuntimeRoot && existsSync(shadowRuntimeRoot) ? "yes" : "no or not recorded"}`,
			"",
			"## Safe options",
			"",
			"1. Keep it active",
			"   - Best when the analysis is still useful or actively being edited.",
			"2. Archive it in metadata",
			"   - Recommended first cleanup step for everyday users.",
			"3. Export or preserve useful pages/reports/data, then archive",
			"   - Recommended before deleting any content workspace.",
			"4. Delete only the generated shadow runtime",
			"   - Usually safe; `cmux-evidence open`/`validate` can regenerate it for content-only workspaces.",
			"5. Delete the content workspace",
			"   - Destructive. Only safe after confirming pages, reports, data, and DuckDB artifacts are disposable or exported.",
			"",
			"## Recommendation",
			"",
			status === "archived"
				? "This workspace is already archived. If disk cleanup is needed, delete the generated shadow runtime first and preserve content until explicitly reviewed."
				: "Archive first rather than deleting. Treat the shadow runtime as disposable and the content workspace as the valuable deliverable.",
		);
		return lines.join("\n");
	}

	const lines = [
		"# Workspace Cleanup Plan",
		"",
		"This is a read-only safety review. It does not archive, delete, switch, or mutate any workspace.",
		"",
		"## Current workspace",
		"",
		`- Title: ${title}`,
		`- Slug: ${slug}`,
		`- Status: ${status}`,
		`- Branch: ${branch}`,
		`- Path: ${root}`,
		`- Registry: ${registryPath}`,
	];
	if (page) lines.push(`- Primary page: ${page} (${existsSync(join(root, page)) ? "exists" : "missing"})`);
	if (url) lines.push(`- Preview URL: ${url}`);
	lines.push("", "## Risk checks", "");
	lines.push(`- Looks like generated analysis workspace: ${isAnalysisWorkspace ? "yes" : "not sure"}`);
	lines.push(`- Uncommitted Git changes: ${hasChanges ? `${changedLines.length} changed file${changedLines.length === 1 ? "" : "s"}` : "none detected"}`);
	for (const line of changedLines.slice(0, 12)) lines.push(`  - ${line}`);
	if (changedLines.length > 12) lines.push(`  - ... ${changedLines.length - 12} more`);
	lines.push(`- Upstream branch: ${upstream || "not configured/detected"}`);
	if (aheadBehind) {
		const [behind, ahead] = aheadBehind.split(/\s+/);
		lines.push(`- Ahead/behind upstream: ahead ${ahead || "?"}, behind ${behind || "?"}`);
	}
	lines.push("", "## Safe options", "");
	lines.push("1. Keep it active");
	lines.push("   - Best when the dashboard is still useful or actively being edited.");
	lines.push("2. Archive it in metadata");
	lines.push("   - Recommended first cleanup step for everyday users.");
	lines.push("   - Hides/de-prioritizes it without deleting the worktree or branch.");
	lines.push("3. Commit or export useful changes, then archive");
	lines.push("   - Recommended if there are uncommitted changes you may want later.");
	lines.push("4. Delete the worktree only");
	lines.push("   - Advanced/destructive. Keeps the branch but removes the local checkout.");
	lines.push("5. Delete the worktree and branch");
	lines.push("   - Most destructive. Only safe after confirming changes are disposable or merged.");
	lines.push("", "## Recommendation", "");
	if (!isAnalysisWorkspace) {
		lines.push("Do not clean this up automatically. This does not look clearly like a generated analysis workspace.");
	} else if (hasChanges) {
		lines.push("Do not delete this workspace yet. Review, commit, or discard the uncommitted changes first. If you only want it out of the active list, archive it after review.");
	} else if (status === "archived") {
		lines.push("This workspace is already archived. If disk cleanup is needed later, consider deleting the worktree while preserving the branch.");
	} else {
		lines.push("Archive first rather than deleting. Deletion can be added as a separate explicit command after archive behavior feels right.");
	}
	lines.push("", "## Commands to inspect manually", "", "```bash", "git status --short", "git branch --show-current", "./bin/cmux-evidence list", "```");
	return lines.join("\n");
}

function renderWorkspaceStatus(root = findEvidenceRoot(), options: { debug?: boolean } = {}): string {
	if (!root) return "No Evidence CMUX workspace found from the current directory.";

	const evidenceConfig = safeReadJson(join(root, ".cmux", "evidence.json"));
	const workspace = safeReadJson(join(root, ".cmux", "workspace.json"));
	const title = stringValue(workspace?.title) || basename(root);
	const slug = stringValue(workspace?.slug) || basename(root);
	const branch = stringValue(workspace?.branch) || currentGitBranch(root);
	const page = stringValue(workspace?.page);
	const url = stringValue(workspace?.url) || stringValue(evidenceConfig?.url);
	const status = stringValue(workspace?.status) || (workspace ? "unknown" : "project");
	const port = workspace?.port ?? evidenceConfig?.port;
	const pageExists = page ? existsSync(join(root, page)) : false;
	const workspaceId = process.env.CMUX_WORKSPACE_ID?.trim();
	const surfaceId = process.env.CMUX_SURFACE_ID?.trim();
	const socketAvailable = Boolean(process.env.CMUX_SOCKET_PATH?.trim());
	const gitLines = gitStatusLines(root);

	const lines = [
		"Workspace Status",
		"────────────────",
		`${title}  ·  ${status}`,
		"",
		formatKeyValue("Slug", slug),
		formatKeyValue("Branch", branch),
		formatKeyValue("Path", root),
	];
	if (page) lines.push(formatKeyValue("Page", `${page} ${pageExists ? "✓" : "missing"}`));
	if (url) lines.push(formatKeyValue("Preview", url));
	if (port !== undefined && port !== null && String(port).trim()) lines.push(formatKeyValue("Port", String(port)));
	lines.push(formatKeyValue("Updated", formatDate(workspace?.updatedAt)));
	lines.push("", "Git", ...gitLines.map((line) => `  ${line.replace(/^- /, "")}`));
	lines.push("", "CMUX", `  attached ${workspaceId || surfaceId || socketAvailable ? "✓" : "not detected"}   socket ${socketAvailable ? "✓" : "no"}`);
	if (options.debug) {
		lines.push(
			`  workspace ${workspaceId || "not set"}`,
			`  surface   ${surfaceId || "not set"}`,
		);
	} else {
		lines.push("  Tip: /workspace-status --debug shows CMUX IDs.");
	}
	lines.push("", "Next", "  /workspace-summary    /workspace-cleanup-plan");
	return lines.join("\n");
}

function renderCachedProfile(root: string): string[] {
	const candidates = [
		join(root, ".cmux", "data-context.json"),
		join(root, ".cmux", "data-profile.json"),
	];
	for (const path of candidates) {
		const text = safeReadText(path, MAX_PROFILE_CHARS);
		if (!text) continue;
		return [
			"## Cached lightweight data profile",
			"",
			`Loaded from ${path.replace(`${root}/`, "")}. Treat these stats as helpful hints, not guarantees.`,
			"",
			"```json",
			text.trim(),
			"```",
		];
	}
	return [];
}

function renderCmuxWorkspaceContext(url: string, helperCommand = "./bin/cmux-evidence"): string[] {
	const workspaceId = process.env.CMUX_WORKSPACE_ID?.trim();
	const surfaceId = process.env.CMUX_SURFACE_ID?.trim();
	const socketPath = process.env.CMUX_SOCKET_PATH?.trim();
	const insideCmux = Boolean(workspaceId || surfaceId || socketPath);
	const workspaceFlag = workspaceId ? `--workspace "${workspaceId}"` : "--workspace \"$CMUX_WORKSPACE_ID\"";

	const lines = [
		"## CMUX workspace/UI context",
		"",
		"This Evidence analysis is designed to run as a CMUX workspace, not just a terminal checkout.",
		"",
		"### Runtime anchors",
		"",
		`- Running inside CMUX: ${insideCmux ? "yes" : "not detected from environment"}`,
		`- Caller workspace ID: ${workspaceId || "not set"}`,
		`- Caller surface ID: ${surfaceId || "not set"}`,
		`- CMUX socket available: ${socketPath ? "yes" : "no"}`,
		"- Treat the caller workspace as the automation target. The visually focused workspace may be different from the caller workspace.",
		"",
		"### Expected BI workspace surfaces",
		"",
		"- Pi agent terminal: this conversation and tool use.",
		"- Evidence browser preview: rendered dashboard that the user visually reviews.",
		"- Evidence dev server/log terminal: build/runtime messages for the active preview.",
	];
	if (url) lines.push(`- Expected Evidence preview URL: ${url}`);

	lines.push(
		"",
		"### Non-disruptive CMUX behavior",
		"",
		"- Do not steal focus or change the visible workspace/pane unless the user explicitly asks.",
		"- Do not call focus-changing commands such as `cmux select-workspace`, `cmux focus-pane`, or `cmux focus-panel` speculatively.",
		"- Prefer read-only browser inspection for dashboard validation; only click/fill/navigate when needed for the user's task.",
		"- Prefer project helpers before raw CMUX commands because they encode this Evidence workspace's preview conventions.",
		"- After substantial dashboard edits, treat the browser preview and dev server errors as part of completion quality, not optional polish.",
		"",
		"### Useful on-demand UI discovery commands",
		"",
		"Use these only when UI state is relevant; this extension does not query CMUX on every turn.",
		"",
		"```bash",
		`${helperCommand} preview-url`,
		`${helperCommand} browser-surfaces`,
		`${helperCommand} preview-title <surface-ref>`,
		`${helperCommand} preview-snapshot <surface-ref>`,
		`${helperCommand} preview-screenshot <surface-ref> /tmp/evidence-preview.png`,
		`cmux list-pane-surfaces ${workspaceFlag} --json`,
		"```",
	);
	return lines;
}

function buildWorkspaceRegistryContext(root: string, contentMode: boolean): string[] {
	const registryPath = join(root, ".cmux", "data-registry.json");
	const registryData = safeReadJson(registryPath);

	if (!registryData || typeof registryData !== "object" || !Array.isArray((registryData as Record<string, unknown>).tables)) {
		// No registry — check if data files exist
		const dataDir = join(root, "data");
		if (existsSync(dataDir)) {
			try {
				const entries = readdirSync(dataDir).filter((e) => !e.startsWith(".") && (e.endsWith(".csv") || e.endsWith(".tsv") || e.endsWith(".parquet") || e.endsWith(".json") || e.endsWith(".jsonl")));
				if (entries.length > 0) {
					return [
						"## Workspace data",
						"",
						"Workspace data files are present but not registered. Run `cmux-evidence data refresh` before building dashboard queries.",
						"",
						"Discovered files:",
						...entries.map((e) => `\t- data/${e}`),
					];
				}
			} catch {
				// ignore
			}
		}
		return [];
	}

	const data = registryData as Record<string, unknown>;
	const tables = data.tables as Array<Record<string, unknown>>;
	const readyTables = tables.filter((t) => t.status === "ready");
	const missingTables = tables.filter((t) => t.status === "missing");

	if (!readyTables.length && !missingTables.length) {
		return [
			"## Workspace data",
			"",
			"No workspace data registered yet. Ask the user to add files under data/ or run data refresh after files are added.",
		];
	}

	const lines = ["## Workspace data", ""];

	if (readyTables.length) {
		lines.push("Registered tables:");
		for (const t of readyTables) {
			const alias = String(t.alias || "?");
			const qualifiedName = String(t.qualifiedName || `files.${alias}`);
			const filePath = String(t.path || "?");
			const format = String(t.format || "?");
			const status = String(t.status || "?");
			const rowCount = typeof t.rowCount === "number" ? t.rowCount.toLocaleString() : "?";
			lines.push(`\t- ${qualifiedName} \u2014 ${filePath}, ${format}, ${status}, ${rowCount} rows`);
			if (Array.isArray(t.columns) && t.columns.length) {
				const colNames = t.columns.map((c: Record<string, unknown>) => String(c.name || "?")).join(", ");
				lines.push(`\t  Columns: ${colNames}`);
			}
		}
	}

	if (missingTables.length) {
		lines.push("", "Missing/removed tables:");
		for (const t of missingTables) {
			lines.push(`\t- ${String(t.qualifiedName || t.alias)} \u2014 ${String(t.path)} (file no longer exists)`);
		}
	}

	lines.push(
		"",
		"Rules:",
		"- Use registered table names like files.orders in Evidence page SQL.",
		"- Do not use read_csv_auto(), read_parquet(), read_json_auto(), or raw file paths in dashboard pages.",
		"- If files exist in data/ but no registered tables exist, run workspace data refresh first.",
	);

	return lines;
}

function buildDynamicEvidenceContext(root = findEvidenceRoot()): string {
	if (!root) return "";

	const evidenceConfig = safeReadJson(join(root, ".cmux", "evidence.json"));
	const workspace = safeReadJson(join(root, ".cmux", "workspace.json"));
	const contentMode = isContentWorkspace(evidenceConfig, workspace);
	const runtimeRoot = runtimeRootFor(root, evidenceConfig, workspace);
	const shadowRuntimeRoot = stringValue(workspace?.shadowRuntimeRoot) || stringValue(evidenceConfig?.shadowRuntimeRoot);
	const helperCommand = existsSync(join(runtimeRoot, "bin", "cmux-evidence")) ? join(runtimeRoot, "bin", "cmux-evidence") : "cmux-evidence";
	const sourceCatalog = buildSourceCatalog(runtimeRoot);
	const plugins = inferEvidenceDatasourcePlugins(runtimeRoot);

	const title = stringValue(workspace?.title) || basename(root);
	const slug = stringValue(workspace?.slug) || basename(root);
	const page = stringValue(workspace?.page);
	const url = stringValue(workspace?.url) || stringValue(evidenceConfig?.url);
	const branch = stringValue(workspace?.branch);
	const port = workspace?.port ?? evidenceConfig?.port;

	const lines: string[] = [
		"# Dynamic Evidence Context",
		"",
		"This context is generated passively from safe workspace metadata and source query files before each user turn. Do not assume project-specific data semantics beyond what is shown here or what you inspect with tools.",
		"",
		"## Current workspace",
		"",
		`- Project: ${stringValue(evidenceConfig?.projectId) || basename(root)}`,
		`- Analysis title: ${title}`,
		`- Slug: ${slug}`,
	];
	if (branch) lines.push(`- Branch: ${branch}`);
	if (contentMode) {
		lines.push("- Workspace mode: content-only");
		lines.push(`- Workspace root: ${root}`);
		lines.push(`- Runtime root: ${runtimeRoot} (runtime-managed; do not edit unless explicitly asked)`);
		if (shadowRuntimeRoot) lines.push(`- Shadow runtime: ${shadowRuntimeRoot} (generated Evidence app; do not edit directly)`);
		lines.push(`- Workspace helper: ${helperCommand}`);
	} else {
		lines.push(`- Worktree: ${root}`);
		if (runtimeRoot !== root) lines.push(`- Runtime root: ${runtimeRoot}`);
	}
	if (page) lines.push(`- Primary page: ${page}`);
	if (url) lines.push(`- Preview URL: ${url}`);
	if (port !== undefined && port !== null && String(port).trim()) lines.push(`- Dev server port: ${String(port)}`);
	if (process.env.CMUX_WORKSPACE_ID) lines.push(`- CMUX caller workspace: ${process.env.CMUX_WORKSPACE_ID}`);
	if (process.env.CMUX_SURFACE_ID) lines.push(`- CMUX caller surface: ${process.env.CMUX_SURFACE_ID}`);

	lines.push("", ...renderCmuxWorkspaceContext(url, helperCommand));

	const intentionLines = renderIntention(workspace);
	if (intentionLines.length) {
		lines.push("", "## Analysis intention", "", ...intentionLines);
	}

	// ── Data Access Rules (prominent, before source catalog) ──
	// ── Required Workflow (enforced by evidence-quality-guard) ──
	lines.push("", "## Required Dashboard Workflow", "");
	lines.push("**Before writing to any dashboard page** (except draft.md and index.md), you MUST:", "");
	lines.push("1. **Run evidence-bi-thinking skill** to generate an Insight Candidate Scan and Report Design Plan");
	lines.push("2. **Write the plan to `pages/draft.md`** with sections `## Insight Candidate Scan` and `## Report Design Plan`");
	lines.push("3. **Get user alignment** on the plan before proceeding");
	lines.push("4. **Then write to the target page**");
	lines.push("");
	lines.push("This workflow is **enforced** — page writes will be blocked if draft.md is missing the required sections.");
	lines.push("");

	lines.push("", "## Data Access Rules", "");
	lines.push("There are **two separate SQL execution contexts**. Mixing them up is the #1 error in Evidence dashboard work.");

	lines.push("", "### Context A: DuckDB BI Tools (ad-hoc exploration)");
	lines.push("- Tools: `duckdb_run_sql`, `duckdb_summarize_table`, `duckdb_describe_table`, etc.");
	lines.push("- CAN use file paths: `read_csv_auto('data/orders.csv')`, `read_parquet('data/events.parquet')`");
	lines.push("- CAN use source names: `from files.orders`, `from files.customers` (auto-resolved by the tool)");
	lines.push("- Use for: exploring data, running ad-hoc queries, profiling tables");
	lines.push("- Output: terminal results, not rendered dashboard");

	lines.push("", "### Context B: Evidence Page Queries (dashboard)");
	lines.push("- Where: SQL blocks inside `pages/*.md` files (the ```sql fenced blocks)");
	lines.push("- CANNOT use `read_parquet()`, `read_csv()`, `read_csv_auto()`, or file paths");
	lines.push("- MUST use registered source names: `from files.orders`, `from files.customers`");
	lines.push("- Output: rendered charts, tables, KPIs in the browser preview");

	if (sourceCatalog.length) {
		lines.push("", "### Available source names");
		for (const item of sourceCatalog) {
			lines.push(`- \`${item.name}\` — sources/${item.source}/${item.name}.sql`);
		}

		lines.push("", "### Converting a DuckDB tool query to a page query");
		lines.push("When moving a query from `duckdb_run_sql` to a page, replace file references with registered source names:");
		lines.push("```sql");
		lines.push("-- DuckDB tool query (works in duckdb_run_sql, FAILS in page):");
		lines.push("SELECT customer_id, SUM(revenue) FROM read_csv_auto('data/orders.csv') GROUP BY 1");
		lines.push("");
		lines.push("-- Evidence page query (works in pages/*.md):");
		lines.push("SELECT customer_id, SUM(revenue) FROM files.orders GROUP BY 1");
		lines.push("```");
	}

	lines.push("", "### Rules");
	lines.push("1. In page queries: ALWAYS use registered source names (e.g. `from files.orders`). NEVER use file paths.");
	lines.push("2. In DuckDB tools: either works. Prefer source names for consistency.");
	lines.push("3. Source names come from the workspace data registry (`.cmux/data-registry.json`) or `sources/*/*.sql`.");
	lines.push("4. If unsure, inspect the data with DuckDB tools first to understand available columns and join keys.");

	lines.push("", "## Dynamic data source context", "");
	if (plugins.length) {
		lines.push(`- Evidence datasource plugins enabled by evidence.config.yaml: ${plugins.join(", ")}`);
	}
	lines.push("- Source details below are inferred from safe files matching sources/*/*.sql only.");
	if (contentMode) lines.push("- In content-only workspaces, source SQL lives in the runtime root and is a read-only semantic reference unless the user explicitly asks to edit sources.");
	lines.push("- Secrets and connection files such as .env* and **/connection.yaml are intentionally not read.");
	lines.push("- Use this as a starting catalog; inspect files/queries when accuracy matters.");

	if (sourceCatalog.length) {
		lines.push("", "### Source query catalog", "");
		for (const item of sourceCatalog) {
			lines.push(`- ${item.source}.${item.name}`);
			if (contentMode) {
			lines.push(`  - File: ${runtimeRoot}/${item.file}`);
		} else {
			lines.push(`  - File: ${item.file}`);
		}
			lines.push(`  - Inferred columns: ${renderList(item.columns)}`);
			lines.push(`  - Likely time fields: ${renderList(item.timeFields)}`);
			lines.push(`  - Likely measures: ${renderList(item.measures)}`);
			lines.push(`  - Likely dimensions: ${renderList(item.dimensions)}`);
			if (item.sqlPreview) lines.push(`  - SQL preview: ${item.sqlPreview}`);
		}
	} else {
		lines.push("", "### Source query catalog", "", "No source query SQL files were found under sources/*/*.sql.");
	}


	const profileLines = renderCachedProfile(root);
	if (profileLines.length) lines.push("", ...profileLines);

	// ── Workspace Data Registry context ──
	const registryLines = buildWorkspaceRegistryContext(root, contentMode);
	if (registryLines.length) lines.push("", ...registryLines);

	lines.push(
		"",
		"## Evidence component reference",
		"",
		"Component props, options, and detailed examples are in the OSS documentation. **Never guess props — look them up.**",
		"",
		"**Documentation location:** `.agent/docs/evidence-oss/`",
		"- `ROUTES.md` — task-based routing (start here)",
		"- `INDEX.md` — full component map with doc paths and quick reference",
		"",
		"**How to look up a component:**",
		"1. Read `.agent/docs/evidence-oss/ROUTES.md` for the task",
		"2. Follow the link to the specific component doc",
		"3. Read the doc at: `/Users/fatihkarahan/.opensrc/repos/github.com/evidence-dev/evidence/main/sites/docs/pages/`",
		"4. Use `<Component>` syntax (OSS), not `{% %}` syntax (Studio)",
		"",
		"Common mistakes to avoid:",
		"- `colorPalette` is for SERIES-level coloring. For per-bar colors on a simple chart, use `echartsOptions={{ color: [...] }}`.",
		"- Evidence charts are built on ECharts. Use `echartsOptions` for advanced customization and `printEchartsConfig=true` to debug.",
		"- Use `seriesOptions` (not `echartsOptions.series`) to apply options to ALL series at once.",
	);

	lines.push(
		"",
		"## Dashboard-agent guidance for this turn",
		"",
		"- Prefer Evidence-native work: Markdown narrative, SQL queries, BigValue KPI cards, LineChart/BarChart, DataTable, Grid, and simple inputs/filters when useful.",
		"- Connect dashboard elements back to the analysis intention and available source catalog.",
		"- Keep data-source assumptions explicit. If a column or metric is only inferred, verify it before relying on it.",
		"- Do not inspect or edit blocked secret/config files to learn data source details.",
		"- NEVER use '<' or '&' in plain Markdown text (e.g. '<1,000', 'Q&A', 'x < y') — these crash the Svelte renderer with 'Expected valid tag name'. Use 'under', 'less than', 'and', or HTML entities instead. Code blocks and Evidence components (<DataTable>, <BarChart>) are safe.",
	);

	let context = lines.join("\n");
	if (context.length > MAX_CONTEXT_CHARS) {
		context = `${context.slice(0, MAX_CONTEXT_CHARS).trimEnd()}\n\n[Dynamic Evidence context truncated]`;
	}
	return context;
}

export default function evidenceContextExtension(pi: ExtensionAPI) {
	pi.registerMessageRenderer<{ title?: string }>(WORKSPACE_REPORT_MESSAGE_TYPE, (message, _options, theme) => {
		const title = typeof message.details?.title === "string" ? message.details.title : "Evidence Workspace";
		const text = typeof message.content === "string" ? message.content : "";
		const box = new Box(1, 1, (value: string) => theme.bg("customMessageBg", value));
		box.addChild(new Text(theme.fg("accent", theme.bold(title)), 0, 0));
		box.addChild(new Text(theme.fg("dim", "─".repeat(Math.max(12, Math.min(64, title.length + 8)))), 0, 0));
		box.addChild(new Text(text, 0, 0, (line: string) => theme.fg("customMessageText", truncateToWidth(line, 200))));
		return box;
	});

	function showReport(ctx: { hasUI: boolean }, title: string, content: string): void {
		if (!ctx.hasUI) {
			console.log(`\n${content}\n`);
			return;
		}
		pi.sendMessage(
			{
				customType: WORKSPACE_REPORT_MESSAGE_TYPE,
				content,
				display: true,
				details: { title },
			},
			{ triggerTurn: false },
		);
	}

	pi.on("before_agent_start", async (event) => {
		const context = buildDynamicEvidenceContext();
		if (!context) return undefined;
		return {
			systemPrompt: `${event.systemPrompt}\n\n${context}`,
		};
	});

	pi.registerCommand("evidence-context", {
		description: "Print the dynamic Evidence context that will be injected before each user turn",
		handler: async (_args, ctx) => {
			const context = buildDynamicEvidenceContext();
			if (!context) {
				ctx.ui.notify("No Evidence workspace context found", "warning");
				return;
			}
			console.log(`\n${context}\n`);
			ctx.ui.notify("Printed dynamic Evidence context", "info");
		},
	});

	pi.registerCommand("workspace-status", {
		description: "Show a compact Evidence workspace status card; pass --debug to include CMUX IDs",
		handler: async (args, ctx) => {
			const debug = String(args ?? "").trim() === "--debug";
			showReport(ctx, "Workspace Status", renderWorkspaceStatus(undefined, { debug }));
		},
	});

	pi.registerCommand("workspace-summary", {
		description: "Show a compact Evidence workspace summary card; pass --full for the complete brief",
		handler: async (args, ctx) => {
			const full = String(args ?? "").trim() === "--full";
			showReport(ctx, "Workspace Summary", renderWorkspaceSummary(undefined, { full }));
		},
	});

	pi.registerCommand("workspace-cleanup-plan", {
		description: "Show a read-only cleanup safety review for the current Evidence analysis workspace",
		handler: async (_args, ctx) => {
			showReport(ctx, "Workspace Cleanup Plan", renderWorkspaceCleanupPlan());
		},
	});

	pi.registerCommand("workspace-list", {
		description: "List Evidence analysis workspaces and optionally open one with an interactive selector",
		handler: async (args, ctx) => {
			const root = findEvidenceRoot();
			if (!root) {
				ctx.ui.notify("No Evidence workspace found", "warning");
				return;
			}

			const commandArgs = String(args ?? "").trim();
			const textOnly = commandArgs === "--text" || commandArgs === "--no-select";
			if (textOnly) {
				console.log(`\n${renderWorkspaceListText(root)}\n`);
				return;
			}

			const { items, projectId } = workspaceItems(root);
			if (!items.length) {
				console.log(`\n${renderWorkspaceListText(root)}\n`);
				ctx.ui.notify("No analysis workspaces found", "warning");
				return;
			}

			const selectItems: SelectItem[] = items.map((item) => ({
				value: item.slug,
				label: `${item.title}${item.current ? " (current)" : ""}`,
				description: [
					item.status,
					item.branch,
					item.url,
					item.updatedAt ? `updated ${formatDate(item.updatedAt)}` : "",
				]
					.filter(Boolean)
					.join(" • "),
			}));

			const selectedSlug = await ctx.ui.custom<string | null>((tui, theme, _keybindings, done) => {
				const container = new Container();
				container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
				container.addChild(new Text(theme.fg("accent", theme.bold("Evidence Analysis Workspaces")), 1, 0));
				container.addChild(new Text(theme.fg("dim", `Project: ${projectId}`), 1, 0));

				const selectList = new SelectList(selectItems, Math.min(selectItems.length, 10), {
					selectedPrefix: (t: string) => theme.fg("accent", t),
					selectedText: (t: string) => theme.fg("accent", t),
					description: (t: string) => theme.fg("muted", t),
					scrollInfo: (t: string) => theme.fg("dim", t),
					noMatch: (t: string) => theme.fg("warning", t),
				});
				selectList.onSelect = (item) => done(item.value);
				selectList.onCancel = () => done(null);
				container.addChild(selectList);
				container.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter open/jump • esc cancel • use /workspace-list --text for plain output"), 1, 0));
				container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

				return {
					render: (width: number) => container.render(width),
					invalidate: () => container.invalidate(),
					handleInput: (data: unknown) => {
						selectList.handleInput(data);
						tui.requestRender();
					},
				};
			});

			if (!selectedSlug) {
				ctx.ui.notify("Workspace selection cancelled", "info");
				return;
			}

			const selected = items.find((item) => item.slug === selectedSlug);
			if (selected?.current) {
				showReport(ctx, "Workspace Status", renderWorkspaceStatus(root));
				return;
			}

			try {
				ctx.ui.notify(`Opening ${selected?.title || selectedSlug}...`, "info");
				openWorkspaceBySlug(root, selectedSlug);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				ctx.ui.notify(`Failed to open workspace: ${message}`, "error");
				console.error(message);
			}
		},
	});
}
