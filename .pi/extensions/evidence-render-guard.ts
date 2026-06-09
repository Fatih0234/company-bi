import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";

// ── Known valid Evidence components ──────────────────────────────────

const EVIDENCE_COMPONENTS = new Set([
	"BigValue", "BarChart", "LineChart", "AreaChart", "BubbleChart", "CalendarHeatmap",
	"FunnelChart", "Histogram", "PieChart", "ScatterPlot", "ReferenceLine", "ReferenceArea",
	"SankeyChart", "DataTable", "Grid", "Tabs", "Accordion", "Alert", "Button", "CodeBlock",
	"Dropdown", "DimensionGrid", "DownloadData", "EmailInput", "LinkButton", "MultiSelect",
	"MonthRange", "NumberInput", "Pagination", "QueryViewer", "ResetButton", "SearchBar",
	"Select", "Sidebar", "Slider", "Spacing", "Tag", "TextInput", "Toggle", "URLInput",
	"DateRange", "LastRefreshed", "Info", "MissingValue", "ValueError", "CategoricalLegend",
	"ContinuousLegend", "Legend",
	// Default variants
	"DefaultDropdown", "DefaultSingleSelect", "DefaultMultiSelect", "DefaultTextInput",
	"DefaultNumberInput", "DefaultMonthRange", "DefaultDateRange", "DefaultSlider",
	"DefaultButton", "DefaultLinkButton", "DefaultQueryViewer", "DefaultSearchBar",
	"DefaultDownloadData", "DefaultToggle", "DefaultResetButton", "DefaultSpacing",
	"DefaultTag", "DefaultEmailInput", "DefaultURLInput", "DefaultPagination",
	"DefaultSidebar", "DefaultLastRefreshed", "DefaultInfo", "DefaultMissingValue",
	"DefaultValueError", "DefaultCategoricalLegend", "DefaultContinuousLegend", "DefaultLegend",
]);

// ── Common HTML tags that are safe ────────────────────────────────────

const HTML_TAGS = new Set([
	"div", "span", "p", "a", "img", "br", "hr", "table", "tr", "td", "th", "thead", "tbody",
	"ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "b", "i", "u", "s",
	"strike", "del", "ins", "sub", "sup", "code", "pre", "blockquote", "details", "summary",
	"figure", "figcaption", "iframe", "script", "style", "form", "input", "label", "textarea",
	"select", "option", "nav", "header", "footer", "main", "article", "section", "aside",
	"html", "body", "head", "title", "meta", "link", "canvas", "svg", "path", "g", "rect",
	"circle", "line", "polyline", "polygon", "text", "tspan", "defs", "clipPath", "mask",
]);

// ── Valid HTML entities (without leading &) ──────────────────────────

const VALID_ENTITIES = new Set([
	"amp", "lt", "gt", "quot", "apos", "nbsp", "copy", "reg", "trade", "hellip",
	"mdash", "ndash", "ldquo", "rdquo", "lsquo", "rsquo", "laquo", "raquo",
	"deg", "times", "divide", "plusmn", "frac14", "frac12", "frac34", "sup1",
	"sup2", "sup3", "micro", "para", "middot", "bull", "cent", "pound", "yen",
	"euro", "sect", "circ", "tilde", "ensp", "emsp", "thinsp", "zwnj", "zwj",
	"lrm", "rlm", "dagger", "Dagger", "permil", "lsaquo", "rsaquo",
]);

// ── Types ────────────────────────────────────────────────────────────

interface RenderingIssue {
	line: number;
	message: string;
	fixHint: string;
}

// ── Helper functions for Evidence-specific pattern detection ──────────

/**
 * Extract SQL block names from markdown content.
 * Looks for patterns like: ```sql block_name
 */
