# 05 — Security, Permissions, and Gotchas

## Extensions are powerful

A PI extension runs local code with the permissions of the PI process. Treat it like any other code execution plugin.

Security implications:

- It can read/write files accessible to your user account.
- It can run subprocesses.
- It can leak file paths if you log them carelessly.
- It can copy sensitive files into project folders that may later be committed.

Only install extensions you trust.

## User-triggered by design

File picking should be user-triggered:

```text
/attach-files ./attachments
```

Do not silently open pickers from model tool calls or lifecycle events.

## Avoid accidental git commits

If you store attachments in the project, add a clear ignore pattern if needed:

```gitignore
.pi/attachments/
attachments/
```

Or, if some attachments should be versioned, use a different folder.

## Do not overwrite

Never overwrite destination files by default. Use unique names:

```text
foo.pdf
foo-1.pdf
foo-2.pdf
```

## Path disclosure

The final session message should prefer destination paths, not original source paths.

Potentially sensitive:

```text
/Users/alice/Medical/scan.pdf
```

Safer:

```text
.pi/attachments/scan.pdf
```

## Filename disclosure still matters

Even destination filenames can reveal sensitive information. Consider adding a future `--rename` or `--anonymize` option if you often attach sensitive documents.

## File type filtering is advisory

`--types pdf,png` restricts the picker, but you should still validate selected files after selection if correctness matters.

## Symlinks

`fs.copyFile` copies the target file contents for normal file paths. If symlink semantics matter, explicitly inspect with `lstat`.

Safe default:

- Only copy regular files.
- Reject directories unless implementing recursive directory support.
- Consider rejecting symlinks in security-sensitive projects.

## Large files

Large files can be expensive for the agent to read later. The attach command itself should not automatically ingest file contents into the prompt.

Recommended behavior:

- Copy file.
- Send path.
- Let the agent decide whether/how to inspect it.

## Binary files

Binary files are fine to copy. The model may not be able to read them unless PI has tools for extracting text/images/PDF content.

## macOS cancellation

AppleScript user cancellation commonly returns error `-128`. Treat it as normal.

## `osascript` availability

`osascript` is available on macOS. On Linux/Windows it will not work. Check:

```ts
if (process.platform !== "darwin") {
  ctx.ui.notify("/attach-files is macOS-only.", "error");
  return;
}
```

## Terminal app permissions

The terminal application running PI may need macOS permissions. If the picker or file access fails:

1. Try running from Terminal.app.
2. Check System Settings → Privacy & Security.
3. Check permissions for Terminal/iTerm/WezTerm/Ghostty/etc.
4. Restart the terminal after permission changes.

## Sandboxed apps

PI as a terminal process is generally not a sandboxed macOS app in the same way a Mac App Store app is. If you later wrap this in a sandboxed GUI app, use macOS security-scoped bookmarks for persistent access.

## Race conditions

If files are modified while copying, you may get inconsistent data. For normal attachments this is acceptable. For production workflows, compute hashes after copy.

## Partial failures

If copying 10 files and file 7 fails, choose one of two policies:

1. Fail fast and report copied files so far.
2. Continue and report successes/failures.

For UX, continue-on-error is often better, but fail-fast is simpler. The included production source reports per-file failures.

## Handling spaces and special characters

Use Node path APIs and `execFile`. Do not shell-concatenate paths.

Good:

```ts
execFile("osascript", ["-e", script])
```

Bad:

```ts
exec(`osascript -e "${script}"`)
```

## Trust boundary

The trust boundary is:

```text
User-selected source files → project/session destination folder
```

Do not expand it to arbitrary scanning, recursive copying, or hidden ingestion unless the user explicitly asks.

## Recommended safe defaults

- macOS-only check
- manual slash command
- copy, not move
- no overwrite
- relative destination resolved against `ctx.cwd`
- session message contains destination paths only
- file picker cancellation is normal
- no hidden background access
