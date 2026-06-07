import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { ERROR_CODES, TOOL_NAMES } from "../constants";
import type { DuckDbBiConfig } from "../types";
import { ensureRuntimeDirs, withProjectRoot } from "../lib/paths";
import { writeMarkdownReport } from "../lib/report-writer";
import { toolResponse } from "../lib/tool-result";

const Section = Type.Object({
  heading: Type.String(),
  narrative: Type.String(),
  query_ids: Type.Optional(Type.Array(Type.String())),
  artifact_paths: Type.Optional(Type.Array(Type.String())),
  table_markdown: Type.Optional(Type.String()),
});

const Parameters = Type.Object({
  title: Type.String(),
  summary: Type.String(),
  sections: Type.Array(Section),
  output_name: Type.Optional(Type.String()),
});

export function registerMakeReportTool(pi: ExtensionAPI, baseConfig: DuckDbBiConfig) {
  pi.registerTool(defineTool({
    name: TOOL_NAMES.makeReport,
    label: "DuckDB: Make Report",
    description: "Write a Markdown BI report under .pi/duckdb/reports/ from findings, query IDs, and exported artifacts.",
    parameters: Parameters,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const config = withProjectRoot(baseConfig, ctx.cwd ?? process.cwd());
      await ensureRuntimeDirs(config);
      try {
        const report = await writeMarkdownReport(config, params);
        return toolResponse({ ok: true, report_path: report.reportPath, artifact_paths: report.artifactPaths, sections_written: report.sectionsWritten });
      } catch (err) {
        return toolResponse({ ok: false, error: { code: ERROR_CODES.reportFailed, message: (err as Error).message } });
      }
    },
  }));
}