function extractSqlBlockNames(content: string): string[] {
	const names: string[] = [];
	const sqlBlockRegex = /^```sql\s+(\w+)/gm;
	let match;
	while ((match = sqlBlockRegex.exec(content)) !== null) {
		names.push(match[1]);
	}
	return names;
}

/**
 * Extract SQL column aliases from a SQL block.
 * Looks for patterns like: expression AS alias_name
 */
function extractSqlColumnAliases(sqlContent: string): string[] {
	const aliases: string[] = [];
	// Match: expression AS alias (case insensitive)
	// Also handles: expression as alias
	const aliasRegex = /\bAS\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
	let match;
	while ((match = aliasRegex.exec(sqlContent)) !== null) {
		aliases.push(match[1]);
	}
	return aliases;
}

/**
 * Extract SQL block content from markdown content.
 * Returns a map of block name to content.
 */
function extractSqlBlocks(content: string): Map<string, { content: string; line: number }> {
	const blocks = new Map<string, { content: string; line: number }>();
	const lines = content.split("\n");
	let inSqlBlock = false;
	let currentBlockName = "";
	let currentBlockStart = 0;
	let currentBlockContent = "";

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (line.startsWith("```sql")) {
			inSqlBlock = true;
			currentBlockName = line.replace(/^```sql\s*/, "").trim();
			currentBlockStart = i + 1;
			currentBlockContent = "";
			continue;
		}

		if (inSqlBlock && line === "```") {
			inSqlBlock = false;
			if (currentBlockName) {
				blocks.set(currentBlockName, {
					content: currentBlockContent,
					line: currentBlockStart,
				});
			}
			continue;
		}

		if (inSqlBlock) {
			currentBlockContent += line + "\n";
		}
	}

	return blocks;
}

/**
 * Extract chart components from markdown content.
 * Looks for BarChart, AreaChart, LineChart, etc. with their props.
 */
interface ChartComponent {
	name: string;
	line: number;
	props: Record<string, string>;
}

function extractChartComponents(content: string): ChartComponent[] {
	const charts: ChartComponent[] = [];
	const lines = content.split("\n");

	let inComponent = false;
	let currentComponent = "";
	let currentComponentStart = 0;
	let componentName = "";

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Check for component start: <BarChart or <AreaChart etc.
		const componentStartMatch = line.match(/^<(BarChart|AreaChart|LineChart|BubbleChart|ScatterPlot|Histogram|PieChart|FunnelChart|CalendarHeatmap|SankeyChart)/);
		if (componentStartMatch) {
			inComponent = true;
			componentName = componentStartMatch[1];
			currentComponentStart = i + 1;
			currentComponent = line;

			// Check if component is self-closing or closed on same line
			if (line.includes("/>")) {
				inComponent = false;
				charts.push({
					name: componentName,
					line: currentComponentStart,
					props: parseComponentProps(currentComponent),
				});
			}
			continue;
		}

		if (inComponent) {
			currentComponent += " " + line;

			// Check for component end
			if (line.includes("/>") || line.includes(">")) {
				inComponent = false;
				charts.push({
					name: componentName,
					line: currentComponentStart,
					props: parseComponentProps(currentComponent),
				});
			}
		}
	}

	return charts;
}

/**
 * Parse component props from a component string.
 * Extracts key=value pairs.
 */
function parseComponentProps(componentStr: string): Record<string, string> {
	const props: Record<string, string> = {};

	// Match prop patterns: key=value or key={value}
	// Handles: key="value", key=value, key={value}, key={{...}}
	const propRegex = /(\w+)=(?:"([^"]*)"|(\{[^}]*\})|([^\s/>]+))/g;
	let match;
	while ((match = propRegex.exec(componentStr)) !== null) {
		const key = match[1];
		const value = match[2] || match[3] || match[4];
		props[key] = value;
	}

	return props;
}

/**
 * Extract y column names from a chart's y prop.
 * Handles: y=column, y={column}, y={"column"}, y={["col1", "col2"]}
 */
function extractYColumns(yProp: string): string[] {
	if (!yProp) return [];

	// Remove outer braces if present
	let y = yProp;
	if (y.startsWith("{") && y.endsWith("}")) {
		y = y.slice(1, -1);
	}

	// Handle array: ["col1", "col2"] or [col1, col2]
	if (y.startsWith("[") && y.endsWith("]")) {
		try {
			// Try JSON parse first
			return JSON.parse(y);
		} catch {
			// Fallback: extract quoted strings
			const cols: string[] = [];
			const colRegex = /["']([^"']+)["']/g;
			let match;
			while ((match = colRegex.exec(y)) !== null) {
				cols.push(match[1]);
			}
			return cols;
		}
	}

	// Remove quotes if present
	if ((y.startsWith("'") && y.endsWith("'")) || (y.startsWith('"') && y.endsWith('"'))) {
		y = y.slice(1, -1);
	}

	return [y];
}

