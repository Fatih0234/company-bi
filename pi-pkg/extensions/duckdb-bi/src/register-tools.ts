import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { DuckDbBiConfig } from "./types";
import { registerRunSqlTool } from "./tools/run-sql";
import { registerListTablesTool } from "./tools/list-tables";
import { registerDescribeTableTool } from "./tools/describe-table";
import { registerSampleRowsTool } from "./tools/sample-rows";
import { registerSummarizeTableTool } from "./tools/summarize-table";
import { registerQualityReportTool } from "./tools/quality-report";
import { registerExportQueryTool } from "./tools/export-query";
import { registerDataSourcesTool } from "./tools/data-sources";
import { registerMakeReportTool } from "./tools/make-report";
import { registerQueryAuditLogTool } from "./tools/query-audit-log";
import { registerJoinCoverageTool } from "./tools/join-coverage";
import { registerDataAttachCommand } from "./tools/data-attach";

export function registerDuckDbBiTools(pi: ExtensionAPI, config: DuckDbBiConfig) {
  registerRunSqlTool(pi, config);
  registerListTablesTool(pi, config);
  registerDescribeTableTool(pi, config);
  registerSampleRowsTool(pi, config);
  registerSummarizeTableTool(pi, config);
  registerQualityReportTool(pi, config);
  registerExportQueryTool(pi, config);
  registerDataSourcesTool(pi, config);
  registerMakeReportTool(pi, config);
  registerQueryAuditLogTool(pi, config);
  registerJoinCoverageTool(pi, config);
  registerDataAttachCommand(pi);
}
