/**
 * Evidence Quality Guard - Static Analysis
 *
 * Detects Svelte/HTML rendering issues in Evidence markdown files.
 * Reuses and extends logic from evidence-render-guard.ts.
 */

import type { RenderingIssue } from './types.ts';

// ── Known Valid Components ──────────────────────────────────────────

const EVIDENCE_COMPONENTS = new Set([
  // Charts
  'BigValue', 'BarChart', 'LineChart', 'AreaChart', 'BubbleChart', 'CalendarHeatmap',
  'FunnelChart', 'Histogram', 'PieChart', 'ScatterPlot', 'ReferenceLine', 'ReferenceArea',
  'ReferencePoint', 'SankeyChart', 'BoxPlot', 'USMap', 'AreaMap', 'BaseMap', 'BubbleMap',
  // Chart sub-components
  'Areas', 'Bubbles', 'Points', 'Value',
  // Data components
  'DataTable', 'Column', 'Grid',
  // UI components
  'Tabs', 'Tab', 'Accordion', 'Alert', 'Button', 'ButtonGroup', 'ButtonGroupItem',
  'Callout', 'Checkbox', 'CodeBlock', 'DimensionGrid', 'DownloadData',
  // Form components
  'DateInput', 'DateRange', 'Dropdown', 'EmailInput', 'MultiSelect', 'MonthRange',
  'NumberInput', 'Pagination', 'SearchBar', 'Select', 'Slider', 'TextInput', 'URLInput',
  // Content components
  'Info', 'LinkButton', 'MissingValue', 'QueryViewer', 'ResetButton', 'Sidebar',
  'Spacing', 'Tag', 'TextInput', 'Toggle', 'ValueError',
  // Legend components
  'CategoricalLegend', 'ContinuousLegend', 'Legend',
  // Utility components
  'LastRefreshed',
]);

const HTML_TAGS = new Set([
  'div', 'span', 'p', 'a', 'img', 'br', 'hr', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'b', 'i', 'u', 's',
  'strike', 'del', 'ins', 'sub', 'sup', 'code', 'pre', 'blockquote', 'details', 'summary',
  'figure', 'figcaption', 'iframe', 'script', 'style', 'form', 'input', 'label', 'textarea',
  'select', 'option', 'nav', 'header', 'footer', 'main', 'article', 'section', 'aside',
  'html', 'body', 'head', 'title', 'meta', 'link', 'canvas', 'svg', 'path', 'g', 'rect',
  'circle', 'line', 'polyline', 'polygon', 'text', 'tspan', 'defs', 'clipPath', 'mask',
]);

const VALID_ENTITIES = new Set([
  'amp', 'lt', 'gt', 'quot', 'apos', 'nbsp', 'copy', 'reg', 'trade', 'hellip',
  'mdash', 'ndash', 'ldquo', 'rdquo', 'lsquo', 'rsquo', 'laquo', 'raquo',
  'deg', 'times', 'divide', 'plusmn', 'frac14', 'frac12', 'frac34', 'sup1',
  'sup2', 'sup3', 'micro', 'para', 'middot', 'bull', 'cent', 'pound', 'yen',
  'euro', 'sect', 'circ', 'tilde', 'ensp', 'emsp', 'thinsp', 'zwnj', 'zwj',
  'lrm', 'rlm', 'dagger', 'Dagger', 'permil', 'lsaquo', 'rsaquo',
]);

const MARKDOWN_LIST_COMPONENT_EXEMPTIONS = new Set(['Grid', 'Tabs', 'Tab']);

// ── Chart Component Extraction ──────────────────────────────────────

interface ChartComponent {
  name: string;
  line: number;
  props: Record<string, string>;
}

