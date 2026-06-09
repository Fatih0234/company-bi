/**
 * /data-attach command — open macOS file picker, copy files to workspace data/,
 * run data refresh, and report registered tables.
 *
 * Workspace-native: defaults to data/ in the current workspace, auto-runs refresh.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CopyResult =
  | { sourcePath: string; destinationPath: string; ok: true }
  | { sourcePath: string; error: string; ok: false };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPPORTED_EXTENSIONS = new Set([".csv", ".tsv", ".parquet", ".json", ".jsonl"]);
const HELP_TEXT = `
Usage:
  /data-attach [destination]

Examples:
  /data-attach              — attach files to workspace data/ (default)
  /data-attach ./imports    — attach files to a custom directory

Behavior:
  - Opens a macOS file picker filtered to CSV, TSV, Parquet, JSON, JSONL.
  - Copies selected files to the destination (default: data/).
  - Automatically runs data refresh to register the files.
  - Existing files are never overwritten; conflicts get suffixes like file-1.csv.
`.trim();

// ---------------------------------------------------------------------------
// macOS picker
// ---------------------------------------------------------------------------

function quoteAppleScriptString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function appleScriptList(values: string[]): string {
  return `{${values.map(quoteAppleScriptString).join(", ")}}`;
}

async function runAppleScript(script: string): Promise<string> {
  const { stdout } = await execFileAsync("osascript", ["-e", script], {
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

async function chooseFiles(): Promise<string[]> {
  // macOS UTIs for supported data formats
  const utis = [
    "public.comma-separated-values-text",  // CSV
    "public.utf8-plain-text",               // TSV / fallback
    "org.parquet-dev.parquet",              // Parquet (may not be registered)
    "public.json",                          // JSON
    "public.utf8-plain-text",               // JSONL fallback
  ];

  const script = `
set chosenFiles to choose file with prompt "Choose data files to attach:" with multiple selections allowed
set output to ""
repeat with chosenFile in chosenFiles
  set output to output & POSIX path of chosenFile & linefeed
end repeat
return output
`;

  const output = await runAppleScript(script);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isUserCancel(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; stderr?: unknown; stdout?: unknown; message?: unknown };
  const text = [candidate.code, candidate.stderr, candidate.stdout, candidate.message]
    .filter((v) => v !== undefined && v !== null)
    .join("\n");
  return text.includes("-128") || /user canceled/i.test(text);
}

// ---------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------

async function ensureRegularFile(filePath: string): Promise<void> {
  const stat = await fs.lstat(filePath);
  if (!stat.isFile()) throw new Error(`Not a regular file: ${filePath}`);
  if (stat.isSymbolicLink()) throw new Error(`Refusing to copy symlink: ${filePath}`);
}

function isSupportedExtension(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function uniqueDestinationPath(destinationPath: string): Promise<string> {
  const parsed = path.parse(destinationPath);
  let candidate = destinationPath;
  let counter = 1;
  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(parsed.dir, `${parsed.name}-${counter}${parsed.ext}`);
      counter += 1;
    } catch {
      return candidate;
    }
  }
}

async function copyFile(sourcePath: string, destinationFolder: string): Promise<CopyResult> {
  try {
    await ensureRegularFile(sourcePath);

    const destPath = await uniqueDestinationPath(path.join(destinationFolder, path.basename(sourcePath)));
    await fs.copyFile(sourcePath, destPath);

    return { sourcePath, destinationPath: destPath, ok: true };
  } catch (error) {
    return { sourcePath, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ---------------------------------------------------------------------------
// Data refresh
// ---------------------------------------------------------------------------

async function runDataRefresh(workspaceRoot: string): Promise<{ ok: boolean; output: string }> {
  // Find cmux-evidence CLI — walk up from workspace to project root
  let candidate = workspaceRoot;
  for (let i = 0; i < 5; i++) {
    const cliPath = path.join(candidate, "bin", "cmux-evidence");
    try {
      await fs.access(cliPath);
      const { stdout, stderr } = await execFileAsync("python3", [cliPath, "data", "refresh"], {
        cwd: workspaceRoot,
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
      });
      return { ok: true, output: stdout || stderr };
    } catch {
      // Try parent
    }
    candidate = path.dirname(candidate);
  }

  return { ok: false, output: "Could not find cmux-evidence CLI" };
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function toRelative(cwd: string, filePath: string): string {
  const rel = path.relative(cwd, filePath);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : filePath;
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerDataAttachCommand(pi: ExtensionAPI) {
  pi.registerCommand("data-attach", {
    description:
      "Open macOS file picker, copy data files to workspace, and register them as Evidence source tables",

    handler: async (args, ctx) => {
      // Platform check
      if (process.platform !== "darwin") {
        ctx.ui.notify("/data-attach is currently macOS-only (uses AppleScript file picker).", "error");
        return;
      }

      // Help
      const trimmed = (args ?? "").trim();
      if (trimmed === "--help" || trimmed === "-h") {
        pi.sendUserMessage(HELP_TEXT);
        return;
      }

      try {
        // Resolve destination: default to data/ in workspace root
        const workspaceRoot = ctx.cwd ?? process.cwd();
        const destination = trimmed
          ? path.resolve(workspaceRoot, trimmed)
          : path.join(workspaceRoot, "data");

        // Open file picker
        ctx.ui.notify("Opening file picker…", "info");

        let selectedFiles: string[];
        try {
          selectedFiles = await chooseFiles();
        } catch (error) {
          if (isUserCancel(error)) {
            ctx.ui.notify("File selection cancelled.", "warning");
            return;
          }
          throw error;
        }

        if (selectedFiles.length === 0) {
          ctx.ui.notify("No files selected.", "warning");
          return;
        }

        // Filter to supported extensions
        const supported = selectedFiles.filter(isSupportedExtension);
        const skipped = selectedFiles.length - supported.length;

        if (supported.length === 0) {
          ctx.ui.notify(
            `No supported files selected. Supported: ${[...SUPPORTED_EXTENSIONS].join(", ")}`,
            "warning",
          );
          return;
        }

        // Ensure destination exists
        await fs.mkdir(destination, { recursive: true });

        // Copy files
        ctx.ui.notify(`Copying ${supported.length} file(s)…`, "info");
        const results: CopyResult[] = [];
        for (const sourcePath of supported) {
          results.push(await copyFile(sourcePath, destination));
        }

        const successes = results.filter((r) => r.ok);
        const failures = results.filter((r) => !r.ok);

        if (successes.length === 0) {
          ctx.ui.notify(`All ${failures.length} file(s) failed to copy.`, "error");
          return;
        }

        // Run data refresh
        ctx.ui.notify("Registering data files…", "info");
        const refreshResult = await runDataRefresh(workspaceRoot);

        // Build result message
        const lines: string[] = [];
        lines.push(`Attached ${successes.length} file(s).`);
        if (skipped > 0) lines.push(`Skipped ${skipped} unsupported file(s).`);
        if (failures.length > 0) lines.push(`${failures.length} file(s) failed to copy.`);
        lines.push("");
        lines.push(`Destination: ${toRelative(workspaceRoot, destination)}`);
        lines.push("");
        lines.push("Saved files:");
        for (const r of successes) {
          lines.push(`  ${toRelative(workspaceRoot, r.destinationPath)}`);
        }

        if (refreshResult.ok) {
          // Parse registered tables from refresh output
          const tableLines = refreshResult.output
            .split("\n")
            .filter((line) => line.trim().startsWith("files."));
          if (tableLines.length > 0) {
            lines.push("");
            lines.push("Registered tables:");
            for (const line of tableLines) {
              lines.push(`  ${line.trim()}`);
            }
          }
          lines.push("");
          lines.push("These tables are now available in Evidence page SQL.");
        } else {
          lines.push("");
          lines.push("Warning: data refresh could not be run automatically.");
          lines.push("Run manually: cmux-evidence data refresh");
        }

        const message = lines.join("\n");

        // Notify and send session message
        const status = failures.length > 0
          ? `Attached ${successes.length} file(s), ${failures.length} failed.`
          : `Attached ${successes.length} file(s).`;
        ctx.ui.notify(status, failures.length > 0 ? "warning" : "info");

        if (ctx.isIdle()) {
          pi.sendUserMessage(message);
        } else {
          pi.sendUserMessage(message, { deliverAs: "followUp" });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`data-attach failed: ${message}`, "error");
      }
    },
  });
}
