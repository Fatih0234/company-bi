export function rowsToCsv(rows: Array<Record<string, unknown>>): string {
  const columns = collectColumns(rows);
  const lines = [columns.map(csvEscape).join(",")];
  for (const row of rows) lines.push(columns.map((col) => csvEscape(row[col])).join(","));
  return `${lines.join("\n")}\n`;
}

export function rowsToJsonl(rows: Array<Record<string, unknown>>): string {
  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

export function rowsToMarkdown(rows: Array<Record<string, unknown>>): string {
  const columns = collectColumns(rows);
  if (columns.length === 0) return "| result |\n|---|\n";
  const header = `| ${columns.map(escapeMarkdownCell).join(" | ")} |`;
  const sep = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${columns.map((col) => escapeMarkdownCell(row[col])).join(" | ")} |`);
  return `${[header, sep, ...body].join("\n")}\n`;
}

export function collectColumns(rows: Array<Record<string, unknown>>): string[] {
  const cols = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) cols.add(key);
  return [...cols];
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeMarkdownCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}