function extractChartComponents(content: string): ChartComponent[] {
  const charts: ChartComponent[] = [];
  const lines = content.split('\n');
  
  let inComponent = false;
  let currentComponent = '';
  let currentComponentStart = 0;
  let componentName = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for chart component start
    const componentStartMatch = line.match(
      /^<(BarChart|AreaChart|LineChart|BubbleChart|ScatterPlot|Histogram|PieChart|FunnelChart|CalendarHeatmap|SankeyChart)/,
    );
    
    if (componentStartMatch) {
      inComponent = true;
      componentName = componentStartMatch[1];
      currentComponentStart = i + 1;
      currentComponent = line;
      
      // Self-closing on same line
      if (line.includes('/>')) {
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
      currentComponent += ' ' + line;
      
      if (line.includes('/>') || line.includes('>')) {
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

function parseComponentProps(componentStr: string): Record<string, string> {
  const props: Record<string, string> = {};
  const propRegex = /(\w+)=(?:"([^"]*)"|(\{[^}]*\})|([^\s/>]+))/g;
  let match;
  
  while ((match = propRegex.exec(componentStr)) !== null) {
    const key = match[1];
    const value = match[2] || match[3] || match[4];
    props[key] = value;
  }
  
  return props;
}

function extractYColumns(yProp: string): string[] {
  if (!yProp) return [];
  
  let y = yProp;
  if (y.startsWith('{') && y.endsWith('}')) {
    y = y.slice(1, -1);
  }
  
  if (y.startsWith('[') && y.endsWith(']')) {
    try {
      return JSON.parse(y);
    } catch {
      const cols: string[] = [];
      const colRegex = /["']([^"']+)["']/g;
      let match;
      while ((match = colRegex.exec(y)) !== null) {
        cols.push(match[1]);
      }
      return cols;
    }
  }
  
  if ((y.startsWith("'") && y.endsWith("'")) || (y.startsWith('"') && y.endsWith('"'))) {
    y = y.slice(1, -1);
  }
  
  return [y];
}

function extractSeriesColorsKeys(seriesColorsProp: string): string[] {
  if (!seriesColorsProp) return [];
  
  const keys: string[] = [];
  let sc = seriesColorsProp;
  
  if (sc.startsWith('{') && sc.endsWith('}')) {
    sc = sc.slice(1, -1);
  }
  
  const keyRegex = /['"]([^'"]+)['"]\s*:/g;
  let match;
  while ((match = keyRegex.exec(sc)) !== null) {
    keys.push(match[1]);
  }
  
  return keys;
}

// ── Chart Title Quality Patterns ──────────────────────────────────

// Generic/descriptive title patterns (should be improved)
const GENERIC_TITLE_PATTERNS = [
  /^(Revenue|Sales|Count|Total|Number|Amount|Trips|Fares)\s+(by|per|over|vs|and|from|in)\s+/i,
  /^(Top\s+\d+)/i,
  /^(Monthly|Weekly|Daily|Quarterly|Yearly|Hourly)\s+/i,
  /^(Distribution|Breakdown|Summary|Overview|Analysis)\s+of/i,
  /^(Chart|Graph|Table|Visualization)\s+of/i,
  /^(\w+)\s+by\s+(\w+)/i,
  /^(\w+)\s+over\s+time$/i,
  /^(Average|Median|Sum|Max|Min)\s+/i,
];

// Good title patterns (insight-first)
const INSIGHT_TITLE_PATTERNS = [
  /^(Revenue|Sales|Count|Trips)\s+(increased|decreased|peaked|dropped|grew|fell|surged|plummeted)/i,
  /^(Most|Fewest|Highest|Lowest|Best|Worst|Top|Bottom)\s+/i,
  /^(Why|How|What|Where|When)\s+/i,
  /^[A-Z][a-z]+\s+(dominates|leads|outperforms|underperforms|generates|captures)/i,
  /(\d+)x\s+(more|less|higher|lower|faster|slower)/i,
  /(increased|decreased|grew|fell|peaked|dropped)\s+by/i,
];

/**
 * Check for generic/descriptive chart titles that should be insight-first.
 */
function detectGenericChartTitles(content: string): RenderingIssue[] {
  const issues: RenderingIssue[] = [];
  const charts = extractChartComponents(content);
  
  for (const chart of charts) {
    const title = chart.props.title;
    if (!title) continue;
    
    // Clean the title
    let cleanTitle = title;
    if (cleanTitle.startsWith('"') && cleanTitle.endsWith('"')) {
      cleanTitle = cleanTitle.slice(1, -1);
    }
    if (cleanTitle.startsWith("'") && cleanTitle.endsWith("'")) {
      cleanTitle = cleanTitle.slice(1, -1);
    }
    
    // Check if title is generic
    const isGeneric = GENERIC_TITLE_PATTERNS.some(p => p.test(cleanTitle));
    const isInsightFirst = INSIGHT_TITLE_PATTERNS.some(p => p.test(cleanTitle));
    
    if (isGeneric && !isInsightFirst) {
      issues.push({
        line: chart.line,
        message: `Chart title "${cleanTitle}" is descriptive, not insight-first. Titles should tell the reader what to notice.`,
        fixHint: `Use an insight-first title like: "Airports generate 3x more revenue per trip" instead of "Revenue by service zone"`,
        severity: 'warning',
      });
    }
  }
  
  return issues;
}

/**
 * Check if charts have interpretation text after them.
 */
function detectMissingInterpretation(content: string): RenderingIssue[] {
  const issues: RenderingIssue[] = [];
  const lines = content.split('\n');
  const charts = extractChartComponents(content);
  
  for (const chart of charts) {
    // Find the line where this chart ends
    let chartEndLine = chart.line;
    for (let i = chart.line - 1; i < Math.min(chart.line + 10, lines.length); i++) {
      if (lines[i].includes('/>') || (lines[i].includes('>') && !lines[i].includes('='))) {
        chartEndLine = i + 1;
        break;
      }
    }
    
    // Check next 3 lines for interpretation text
    let hasInterpretation = false;
    for (let i = chartEndLine; i < Math.min(chartEndLine + 4, lines.length); i++) {
      const nextLine = lines[i]?.trim() || '';
      
      // Skip empty lines, components, and code blocks
      if (!nextLine || nextLine.startsWith('<') || nextLine.startsWith('```') || nextLine.startsWith('#')) {
        continue;
      }
      
      // If we find text that's not a component, it's likely interpretation
      if (nextLine.length > 20 && !nextLine.startsWith('-') && !nextLine.startsWith('|')) {
        hasInterpretation = true;
        break;
      }
    }
    
    if (!hasInterpretation) {
      issues.push({
        line: chartEndLine,
        message: `No interpretation text found after ${chart.name}. Charts should be followed by a sentence explaining the insight.`,
        fixHint: `Add a paragraph after the chart explaining what the data shows and why it matters.`,
        severity: 'info',
      });
    }
  }
  
  return issues;
}

// ── Issue Detection Functions ───────────────────────────────────────

/**
 * Check for fmt= values that break Svelte attribute parsing.
 * Svelte treats spaces and quotes inside attribute values as tag boundaries,
 * causing 'Expected >' errors at runtime (500 page).
 */
function detectSvelteFmtHazards(content: string): RenderingIssue[] {
  const issues: RenderingIssue[] = [];
  const lines = content.split('\n');

  // Match Evidence component tags that contain fmt= with dangerous characters
  const componentPattern = /<(?:BigValue|Value|BarChart|LineChart|AreaChart|BubbleChart|ScatterPlot|Histogram|PieChart|FunnelChart|CalendarHeatmap|SankeyChart|BoxPlot|DataTable|Column|Grid|Sparkline|ReferenceLine|ReferenceArea|ReferencePoint|DownloadData|QueryViewer)\b[^>]*>/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match: RegExpExecArray | null;

    // Reset lastIndex for each line
    componentPattern.lastIndex = 0;

    while ((match = componentPattern.exec(line)) !== null) {
      const tag = match[0];

      // Check for fmt= with spaces, quotes, or angle brackets
      const fmtRegex = /\bfmt=([^\s/>]+)/gi;
      let fmtMatch: RegExpExecArray | null;

      while ((fmtMatch = fmtRegex.exec(tag)) !== null) {
        const fmtValue = fmtMatch[1];

        // Strip surrounding quotes if present
        const unquoted = fmtValue.replace(/^["']|["']$/g, '');

        // Dangerous: contains space, unbalanced quotes, or angle bracket
        if (/[\s"']/.test(unquoted) || unquoted.includes('<')) {
          issues.push({
            line: i + 1,
            message: `fmt="${fmtValue}" contains characters that break Svelte parsing. Use a safe format like fmt=num0, fmt=$#,##0, or fmt=pct1. Put unit labels in the title prop or markdown text instead.`,
            fixHint: `Replace fmt="${fmtValue}" with a safe format. If you need a unit label, add it to the title prop: title="Revenue (USD)" instead of fmt=$#,##0.00 USD.`,
            severity: 'error',
          });
        }
      }
    }
  }

  return issues;
}

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
        severity: 'error',
      });
    }
  }
  
  return issues;
}