/**
 * Extract seriesColors keys from a chart's seriesColors prop.
 * Handles: seriesColors={{'key1': 'color1', 'key2': 'color2'}}
 */
function extractSeriesColorsKeys(seriesColorsProp: string): string[] {
	if (!seriesColorsProp) return [];

	const keys: string[] = [];

	// Remove outer braces if present
	let sc = seriesColorsProp;
	if (sc.startsWith("{") && sc.endsWith("}")) {
		sc = sc.slice(1, -1);
	}

	// Match patterns: 'key': value or "key": value
	const keyRegex = /['"]([^'"]+)['"]\s*:/g;
	let match;
	while ((match = keyRegex.exec(sc)) !== null) {
		keys.push(match[1]);
	}

	return keys;
}

// ── Evidence-specific pattern detection ──────────────────────────────

/**
 * Detect _pct column names in stacked100 charts.
 * This is the critical pattern that causes _pct_pct issues.
 */
function detectPctColumnsInStacked100(content: string): RenderingIssue[] {
	const issues: RenderingIssue[] = [];
	const charts = extractChartComponents(content);

	for (const chart of charts) {
		const type = chart.props.type;
		if (type !== '"stacked100"' && type !== 'stacked100') continue;

		const yColumns = extractYColumns(chart.props.y);
		const pctColumns = yColumns.filter(col => col.endsWith('_pct'));

		if (pctColumns.length > 0) {
			issues.push({
				line: chart.line,
				message: `Column names ending in '_pct' will be doubled to '_pct_pct' by Evidence's stacked100 transformer`,
				fixHint: `Rename SQL columns to use '_share', '_ratio', or '_pct_raw' instead of '_pct'. Example: '${pctColumns[0]}' → '${pctColumns[0].replace('_pct', '_share')}'`,
			});
		}

		// Also check seriesColors keys for _pct suffix
		const seriesColorsKeys = extractSeriesColorsKeys(chart.props.seriesColors);
		const pctKeys = seriesColorsKeys.filter(key => key.endsWith('_pct'));

		if (pctKeys.length > 0) {
			// Only add if we didn't already add an issue for y columns
			if (pctColumns.length === 0) {
				issues.push({
					line: chart.line,
					message: `seriesColors keys ending in '_pct' will mismatch after stacked100 transformation`,
					fixHint: `Rename seriesColors keys to use '_share', '_ratio', or '_pct_raw' instead of '_pct'. Example: '${pctKeys[0]}' → '${pctKeys[0].replace('_pct', '_share')}'`,
				});
			}
		}
	}

	return issues;
}

/**
 * Detect seriesColors keys that don't match y column references.
 */
function detectSeriesColorsMismatch(content: string): RenderingIssue[] {
	const issues: RenderingIssue[] = [];
	const charts = extractChartComponents(content);

	for (const chart of charts) {
		const seriesColorsKeys = extractSeriesColorsKeys(chart.props.seriesColors);
		if (seriesColorsKeys.length === 0) continue;

		const yColumns = extractYColumns(chart.props.y);
		if (yColumns.length === 0) continue;

		// Check if all seriesColors keys match y columns
		for (const key of seriesColorsKeys) {
			if (!yColumns.includes(key)) {
				issues.push({
					line: chart.line,
					message: `seriesColors key '${key}' does not match any y column`,
					fixHint: `Ensure seriesColors keys match the y column names. Current y columns: ${yColumns.join(', ')}`,
				});
			}
		}
	}

	return issues;
}

/**
 * Detect swapXY with non-category x-axis.
 */
