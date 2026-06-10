# 02 — PI Extension Integration

## PI extension model

A PI extension is a TypeScript module that exports a default function receiving the PI extension API:

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // register commands/tools/events/etc.
}
```

The file can register a slash command:

```ts
pi.registerCommand("attach-files", {
  description: "Open macOS file picker and copy selected files",
  handler: async (args, ctx) => {
    // implementation
  },
});
```

## Placement

Typical global placement:

```text
~/.pi/agent/extensions/attach-files/index.ts
```

Typical project-local placement:

```text
.pi/extensions/attach-files/index.ts
```

Use global placement for a command you want in all PI projects. Use project-local placement when the command is part of one repo's workflow.

## Test mode

For quick tests:

```bash
pi -e ./src/attach-files.ts
```

This loads the extension from a path without installing it globally.

## Hot reload

If the extension is placed in an auto-discovered extension directory, reload the PI runtime from inside PI:

```text
/reload
```

## Command handler responsibilities

Your handler should do these in order:

1. Check platform.
2. Parse arguments.
3. Resolve destination path.
4. Open destination picker if no path was provided.
5. Open file picker.
6. Copy or move selected files.
7. Notify user.
8. Send session message if enabled.

## Use `ctx.cwd`

Resolve relative paths against PI's current working directory:

```ts
const destination = path.resolve(ctx.cwd, argsDestination);
```

This makes:

```text
/attach-files ./attachments
```

mean:

```text
<current PI project>/attachments
```

not:

```text
wherever the `pi` binary happens to run from
```

## Use `ctx.ui.notify`

Notifications are the right way to communicate transient status:

```ts
ctx.ui.notify("Opening file picker…", "info");
ctx.ui.notify("No files selected.", "warning");
ctx.ui.notify(`Attached ${count} file(s).`, "info");
ctx.ui.notify(`Failed: ${message}`, "error");
```

## Use `pi.sendUserMessage`

After saving files, you usually want the PI session to know what happened. Send a user-visible message:

```ts
pi.sendUserMessage([
  "Attached 2 files.",
  "",
  "Saved files:",
  "- ./attachments/foo.pdf",
  "- ./attachments/bar.png",
].join("\n"));
```

If the agent is busy:

```ts
if (ctx.isIdle()) {
  pi.sendUserMessage(message);
} else {
  pi.sendUserMessage(message, { deliverAs: "followUp" });
}
```

This avoids throwing when a command runs while the model is streaming.

## Do not use `pi.appendEntry` for the main result

`pi.appendEntry` is useful for extension state that should persist without entering LLM context. For this command, the agent needs to know the saved paths, so use `sendUserMessage`. You can also append state for audit/history, but it should not replace the visible message.

## Command naming

Recommended names:

| Command | Meaning |
|---|---|
| `/attach-files` | General command for choosing one or more files |
| `/attach-file` | Alias if you want a singular version |
| `/import-files` | Alternative if the command copies files into a project |
| `/stage-files` | Alternative if the files are staged for later reading |

Prefer `/attach-files`: it matches the mental model of adding files to the session.

## Optional command aliases

PI command aliasing depends on whether you register multiple commands. You can do:

```ts
pi.registerCommand("attach-file", sameOptions);
pi.registerCommand("attach-files", sameOptions);
```

But avoid too many names because command lists become noisy.

## Command arguments

Recommended syntax:

```text
/attach-files [destination] [--move] [--no-message] [--types pdf,png,public.image] [--dry-run]
```

Examples:

```text
/attach-files ./attachments
/attach-files .pi/attachments --types pdf,png,jpg
/attach-files ./docs/incoming --move
/attach-files --no-message
```

## Behavior in non-interactive modes

This extension depends on macOS UI prompts. It is intended for interactive terminal sessions. In headless RPC/CI usage, return a clear error:

```text
/attach-files only works on macOS interactive sessions.
```

## PI core modification policy

Do not modify PI core for this feature unless you are upstreaming a general file-picker abstraction. The extension system is exactly the right place for user-specific workflows like this.