function detectSeriesColorsMismatch(content: string): RenderingIssue[] {
  const issues: RenderingIssue[] = [];
  const charts = extractChartComponents(content);
  
  for (const chart of charts) {
    const seriesColorsKeys = extractSeriesColorsKeys(chart.props.seriesColors);
    if (seriesColorsKeys.length === 0) continue;
    
    const yColumns = extractYColumns(chart.props.y);
    if (yColumns.length === 0) continue;
    
    for (const key of seriesColorsKeys) {
      if (!yColumns.includes(key)) {
        issues.push({
          line: chart.line,
          message: `seriesColors key '${key}' does not match any y column`,
          fixHint: `Ensure seriesColors keys match the y column names. Current y columns: ${yColumns.join(', ')}`,
          severity: 'error',
        });
      }
    }
  }
  
  return issues;
}

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
        severity: 'error',
      });
    }
  }
  
  return issues;
}

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
        severity: 'error',
      });
    }
  }
  
  return issues;
}

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
        severity: 'error',
      });
    }
  }
  
  return issues;
}

function detectMarkdownListsInsideComponents(content: string): RenderingIssue[] {
  const issues: RenderingIssue[] = [];
  const lines = content.split('\n');
  const componentStack: Array<{ name: string; line: number }> = [];

  let inCodeBlock = false;
  let inFrontMatter = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    if (trimmed === '---') {
      inFrontMatter = !inFrontMatter;
      continue;
    }
    if (inFrontMatter) continue;

    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const activeComponent = [...componentStack]
      .reverse()
      .find(component => !MARKDOWN_LIST_COMPONENT_EXEMPTIONS.has(component.name));

    if (activeComponent && /^(\s*)([-*+]\s+|\d+\.\s+)/.test(line)) {
      issues.push({
        line: lineNum,
        message: `Markdown list item found inside <${activeComponent.name}>. Markdown lists inside Evidence components can produce invalid nested HTML and leave the component open.`,
        fixHint: `Move the list outside <${activeComponent.name}> or use explicit HTML <ul><li>...</li></ul> inside the component.`,
        severity: 'error',
      });
    }

    const tagRegex = /<\/?([A-Z][A-Za-z0-9]*)\b[^>]*>/g;
    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(line)) !== null) {
      const fullTag = match[0];
      const componentName = match[1];
      if (!EVIDENCE_COMPONENTS.has(componentName)) continue;

      if (fullTag.startsWith('</')) {
        const stackIndex = componentStack.map(c => c.name).lastIndexOf(componentName);
        if (stackIndex >= 0) {
          componentStack.splice(stackIndex, 1);
        }
        continue;
      }

      if (!fullTag.endsWith('/>')) {
        componentStack.push({ name: componentName, line: lineNum });
      }
    }
  }

  return issues;
}