function detectSwapXYWithNonCategoryX(content: string): RenderingIssue[] {
	const issues: RenderingIssue[] = [];
	const charts = extractChartComponents(content);

	for (const chart of charts) {
		const swapXY = chart.props.swapXY;
		if (swapXY !== 'true' && swapXY !== '"true"') continue;

		const xType = chart.props.xType;
		if (xType === '"time"' || xType === 'time' || xType === '"value"' || xType === 'value') {
			issues.push({
				line: chart.line,
				message: `Horizontal charts do not support a value or time-based x-axis`,
				fixHint: `Change your SQL query to output string values or set swapXY=false`,
			});
		}
	}

	return issues;
}

/**
 * Detect swapXY with y2 axis.
 */
function detectSwapXYWithY2(content: string): RenderingIssue[] {
	const issues: RenderingIssue[] = [];
	const charts = extractChartComponents(content);

	for (const chart of charts) {
		const swapXY = chart.props.swapXY;
		if (swapXY !== 'true' && swapXY !== '"true"') continue;

		const y2 = chart.props.y2;
		if (y2) {
			issues.push({
				line: chart.line,
				message: `Horizontal charts do not support a secondary y-axis`,
				fixHint: `Set swapXY=false or remove the y2 prop from your chart`,
			});
		}
	}

	return issues;
}

/**
 * Detect yLog with stacked charts.
 */
function detectYLogWithStacked(content: string): RenderingIssue[] {
	const issues: RenderingIssue[] = [];
	const charts = extractChartComponents(content);

	for (const chart of charts) {
		const yLog = chart.props.yLog;
		if (yLog !== 'true' && yLog !== '"true"') continue;

		const type = chart.props.type;
		if (type === '"stacked100"' || type === 'stacked100' || 
			type === '"stacked"' || type === 'stacked') {
			issues.push({
				line: chart.line,
				message: `Log axis cannot be used in a stacked chart`,
				fixHint: `Remove yLog or change chart type to 'grouped'`,
			});
		}
	}

	return issues;
}

/**
 * Detect data prop referencing non-existent query.
 */
function detectMissingDataReference(content: string): RenderingIssue[] {
	const issues: RenderingIssue[] = [];
	const sqlBlockNames = extractSqlBlockNames(content);
	const charts = extractChartComponents(content);

	for (const chart of charts) {
		const dataRef = chart.props.data;
		if (!dataRef) continue;

		// Extract query name from data={queryName}
		let queryName = dataRef;
		if (queryName.startsWith("{") && queryName.endsWith("}")) {
			queryName = queryName.slice(1, -1);
		}

		// Check if query name exists in SQL blocks
		if (!sqlBlockNames.includes(queryName)) {
			issues.push({
				line: chart.line,
				message: `data={${queryName}} references a non-existent query`,
				fixHint: `Ensure the query name matches a SQL block name. Available queries: ${sqlBlockNames.join(', ')}`,
			});
		}
	}

	return issues;
}

// ── Markdown analyzer ────────────────────────────────────────────────

