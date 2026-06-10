import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);

type ParsedArgs = {
  destination?: string;
  move: boolean;
  noMessage: boolean;
  dryRun: boolean;
  help: boolean;
  types: string[];
};

type CopyResult = {
  sourcePath: string;
  destinationPath: string;
  ok: true;
} | {
  sourcePath: string;
  error: string;
  ok: false;
};

const HELP_TEXT = `
Usage:
  /attach-files [destination] [--move] [--no-message] [--types pdf,png,jpg] [--dry-run]

Examples:
  /attach-files ./attachments
  /attach-files .pi/attachments --types pdf,png,jpg
  /attach-files ./incoming --move
  /attach-files --no-message

Behavior:
  - If destination is omitted, a macOS folder picker opens.
  - The file picker allows multiple selection.
  - Files are copied by default.
  - Existing files are never overwritten; conflicts get suffixes like file-1.pdf.
`.trim();

function tokenizeArgs(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaping = false;

  for (const char of input) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaping) {
    current += "\\";
  }

  if (quote) {
    throw new Error(`Unclosed ${quote} quote in arguments.`);
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function parseArgs(input: string): ParsedArgs {
  const tokens = tokenizeArgs(input);
  const parsed: ParsedArgs = {
    move: false,
    noMessage: false,
    dryRun: false,
    help: false,
    types: [],
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (token === "--help" || token === "-h") {
      parsed.help = true;
      continue;
    }

    if (token === "--move") {
      parsed.move = true;
      continue;
    }

    if (token === "--no-message") {
      parsed.noMessage = true;
      continue;
    }

    if (token === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (token === "--types") {
      const value = tokens[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--types requires a comma-separated value, for example: --types pdf,png,jpg");
      }

      parsed.types = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      i += 1;
      continue;
    }

    if (token.startsWith("--types=")) {
      parsed.types = token
        .slice("--types=".length)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      continue;
    }

    if (token.startsWith("--")) {
      throw new Error(`Unknown option: ${token}`);
    }

    if (parsed.destination) {
      throw new Error(`Unexpected extra argument: ${token}`);
    }

    parsed.destination = token;
  }

  return parsed;
}

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

function buildChooseFilesScript(types: string[]): string {
  const typeClause = types.length > 0 ? ` of type ${appleScriptList(types)}` : "";

  return `
set chosenFiles to choose file with prompt "Choose files to attach:"${typeClause} with multiple selections allowed
set output to ""
repeat with chosenFile in chosenFiles
  set output to output & POSIX path of chosenFile & linefeed
end repeat
return output
`;
}

async function chooseFiles(types: string[]): Promise<string[]> {
  const output = await runAppleScript(buildChooseFilesScript(types));

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function chooseFolder(): Promise<string> {
  const script = `
set chosenFolder to choose folder with prompt "Choose destination folder:"
return POSIX path of chosenFolder
`;

  return runAppleScript(script);
}

function isUserCancel(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    code?: unknown;
    stderr?: unknown;
    stdout?: unknown;
    message?: unknown;
  };

  const text = [
    candidate.code,
    candidate.stderr,
    candidate.stdout,
    candidate.message,
  ]
    .filter((value) => value !== undefined && value !== null)
    .join("\n");

  return text.includes("-128") || /user canceled/i.test(text);
}

async function ensureRegularFile(filePath: string): Promise<void> {
  const stat = await fs.lstat(filePath);

  if (!stat.isFile()) {
    throw new Error(`Not a regular file: ${filePath}`);
  }

  if (stat.isSymbolicLink()) {
    throw new Error(`Refusing to copy symlink: ${filePath}`);
  }
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

async function copyOrMoveFile(
  sourcePath: string,
  destinationFolder: string,
  move: boolean
): Promise<CopyResult> {
  try {
    await ensureRegularFile(sourcePath);

    const destinationPath = await uniqueDestinationPath(
      path.join(destinationFolder, path.basename(sourcePath))
    );

    if (move) {
      await fs.rename(sourcePath, destinationPath).catch(async (error: unknown) => {
        // Cross-device rename can fail with EXDEV. Fall back to copy+unlink.
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === "EXDEV"
        ) {
          await fs.copyFile(sourcePath, destinationPath);
          await fs.unlink(sourcePath);
          return;
        }

        throw error;
      });
    } else {
      await fs.copyFile(sourcePath, destinationPath);
    }

    return {
      sourcePath,
      destinationPath,
      ok: true,
    };
  } catch (error) {
    return {
      sourcePath,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function toDisplayPath(cwd: string, filePath: string): string {
  const relative = path.relative(cwd, filePath);

  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative;
  }

  return filePath;
}

function buildSessionMessage(
  cwd: string,
  results: CopyResult[],
  destinationFolder: string,
  dryRun: boolean,
  move: boolean
): string {
  const successes = results.filter((result): result is Extract<CopyResult, { ok: true }> => result.ok);
  const failures = results.filter((result): result is Extract<CopyResult, { ok: false }> => !result.ok);

  const lines: string[] = [];

  if (dryRun) {
    lines.push(`Dry run: selected ${results.length} file(s). No files were copied or moved.`);
  } else {
    lines.push(`${move ? "Moved" : "Attached"} ${successes.length} file(s).`);
  }

  lines.push("");
  lines.push(`Destination folder: ${toDisplayPath(cwd, destinationFolder)}`);

  if (successes.length > 0) {
    lines.push("");
    lines.push("Saved files:");
    for (const result of successes) {
      lines.push(`- ${toDisplayPath(cwd, result.destinationPath)}`);
    }
  }

  if (failures.length > 0) {
    lines.push("");
    lines.push("Failed files:");
    for (const result of failures) {
      lines.push(`- ${path.basename(result.sourcePath)}: ${result.error}`);
    }
  }

  lines.push("");
  lines.push("These files are now available in the project folder. Use file-reading tools if you need to inspect them.");

  return lines.join("\n");
}

async function resolveDestinationFolder(destinationArg: string | undefined, cwd: string): Promise<string> {
  if (destinationArg) {
    return path.resolve(cwd, destinationArg);
  }

  return chooseFolder();
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("attach-files", {
    description: "Open macOS file picker, choose files, and copy/move them into a destination folder",

    handler: async (args, ctx) => {
      if (process.platform !== "darwin") {
        ctx.ui.notify("/attach-files is macOS-only because it uses osascript and AppleScript.", "error");
        return;
      }

      let parsed: ParsedArgs;

      try {
        parsed = parseArgs(args);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(message, "error");
        pi.sendUserMessage(`${message}\n\n${HELP_TEXT}`);
        return;
      }

      if (parsed.help) {
        pi.sendUserMessage(HELP_TEXT);
        return;
      }

      try {
        ctx.ui.notify("Opening destination/file picker…", "info");

        let destinationFolder: string;
        try {
          destinationFolder = await resolveDestinationFolder(parsed.destination, ctx.cwd);
        } catch (error) {
          if (isUserCancel(error)) {
            ctx.ui.notify("Destination folder selection cancelled.", "warning");
            return;
          }
          throw error;
        }

        await fs.mkdir(destinationFolder, { recursive: true });

        let selectedFiles: string[];
        try {
          selectedFiles = await chooseFiles(parsed.types);
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

        let results: CopyResult[];

        if (parsed.dryRun) {
          results = selectedFiles.map((sourcePath) => ({
            sourcePath,
            destinationPath: path.join(destinationFolder, path.basename(sourcePath)),
            ok: true as const,
          }));
        } else {
          results = [];

          for (const sourcePath of selectedFiles) {
            results.push(await copyOrMoveFile(sourcePath, destinationFolder, parsed.move));
          }
        }

        const successCount = results.filter((result) => result.ok).length;
        const failureCount = results.length - successCount;

        const status = parsed.dryRun
          ? `Dry run selected ${selectedFiles.length} file(s).`
          : `${parsed.move ? "Moved" : "Attached"} ${successCount} file(s)${
              failureCount > 0 ? `, ${failureCount} failed` : ""
            }.`;

        ctx.ui.notify(status, failureCount > 0 ? "warning" : "info");

        if (!parsed.noMessage) {
          const message = buildSessionMessage(
            ctx.cwd,
            results,
            destinationFolder,
            parsed.dryRun,
            parsed.move
          );

          if (ctx.isIdle()) {
            pi.sendUserMessage(message);
          } else {
            pi.sendUserMessage(message, { deliverAs: "followUp" });
            ctx.ui.notify("Attachment summary queued as a follow-up message.", "info");
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`attach-files failed: ${message}`, "error");
      }
    },
  });
}