// ── Front Matter Validation ─────────────────────────────────────────

/**
 * Validate YAML frontmatter syntax.
 * Detects common issues that crash Evidence's YAML parser.
 */
function analyzeFrontMatter(lines: string[]): RenderingIssue[] {
  const issues: RenderingIssue[] = [];
  
  // Find frontmatter boundaries
  let frontMatterStart = -1;
  let frontMatterEnd = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      if (frontMatterStart === -1) {
        frontMatterStart = i;
      } else {
        frontMatterEnd = i;
        break;
      }
    }
  }
  
  if (frontMatterStart === -1 || frontMatterEnd === -1) {
    return issues; // No frontmatter found
  }
  
  // Validate each line in frontmatter
  for (let i = frontMatterStart + 1; i < frontMatterEnd; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) continue;
    
    // Check for unquoted colons in values (YAML parsing issue)
    // Pattern: key: value with colon in value that's not quoted
    const colonMatch = line.match(/^([\w-]+):\s*(.+)/);
    if (colonMatch) {
      const key = colonMatch[1];
      const value = colonMatch[2].trim();
      
      // Check if value contains unquoted colon
      if (value.includes(':') && !value.startsWith('"') && !value.startsWith("'")) {
        issues.push({
          line: lineNum,
          message: `YAML value '${value}' contains unquoted colon that will crash the parser`,
          fixHint: `Quote the value: ${key}: "${value}"`,
          severity: 'error',
        });
      }
      
      // Check for unquoted special characters
      if (value.includes('{') || value.includes('[') || value.includes('&')) {
        if (!value.startsWith('"') && !value.startsWith("'")) {
          issues.push({
            line: lineNum,
            message: `YAML value '${value}' contains special characters that should be quoted`,
            fixHint: `Quote the value: ${key}: "${value}"`,
            severity: 'error',
          });
        }
      }
    }
  }
  
  return issues;
}

// ── Markdown Analysis ───────────────────────────────────────────────

