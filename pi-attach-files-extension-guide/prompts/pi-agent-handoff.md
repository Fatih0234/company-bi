# Prompt: Build a PI macOS Attach Files Extension

Use this prompt inside PI Coding Agent, Codex, Claude Code, or another coding agent when you want it to implement the command in a real PI extension repo.

```text
We need to build a PI Coding Agent extension that registers a slash command `/attach-files`.

Context:
PI extensions are TypeScript modules. They can register slash commands via `pi.registerCommand()`, use `ctx.ui.notify()` for user feedback, and use `pi.sendUserMessage()` to inject a user-visible message into the session. The extension should be macOS-only and use `osascript`/AppleScript to open native Finder-style pickers.

Goal:
When I run `/attach-files [destination]` inside a PI session:
1. If destination is provided, resolve it relative to `ctx.cwd`.
2. If destination is omitted, open a macOS folder picker.
3. Open a macOS file picker allowing multiple file selections.
4. Copy selected files into the destination folder by default.
5. Do not overwrite existing files; use conflict-safe names like file-1.pdf.
6. Optionally support `--move`, `--no-message`, `--types`, `--dry-run`, and `--help`.
7. Notify the user with `ctx.ui.notify()`.
8. Unless `--no-message` is used, send a session message listing the saved destination paths.
9. If the agent is busy, use `pi.sendUserMessage(message, { deliverAs: "followUp" })`.

Files to inspect first:
- packages/coding-agent/docs/docs.json
- packages/coding-agent/docs/extensions.md
- packages/coding-agent/examples/extensions/send-user-message.ts
- any existing extension examples under packages/coding-agent/examples/extensions/

Files likely to create:
- ~/.pi/agent/extensions/attach-files/index.ts
or, inside a repo:
- .pi/extensions/attach-files/index.ts

Implementation constraints:
- Do not modify PI core.
- Do not touch provider/model/auth code.
- Do not add dependencies unless necessary.
- Prefer Node built-ins: node:child_process, node:fs/promises, node:path.
- Use `execFile`, not shell `exec`, for `osascript`.
- Escape AppleScript strings.
- Treat file picker cancellation as normal, not an error.
- Do not log original source paths except where explicitly needed.
- Use destination paths in the PI session message.
- Refuse non-macOS platforms clearly.
- Reject directories and symlinks unless explicitly implementing directory support.

Command syntax:
  /attach-files [destination] [--move] [--no-message] [--types pdf,png,jpg] [--dry-run]

Acceptance criteria:
- `/attach-files ./attachments` opens a file picker and copies multiple selected files.
- `/attach-files` asks for destination folder first.
- Existing destination files are not overwritten.
- `--types pdf,png,jpg` restricts the picker.
- `--move` moves files instead of copying.
- `--no-message` suppresses the session message.
- `--dry-run` copies nothing but reports what would happen.
- Cancelling either picker does not crash the extension.
- Running on non-macOS gives a clear error.
- If the agent is busy, the session message is queued as a follow-up.
- The implementation is typechecked if the repo supports it.

Validation commands:
- Run with: `pi -e ./path/to/attach-files.ts`
- Inside PI: `/attach-files --help`
- Inside PI: `/attach-files ./attachments`
- Select one file.
- Select multiple files.
- Cancel the file picker.
- Try a filename conflict.
- Try `--types pdf,png`.
- Try `--no-message`.

Report back:
- Files created/modified.
- How to install globally.
- How to test.
- Known limitations.
```
