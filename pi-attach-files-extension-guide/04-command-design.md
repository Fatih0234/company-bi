# 04 — Command Design

## Default command

```text
/attach-files [destination]
```

Examples:

```text
/attach-files ./attachments
/attach-files .pi/attachments
/attach-files
```

If `destination` is omitted, open a folder picker.

## Recommended options

| Option | Meaning |
|---|---|
| `--move` | Move files instead of copying them |
| `--no-message` | Do not inject a session message after saving |
| `--types pdf,png,jpg` | Restrict picker to selected file extensions or UTIs |
| `--dry-run` | Open picker and report what would happen, but do not copy |
| `--help` | Print usage in PI notification/session message |

## Copy vs move

Default to copy.

Copy is safer because the user's original file remains in place. Move should be explicit:

```text
/attach-files ./attachments --move
```

## Conflict handling

Never silently overwrite files. If the destination contains:

```text
report.pdf
```

and the user attaches another `report.pdf`, save as:

```text
report-1.pdf
```

Then:

```text
report-2.pdf
```

and so on.

## Destination path resolution

Rules:

| User input | Meaning |
|---|---|
| `./attachments` | Resolve against `ctx.cwd` |
| `.pi/attachments` | Resolve against `ctx.cwd` |
| `/absolute/path` | Use absolute path |
| omitted | Open folder picker |

## Session message content

Good message:

```text
Attached 2 file(s).

Saved files:
- ./attachments/report.pdf
- ./attachments/screenshot.png

These files are now available in the project folder. Use file-reading tools if you need to inspect them.
```

Avoid dumping sensitive original source paths unless necessary. Prefer final saved paths, and where possible show relative paths from `ctx.cwd`.

## Should the session message trigger a model response?

Usually yes. After attaching files, the model should know and continue.

However, sometimes the user only wants to stage files. That is why `--no-message` is useful.

## Good UX

Use notifications for immediate UI state:

```text
Opening file picker…
File selection cancelled.
Attached 3 files.
```

Use the session message for durable context:

```text
Attached 3 files. Saved files: ...
```

## Help text

The command should support:

```text
/attach-files --help
```

Suggested help text:

```text
Usage:
  /attach-files [destination] [--move] [--no-message] [--types pdf,png,jpg] [--dry-run]

Examples:
  /attach-files ./attachments
  /attach-files .pi/attachments --types pdf,png,jpg
  /attach-files ./incoming --move
  /attach-files --no-message

If destination is omitted, a folder picker will open.
```

## Future extensions

Possible future commands:

```text
/attach-open-file
```

Attach the file currently open in VS Code/Cursor if discoverable.

```text
/attach-selection
```

Attach currently selected lines from the editor, if an editor integration is available.

```text
/attach-dir
```

Choose a directory and copy it recursively.

```text
/attach-recent
```

Re-attach recently selected files from extension state.

## State storage

You can persist recent destinations or last-used options with PI custom entries or an extension-local config file. Keep this separate from the main file transfer behavior.

Avoid storing full lists of sensitive file paths unless the user expects that history.
