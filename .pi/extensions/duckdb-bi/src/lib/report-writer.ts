import { stat, writeFile } from "node:fs/promises";
import { resolveReportPath, safeOutputName, toProjectRelative } from "./paths";
import type { DuckDbBiConfig } from "../types";

export interface ReportSectionInput {
  heading: string;
  narrative: string;
  query_ids?: string[];
  artifact_paths?: string[];
  table_markdown?: string;
}

export async function writeMarkdownReport(
  config: DuckDbBiConfig,
  input: { title: string; summary: string; sections: ReportSectionInput[]; output_name?: string },
): Promise<{ reportPath: string; artifactPaths: string[]; sectionsWritten: number }> {
  const filename = safeOutputName(input.output_name, slug(input.title || "duckdb-bi-report"), "md");
  const outputPath = resolveReportPath(config, filename);
  const artifactPaths = Array.from(new Set(input.sections.flatMap((section) => section.artifact_paths ?? [])));
  const queryIds = Array.from(new Set(input.sections.flatMap((section) => section.query_ids ?? [])));

  const lines: string[] = [];
  lines.push(`# ${input.title}`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Executive summary");
  lines.push("");
  lines.push(input.summary.trim());
  lines.push("");

  if (queryIds.length || artifactPaths.length) {
    lines.push("## Methodology and evidence");
    lines.push("");
    if (queryIds.length) lines.push(`Queries referenced: ${queryIds.map((id) => `\`${id}\``).join(", ")}`);
    if (artifactPaths.length) {
      lines.push("Artifacts:");
      for (const artifact of artifactPaths) lines.push(`- ${artifact}`);
    }
    lines.push("");
  }

  for (const section of input.sections) {
    lines.push(`## ${section.heading}`);
    lines.push("");
    lines.push(section.narrative.trim());
    lines.push("");
    if (section.table_markdown) {
      lines.push(section.table_markdown.trim());
      lines.push("");
    }
    if (section.query_ids?.length) {
      lines.push(`Query IDs: ${section.query_ids.map((id) => `\`${id}\``).join(", ")}`);
      lines.push("");
    }
    if (section.artifact_paths?.length) {
      lines.push("Artifacts:");
      for (const artifact of section.artifact_paths) lines.push(`- ${artifact}`);
      lines.push("");
    }
  }

  await writeFile(outputPath, `${lines.join("\n").trimEnd()}\n`, "utf8");
  await stat(outputPath);
  return {
    reportPath: toProjectRelative(config, outputPath),
    artifactPaths,
    sectionsWritten: input.sections.length,
  };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "duckdb-bi-report";
}