function analyzeEvidenceMarkdown(content: string): RenderingIssue[] {
	const issues: RenderingIssue[] = [];
	const lines = content.split("\n");

	let inCodeBlock = false;
	let inFrontMatter = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Front matter (YAML between --- lines)
		if (line === "---") {
			inFrontMatter = !inFrontMatter;
			continue;
		}
		if (inFrontMatter) continue;

		// Code blocks
		if (line.startsWith("```")) {
			inCodeBlock = !inCodeBlock;
			continue;
		}
		if (inCodeBlock) continue;

		// Split by inline code (backticks) and check only non-code parts
		const parts = line.split("`");
		for (let j = 0; j < parts.length; j += 2) {
			const text = parts[j];

			// Check for < followed by number or non-letter (not space, not /, not !)
			// This catches: <1, <2, <&, <>, <=, <{, <[
			const dangerousAngleRegex = /<(?![a-zA-Z\/\!])\S/g;
			let match;
			while ((match = dangerousAngleRegex.exec(text)) !== null) {
				const snippet = text.slice(match.index, Math.min(match.index + 15, text.length));
				issues.push({
					line: i + 1,
					message: `'${snippet}' will crash the Svelte renderer with 'Expected valid tag name'`,
					fixHint: `Avoid '<' followed by numbers or symbols in plain text. Use 'under', 'less than', or '&lt;' instead.`,
				});
			}

			// Check for < followed by a word that is NOT a valid tag/component
			const tagRegex = /<([a-zA-Z][a-zA-Z0-9_-]*)/g;
			while ((match = tagRegex.exec(text)) !== null) {
				const tagName = match[1];
				if (EVIDENCE_COMPONENTS.has(tagName) || HTML_TAGS.has(tagName.toLowerCase())) {
					continue;
				}
				const snippet = text.slice(match.index, Math.min(match.index + 15, text.length));
				issues.push({
					line: i + 1,
					message: `'${snippet}' will be parsed as an invalid HTML tag by the Svelte renderer`,
					fixHint: `Use '${snippet}' only inside code blocks, or avoid '<' in plain text. Use 'under', 'less than', or '&lt;' instead.`,
				});
			}

			// Check for & not followed by valid HTML entity
			const ampRegex = /&([a-zA-Z][a-zA-Z0-9]*|#[0-9]+|#x[0-9a-fA-F]+)/g;
			while ((match = ampRegex.exec(text)) !== null) {
				const entity = match[1];
				// Valid named entity
				if (VALID_ENTITIES.has(entity.toLowerCase())) continue;
				// Numeric entity
				if (entity.startsWith("#") && /^#[0-9]+$/.test(entity)) continue;
				// Hex entity
				if ((entity.startsWith("#x") || entity.startsWith("#X")) && /^#x[0-9a-fA-F]+$/.test(entity)) continue;

				const snippet = text.slice(match.index, Math.min(match.index + 15, text.length));
				issues.push({
					line: i + 1,
					message: `'${snippet}' may be interpreted as an invalid HTML entity`,
					fixHint: `Use 'and' instead of '&' in plain text, or use '&amp;' for the literal ampersand.`,
				});
			}
		}
	}

	return issues;
}

// ── Extended Evidence-specific pattern detection ─────────────────────

function analyzeEvidencePatterns(content: string): RenderingIssue[] {
	const issues: RenderingIssue[] = [];

	// Pattern 1: _pct column names in stacked100 charts (CRITICAL)
	issues.push(...detectPctColumnsInStacked100(content));

	// Pattern 2: seriesColors keys that don't match y column references (HIGH)
	issues.push(...detectSeriesColorsMismatch(content));

	// Pattern 3: swapXY with non-category x-axis (MEDIUM)
	issues.push(...detectSwapXYWithNonCategoryX(content));

	// Pattern 4: swapXY with y2 axis (MEDIUM)
	issues.push(...detectSwapXYWithY2(content));

	// Pattern 5: yLog with stacked charts (MEDIUM)
	issues.push(...detectYLogWithStacked(content));

	// Pattern 6: data prop referencing non-existent query (LOW)
	issues.push(...detectMissingDataReference(content));

	return issues;
}

// ── Extension entry point ────────────────────────────────────────────

export default function evidenceRenderGuardExtension(pi: ExtensionAPI) {
	pi.on("tool_result", async (event) => {
		// Defensive: extract tool name and input from the event
		const e = event as any;

		// If the tool already failed, don't interfere
		if (e.isError) {
			return;
		}

		const toolName = e.tool || e.name || "";

		// Only check write and edit tools
		if (toolName !== "write" && toolName !== "edit") {
			return;
		}

		const input = e.input || {};
		const path = input.path;

		// Only check .md files in pages/ directories
		if (!path || typeof path !== "string") return;
		if (!path.endsWith(".md")) return;
		if (!path.includes("/pages/")) return;

		// Read the file from disk to get the final content
		if (!existsSync(path)) {
			return;
		}

		const content = readFileSync(path, "utf8");
		const svelteIssues = analyzeEvidenceMarkdown(content);
		const evidenceIssues = analyzeEvidencePatterns(content);
		const issues = [...svelteIssues, ...evidenceIssues];

		if (issues.length > 0) {
			return {
				content: [
					"The file was written but contains CRITICAL rendering errors that will crash the Evidence page:",
					...issues.map((i) => `  Line ${i.line}: ${i.message}. ${i.fixHint}`),
					"",
					"Please fix these issues and rewrite the file before proceeding.",
				].join("\n"),
				isError: true,
			};
		}
	});
}
