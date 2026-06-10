# 01 — Architecture

## Problem

You want a PI Coding Agent session to gain access to user-selected local files without forcing the user to type exact filesystem paths. On macOS, the natural UX is:

```text
Run slash command → open native picker → choose files → save/copy into known folder → tell the agent what was saved
```

## Recommended architecture

```text
PI interactive session
  |
  | user runs:
  | /attach-files ./attachments
  v
PI extension command handler
  |
  | invokes local macOS picker
  v
osascript / AppleScript
  |
  | returns POSIX file paths
  v
Node.js file operations
  |
  | copy/move files into destination folder
  v
PI UI notification + optional session message
```

## Why a PI command?

PI extensions can register slash commands. A command is the right primitive because file selection is an explicit user interaction. The user decides when the picker opens and where files should be saved.

A custom LLM tool is less appropriate for the first version because the model could request file selection during an automated turn. That is possible, but for safety and UX you should start with an explicit command.

## Main components

### 1. Command registration

The extension registers:

```ts
pi.registerCommand("attach-files", {
  description: "...",
  handler: async (args, ctx) => {
    // parse args
    // open file picker
    // copy files
    // notify/session-message
  },
});
```

### 2. macOS picker bridge

Use `osascript` from Node:

```ts
execFile("osascript", ["-e", appleScript])
```

AppleScript provides:

```applescript
choose file with multiple selections allowed
choose folder
```

### 3. Copy/move layer

Use Node built-ins:

```ts
import fs from "node:fs/promises";
import path from "node:path";
```

The extension should:

- Resolve relative destination paths against `ctx.cwd`.
- Create the destination directory if needed.
- Avoid overwriting existing files.
- Preserve original extensions.
- Optionally move instead of copy.
- Return a list of final saved paths.

### 4. Session integration layer

After files are saved, the extension should notify the user and optionally inject a user-visible session message:

```ts
pi.sendUserMessage(message)
```

When the agent is already busy/streaming, use follow-up delivery:

```ts
pi.sendUserMessage(message, { deliverAs: "followUp" })
```

## Data flow

```text
args: "./attachments --types pdf,png"
  ↓
parse into:
  destination = /current/project/attachments
  types = ["pdf", "png"]
  ↓
AppleScript picker returns:
  /Users/me/Desktop/a.pdf
  /Users/me/Downloads/b.png
  ↓
copy layer writes:
  /current/project/attachments/a.pdf
  /current/project/attachments/b.png
  ↓
PI session message:
  Attached 2 files.
  - attachments/a.pdf
  - attachments/b.png
```

## What this does not do

This command does not magically upload files to a remote LLM provider. It copies local files into a project/session folder and tells the agent about those paths. The agent still needs tools/context behavior capable of reading those files.

For coding agents, this is usually enough: the model sees a message like "Saved files: ./attachments/foo.pdf", and then it can use file-reading tools if available.

## Recommended folder convention

Inside each project, use:

```text
.pi/
  attachments/
```

or:

```text
attachments/
```

Use `.pi/attachments/` if the files are session-support artifacts. Use `attachments/` if you want them to be visible as normal project files.