function analyzeMarkdownSyntax(content: string): RenderingIssue[] {
  const issues: RenderingIssue[] = [];
  const lines = content.split('\n');
  
  let inCodeBlock = false;
  let inFrontMatter = false;
  
  // Validate frontmatter first
  issues.push(...analyzeFrontMatter(lines));
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Front matter
    if (line === '---') {
      inFrontMatter = !inFrontMatter;
      continue;
    }
    if (inFrontMatter) continue;
    
    // Code blocks
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    
    // Check non-code parts
    const parts = line.split('`');
    for (let j = 0; j < parts.length; j += 2) {
      const text = parts[j];
      
      // Check for literal comparisons like <50%, <$100, or <3 items.
      // Svelte parses these as invalid HTML tags unless escaped or reworded.
      const dangerousAngleRegex = /<(?=\d|[$€£¥]|[+\-=~])\S*/g;
      let match;
      while ((match = dangerousAngleRegex.exec(text)) !== null) {
        const snippet = text.slice(match.index, Math.min(match.index + 15, text.length));
        issues.push({
          line: i + 1,
          message: `'${snippet}' will crash the Svelte renderer with 'Expected valid tag name'`,
          fixHint: `Avoid '<' followed by numbers or symbols in plain text. Use 'under', 'less than', or '&lt;' instead.`,
          severity: 'error',
        });
      }
      
      // Check for HTML tags (Evidence components and standard HTML tags are allowed)
      const tagRegex = /<([a-zA-Z][a-zA-Z0-9_-]*)/g;
      while ((match = tagRegex.exec(text)) !== null) {
        const tagName = match[1];
        // Allow Evidence components and standard HTML tags
        if (EVIDENCE_COMPONENTS.has(tagName) || HTML_TAGS.has(tagName.toLowerCase())) {
          continue;
        }
        const snippet = text.slice(match.index, Math.min(match.index + 15, text.length));
        issues.push({
          line: i + 1,
          message: `'${snippet}' will be parsed as an invalid HTML tag by the Svelte renderer`,
          fixHint: `Use Evidence components or valid HTML tags, or wrap in code blocks`,
          severity: 'error',
        });
      }
      
      // Check for invalid HTML entities
      const ampRegex = /&([a-zA-Z][a-zA-Z0-9]*|#[0-9]+|#x[0-9a-fA-F]+)/g;
      while ((match = ampRegex.exec(text)) !== null) {
        const entity = match[1];
        if (VALID_ENTITIES.has(entity.toLowerCase())) continue;
        if (entity.startsWith('#') && /^#[0-9]+$/.test(entity)) continue;
        if ((entity.startsWith('#x') || entity.startsWith('#X')) && /^#x[0-9a-fA-F]+$/.test(entity)) continue;
        
        const snippet = text.slice(match.index, Math.min(match.index + 15, text.length));
        issues.push({
          line: i + 1,
          message: `'${snippet}' may be interpreted as an invalid HTML entity`,
          fixHint: `Use 'and' instead of '&' in plain text, or use '&amp;' for the literal ampersand`,
          severity: 'warning',
        });
      }
    }
  }
  
  return issues;
}

// ── Main Analysis Function ──────────────────────────────────────────

/**
 * Run all static analysis checks on markdown content.
 */
export function analyzeEvidenceMarkdown(content: string): RenderingIssue[] {
  const issues: RenderingIssue[] = [];
  
  // Markdown syntax issues
  issues.push(...analyzeMarkdownSyntax(content));
  issues.push(...detectMarkdownListsInsideComponents(content));
  
  // Evidence-specific pattern issues
  issues.push(...detectSvelteFmtHazards(content));
  issues.push(...detectPctColumnsInStacked100(content));
  issues.push(...detectSeriesColorsMismatch(content));
  issues.push(...detectSwapXYWithNonCategoryX(content));
  issues.push(...detectSwapXYWithY2(content));
  issues.push(...detectYLogWithStacked(content));
  
  // Chart quality issues
  issues.push(...detectGenericChartTitles(content));
  issues.push(...detectMissingInterpretation(content));
  
  // Sort by line number
  issues.sort((a, b) => a.line - b.line);
  
  return issues;
}

/**
 * Convert RenderingIssues to ValidationErrors.
 */
export function renderingIssuesToErrors(issues: RenderingIssue[]): import('./types.js').ValidationError[] {
  return issues.map(issue => ({
    type: 'static_analysis' as const,
    message: issue.message,
    fixHint: issue.fixHint,
    line: issue.line,
  }));
}
