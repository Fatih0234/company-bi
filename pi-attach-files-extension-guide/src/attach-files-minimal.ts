import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);

async function runAppleScript(script: string): Promise<string> {
  const { stdout } = await execFileAsync("osascript", ["-e", script], {
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

async function chooseFiles(): Promise<string[]> {
  const script = `
set chosenFiles to choose file with prompt "Choose files to attach:" with multiple selections allowed
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

async function chooseFolder(): Promise<string> {
  const script = `
set chosenFolder to choose folder with prompt "Choose destination folder:"
return POSIX path of chosenFolder
`;

  return runAppleScript(script);
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

export default function (pi: ExtensionAPI) {
  pi.registerCommand("attach-files", {
    description: "Open macOS file picker and copy selected files into a destination folder",

    handler: async (args, ctx) => {
      if (process.platform !== "darwin") {
        ctx.ui.notify("/attach-files is macOS-only.", "error");
        return;
      }

      try {
        const destinationArg = args.trim();
        const destinationFolder = destinationArg
          ? path.resolve(ctx.cwd, destinationArg)
          : await chooseFolder();

        await fs.mkdir(destinationFolder, { recursive: true });

        const selectedFiles = await chooseFiles();

        if (selectedFiles.length === 0) {
          ctx.ui.notify("No files selected.", "warning");
          return;
        }

        const copiedFiles: string[] = [];

        for (const sourcePath of selectedFiles) {
          const destinationPath = await uniqueDestinationPath(
            path.join(destinationFolder, path.basename(sourcePath))
          );

          await fs.copyFile(sourcePath, destinationPath);
          copiedFiles.push(destinationPath);
        }

        ctx.ui.notify(`Attached ${copiedFiles.length} file(s).`, "info");

        const message = [
          `Attached ${copiedFiles.length} file(s).`,
          "",
          "Saved files:",
          ...copiedFiles.map((file) => `- ${path.relative(ctx.cwd, file)}`),
        ].join("\n");

        if (ctx.isIdle()) {
          pi.sendUserMessage(message);
        } else {
          pi.sendUserMessage(message, { deliverAs: "followUp" });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`attach-files failed: ${message}`, "error");
      }
    },
  });
}
