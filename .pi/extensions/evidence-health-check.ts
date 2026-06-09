/**
 * Evidence Render Guard Extension
 *
 * Registers a `check_evidence_health` tool that verifies the Evidence dev server
 * is running and pages are accessible. Catches build failures, server crashes,
 * and routing errors — the kind of errors that make screenshots useless because
 * there's nothing to screenshot.
 *
 * How it works:
 *   1. Agent edits a .md or .sql file
 *   2. Agent calls check_evidence_health
 *   3. Tool hits the dev server via HTTP and reports status
 *   4. If errors found → agent fixes before wasting time on screenshots
 *   5. If clean → agent proceeds to visual validation
 *
 * What it catches:
 *   - Dev server not running (connection refused)
 *   - Vite compilation failure (non-200 or error overlay in HTML)
 *   - Page routing errors (404/500 per page)
 *   - Missing JavaScript bundles (build broke client-side code)
 *
 * What it does NOT catch (use screenshots for these):
 *   - SQL query errors at runtime (rendered client-side)
 *   - Component "is not defined" errors (rendered client-side)
 *   - Empty charts or wrong data
 *   - Layout/spacing/visual issues
 */

import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceConfig {
	port?: number;
	url?: string;
	pages?: Record<string, string>;
}

interface PageResult {
	page: string;
	url: string;
	status: number | "timeout" | "connection_refused" | "error";
	healthy: boolean;
	notes?: string;
}

