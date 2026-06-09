import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { TOOL_NAMES } from "../constants";
import type { DuckDbBiConfig } from "../types";
import { readAuditEntries } from "../lib/audit-log";
import { ensureRuntimeDirs, toProjectRelative, withProjectRoot } from "../lib/paths";
import { toolResponse } from "../lib/tool-result";

const Parameters = Type.Object({
  limit: Type.Optional(Type.Number({ default: 50, minimum: 1, maximum: 500 })),
  status: Type.Optional(StringEnum(["ok", "error", "blocked"] as const)),
  tool_name: Type.Optional(Type.String()),
  since: Type.Optional(Type.String()),
});

export function registerQueryAuditLogTool(pi: ExtensionAPI, baseConfig: DuckDbBiConfig) {
  pi.registerTool(defineTool({
    name: TOOL_NAMES.queryAuditLog,
    label: "DuckDB: Query Audit Log",
    description: "Read recent DuckDB BI query audit entries for reproducibility.",
    parameters: Parameters,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const config = withProjectRoot(baseConfig, ctx.cwd ?? process.cwd());
      await ensureRuntimeDirs(config);
      const entries = await readAuditEntries(config, params);
      return toolResponse({ ok: true, audit_log_path: toProjectRelative(config, config.auditLogPath), entries });
    },
  }));
}
