# Usage Examples

## Basic use

```text
/attach-files ./attachments
```

Effect:

1. Opens macOS file picker.
2. Lets you choose one or more files.
3. Copies them into `./attachments`.
4. Sends a PI session message listing saved paths.

## Pick destination folder interactively

```text
/attach-files
```

Effect:

1. Opens folder picker.
2. Opens file picker.
3. Copies files into chosen folder.

## Save into PI hidden project folder

```text
/attach-files .pi/attachments
```

Useful when the files are only for the coding session.

## Restrict to PDFs and images

```text
/attach-files ./attachments --types pdf,png,jpg,public.image
```

## Move instead of copy

```text
/attach-files ./attachments --move
```

Use carefully. Copy is the safer default.

## Do not send a session message

```text
/attach-files ./attachments --no-message
```

Useful when you only want to stage files and manually tell the agent later.

## Dry run

```text
/attach-files ./attachments --dry-run
```

Useful for testing picker behavior without copying files.

## Help

```text
/attach-files --help
```

## Expected session message

```text
Attached 2 file(s).

Saved files:
- attachments/report.pdf
- attachments/screenshot.png

These files are now available in the project folder. Use file-reading tools if you need to inspect them.
```