interface HealthCheckResult {
	serverAlive: boolean;
	serverPort: number;
	buildHealthy: boolean;
	pages: PageResult[];
	summary: string;
	errorCount: number;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_PORT = 3117;
const REQUEST_TIMEOUT_MS = 5_000;

function readWorkspacePort(cwd: string): number {
	try {
		const workspaceJsonPath = path.join(cwd, ".cmux", "workspace.json");
		const raw = fs.readFileSync(workspaceJsonPath, "utf-8");
		const config: WorkspaceConfig = JSON.parse(raw);
		if (config.port && typeof config.port === "number") {
			return config.port;
		}
	} catch {
		// .cmux/workspace.json missing or malformed — fall through
	}

	// Environment variable fallback
	const envPort = process.env.EVIDENCE_PORT;
	if (envPort) {
		const parsed = Number.parseInt(envPort, 10);
		if (!Number.isNaN(parsed)) return parsed;
	}

	return DEFAULT_PORT;
}

function discoverPages(cwd: string): string[] {
	// Pages directory lives in the workspace content dir (the analysis workspace)
	// In lumen-analysis-workspace, pages are symlinked into the shadow runtime.
	// We look in the content workspace's pages/ dir first, then shadow runtime.
	const candidates = [
		path.join(cwd, "pages"),
		// Shadow runtime: pages are symlinked in
		path.join(cwd, ".cmux", "..", "..", "runtime"),
	];

	for (const dir of candidates) {
		try {
			const entries = fs.readdirSync(dir, { withFileTypes: true });
			const pages = entries
				.filter((e) => e.isFile() && e.name.endsWith(".md"))
				.map((e) => e.name.replace(/\.md$/, ""))
				.filter((name) => name !== "debugging-workflow"); // skip non-dashboard pages
			if (pages.length > 0) return pages;
		} catch {
			// directory doesn't exist, try next
		}
	}

	// Fallback: well-known pages
	return ["index", "draft", "report"];
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function httpGet(
	url: string,
	timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<{ status: number; body: string; error?: string }> {
	return new Promise((resolve) => {
		const req = http.get(url, { timeout: timeoutMs }, (res) => {
			let body = "";
			res.on("data", (chunk: Buffer) => {
				body += chunk.toString();
			});
			res.on("end", () => {
				resolve({ status: res.statusCode ?? 0, body });
			});
		});

		req.on("timeout", () => {
			req.destroy();
			resolve({ status: 0, body: "", error: "timeout" });
		});

		req.on("error", (err: NodeJS.ErrnoException) => {
			resolve({
				status: 0,
				body: "",
				error: err.code === "ECONNREFUSED" ? "connection_refused" : err.message,
			});
		});
	});
}

// ---------------------------------------------------------------------------
// Error detection
// ---------------------------------------------------------------------------

/** Patterns that indicate a build or render error in the HTML response */
const ERROR_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
	// Vite error overlay
	{ pattern: /id=["']vite-error-overlay["']/, description: "Vite error overlay detected" },
	{ pattern: /<vite-error-overlay/, description: "Vite error overlay component" },
	// Evidence / SvelteKit error pages
	{ pattern: /class=["'][^"']*error[^"']*["']/i, description: "Error class in HTML" },
	{ pattern: /<h[12][^>]*>\s*(Error|Internal Server Error|Not Found)/i, description: "Error heading" },
	// Module loading failures
	{ pattern: /Failed to load module|Cannot find module/i, description: "Module loading failure" },
	// SQL errors (sometimes embedded in SSR content)
	{
		pattern: /(?:ERROR|error|syntax error|does not exist|column .* not found|relation .* does not exist)/,
		description: "SQL error text",
	},
	// Component errors
	{ pattern: /is not defined|is not a function|Cannot read propert/i, description: "Runtime JS error" },
];

function detectErrorsInHtml(html: string): string[] {
	const errors: string[] = [];
	for (const { pattern, description } of ERROR_PATTERNS) {
		if (pattern.test(html)) {
			errors.push(description);
		}
	}
	return errors;
}

/** Check if the HTML has the expected SvelteKit script imports (build health) */
function hasExpectedScriptTags(html: string): boolean {
	// Evidence/SvelteKit pages should have at least one import() call in script tags
	return /import\(["']/.test(html) || /__sveltekit_dev/.test(html);
}

// ---------------------------------------------------------------------------
// Health check logic
// ---------------------------------------------------------------------------

async function checkPage(
	baseUrl: string,
	page: string,
): Promise<PageResult> {
	const url = `${baseUrl}/${page}/`;
	const result = await httpGet(url);

	if (result.error === "connection_refused") {
		return { page, url, status: "connection_refused", healthy: false, notes: "Server not responding" };
	}
	if (result.error === "timeout") {
		return { page, url, status: "timeout", healthy: false, notes: "Request timed out" };
	}
	if (result.error) {
		return { page, url, status: "error", healthy: false, notes: result.error };
	}

	const htmlErrors = detectErrorsInHtml(result.body);
	const hasScripts = hasExpectedScriptTags(result.body);

	const healthy = result.status >= 200 && result.status < 400 && htmlErrors.length === 0;
	const notes: string[] = [];
	if (result.status >= 400) notes.push(`HTTP ${result.status}`);
	if (htmlErrors.length > 0) notes.push(htmlErrors.join("; "));
	if (!hasScripts && result.status === 200) notes.push("Missing expected script tags (build may have failed)");

	return {
		page,
		url,
		status: result.status,
		healthy,
		notes: notes.length > 0 ? notes.join("; ") : undefined,
	};
}

async function runHealthCheck(
	port: number,
	pages: string[],
): Promise<HealthCheckResult> {
	const baseUrl = `http://localhost:${port}`;

	// Step 1: Check if server is alive
	const rootResult = await httpGet(baseUrl);

	if (rootResult.error === "connection_refused") {
		return {
			serverAlive: false,
			serverPort: port,
			buildHealthy: false,
			pages: [],
			summary: `Evidence dev server not running on port ${port}. Check the CMUX terminal pane.`,
			errorCount: 1,
		};
	}

	if (rootResult.error === "timeout") {
		return {
			serverAlive: false,
			serverPort: port,
			buildHealthy: false,
			pages: [],
			summary: `Evidence dev server on port ${port} is not responding (timed out).`,
			errorCount: 1,
		};
	}

	if (rootResult.error) {
		return {
			serverAlive: false,
			serverPort: port,
			buildHealthy: false,
			pages: [],
			summary: `Evidence dev server error on port ${port}: ${rootResult.error}`,
			errorCount: 1,
		};
	}

	// Server is alive — check build health from root response
	const rootErrors = detectErrorsInHtml(rootResult.body);
	const buildHealthy = rootResult.status >= 200 && rootResult.status < 400 && rootErrors.length === 0;

	// Step 2: Check all pages (in parallel)
	const pageResults = await Promise.all(pages.map((page) => checkPage(baseUrl, page)));

	// Step 3: Build summary
	const errorPages = pageResults.filter((p) => !p.healthy);
	const errorCount = (buildHealthy ? 0 : 1) + errorPages.length;

	let summary: string;
	if (errorCount === 0) {
		summary = `All clear. Server running on port ${port}, ${pageResults.length} pages checked, no errors found.`;
	} else {
		const parts: string[] = [];
		if (!buildHealthy) {
			parts.push(`Build error: ${rootErrors.join("; ") || "unknown build failure"}`);
		}
		for (const ep of errorPages) {
			parts.push(`${ep.page}: ${ep.notes || `HTTP ${ep.status}`}`);
		}
		summary = `${errorCount} error(s) found:\n${parts.map((p) => `  - ${p}`).join("\n")}`;
	}

	return {
		serverAlive: true,
		serverPort: port,
		buildHealthy,
		pages: pageResults,
		summary,
		errorCount,
	};
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatResult(result: HealthCheckResult): string {
	const lines: string[] = [];

	// Header
	if (result.errorCount === 0) {
		lines.push("## Evidence Health Check — All Clear ✅");
	} else {
		lines.push(`## Evidence Health Check — ${result.errorCount} Error(s) ❌`);
	}
	lines.push("");

	// Server status
	lines.push(
		`**Server:** ${result.serverAlive ? "✅ Running" : "❌ Not responding"} on port ${result.serverPort}`,
	);
	if (result.serverAlive) {
		lines.push(`**Build:** ${result.buildHealthy ? "✅ No compilation errors" : "❌ Build error detected"}`);
	}
	lines.push("");

	// Page table
	if (result.pages.length > 0) {
		lines.push("### Pages");
		lines.push("| Page | Status | Notes |");
		lines.push("|------|--------|-------|");
		for (const page of result.pages) {
			const icon = page.healthy ? "✅" : "❌";
			const statusStr =
				typeof page.status === "number" ? `${page.status}` : page.status;
			const notes = page.healthy ? "OK" : page.notes || "error";
			lines.push(`| ${page.page} | ${icon} ${statusStr} | ${notes} |`);
		}
		lines.push("");
	}

	// Actionable guidance
	if (result.errorCount > 0) {
		lines.push("### Next Steps");
		if (!result.serverAlive) {
			lines.push("- Start the Evidence dev server: `evidence dev` in the CMUX terminal");
		} else if (!result.buildHealthy) {
			lines.push("- Fix the build error in the source files, then re-run this check");
		} else {
			lines.push("- Fix the pages with errors, then re-run this check");
			lines.push("- After errors are resolved, take screenshots for visual validation");
		}
	} else {
		lines.push("No build or routing errors detected. Proceed to visual validation (screenshots).");
	}

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	let serverPort: number;

	pi.on("session_start", async (event, ctx) => {
		serverPort = readWorkspacePort(ctx.cwd);
		if (ctx.hasUI) {
			ctx.ui.notify(`Evidence guard active (port ${serverPort})`, "info");
		}
	});

	pi.registerTool({
		name: "check_evidence_health",
		label: "Evidence Health Check",
		description:
			"Check if the Evidence dev server is running and pages are accessible. " +
			"Use after editing .md or .sql files to catch build errors before taking screenshots.",
		promptSnippet: "Check Evidence dev server health and page accessibility",
		promptGuidelines: [
			"Use check_evidence_health after editing any Evidence page (.md) or query (.sql) file to verify the build succeeded.",
			"Call check_evidence_health before taking screenshots — it catches build failures fast so you don't waste time screenshotting a broken build.",
		],
		parameters: Type.Object({
			pages: Type.Optional(
				Type.Array(Type.String(), {
					description:
						"Specific pages to check (e.g. ['draft', 'q1']). Omit to check all pages in the pages/ directory.",
				}),
			),
			buildOnly: Type.Optional(
				Type.Boolean({
					description: "If true, only check the root URL (build health). Faster. Default: false.",
				}),
			),
		}),

		async execute(_toolCallId, params, _signal, onUpdate, _ctx) {
			const port = serverPort ?? DEFAULT_PORT;
			const pagesToCheck = params.buildOnly
				? []
				: params.pages ?? discoverPages(_ctx.cwd);

			onUpdate?.({
				content: [{ type: "text", text: `Checking Evidence dev server on port ${port}...` }],
			});

			const result = await runHealthCheck(port, pagesToCheck);
			const formatted = formatResult(result);

			return {
				content: [{ type: "text", text: formatted }],
				details: result,
			};
		},
	});
}
