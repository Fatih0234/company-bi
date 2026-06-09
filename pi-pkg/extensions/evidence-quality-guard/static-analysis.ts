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

// ── Issue Detection Functions ───────────────────────────────────────

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

// ── Markdown Analysis ───────────────────────────────────────────────

function analyzeMarkdownSyntax(content: string): RenderingIssue[] {
  const issues: RenderingIssue[] = [];
  const lines = content.split('\n');
  
  let inCodeBlock = false;
  let inFrontMatter = false;
  
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
      
      // Check for dangerous angle brackets
      const dangerousAngleRegex = /<(?![a-zA-Z\/\!])\S/g;
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
      
      // Check for HTML tags (only Evidence components are allowed in markdown)
      const tagRegex = /<([a-zA-Z][a-zA-Z0-9_-]*)/g;
      while ((match = tagRegex.exec(text)) !== null) {
        const tagName = match[1];
        // Only Evidence components are allowed in markdown
        // ALL other HTML tags (even valid ones like <div>) will crash Svelte
        if (EVIDENCE_COMPONENTS.has(tagName)) {
          continue;
        }
        const snippet = text.slice(match.index, Math.min(match.index + 15, text.length));
        issues.push({
          line: i + 1,
          message: `'${snippet}' will crash the Svelte renderer - HTML tags are not supported in Evidence markdown`,
          fixHint: `Use Evidence components instead of HTML tags, or wrap in code blocks`,
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
  
  // Evidence-specific pattern issues
  issues.push(...detectPctColumnsInStacked100(content));
  issues.push(...detectSeriesColorsMismatch(content));
  issues.push(...detectSwapXYWithNonCategoryX(content));
  issues.push(...detectSwapXYWithY2(content));
  issues.push(...detectYLogWithStacked(content));
  
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
