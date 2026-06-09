import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createConfig, ensureRuntimeDirs, withProjectRoot } from "./src/lib/paths";
import { registerDuckDbBiTools } from "./src/register-tools";

export default function duckDbBiExtension(pi: ExtensionAPI) {
  const baseConfig = createConfig(process.cwd());
  registerDuckDbBiTools(pi, baseConfig);

  pi.on("session_start", async (_event, ctx) => {
    const config = withProjectRoot(baseConfig, ctx.cwd ?? process.cwd());
    await ensureRuntimeDirs(config);
    ctx.ui.setStatus("duckdb-bi", "DuckDB BI tools loaded");
    ctx.ui.notify("DuckDB BI tools loaded", "info");
  });
}
