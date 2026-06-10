# 06 — Testing and Validation

## Manual validation matrix

| Scenario | Command | Expected result |
|---|---|---|
| One file | `/attach-files ./attachments` | One file copied |
| Multiple files | `/attach-files ./attachments` | All selected files copied |
| Cancel file picker | `/attach-files ./attachments` then cancel | Warning notification, no crash |
| No destination arg | `/attach-files` | Folder picker opens |
| Cancel folder picker | `/attach-files` then cancel | Warning notification, no crash |
| Existing filename | attach `report.pdf` twice | second file becomes `report-1.pdf` |
| Type filter | `/attach-files ./attachments --types pdf,png` | picker restricts visible/selectable file types |
| Move mode | `/attach-files ./attachments --move` | file moved, source removed |
| No message | `/attach-files ./attachments --no-message` | notification only, no session message |
| Dry run | `/attach-files ./attachments --dry-run` | no file copied |
| Non-macOS | run on Linux/Windows | clear macOS-only error |

## Test install

```bash
pi -e ./src/attach-files.ts
```

Inside PI:

```text
/attach-files ./attachments
```

## Test global install

```bash
mkdir -p ~/.pi/agent/extensions/attach-files
cp src/attach-files.ts ~/.pi/agent/extensions/attach-files/index.ts
```

Restart PI or run:

```text
/reload
```

Then:

```text
/attach-files ./attachments
```

## Inspect results

```bash
ls -la ./attachments
```

## Validate conflict handling

```bash
mkdir -p attachments
echo old > attachments/test.txt
echo new > /tmp/test.txt
```

Run:

```text
/attach-files ./attachments
```

Choose `/tmp/test.txt`.

Expected:

```text
attachments/test.txt
attachments/test-1.txt
```

## Validate `--types`

Run:

```text
/attach-files ./attachments --types pdf,png,jpg
```

Expected picker behavior:

- PDF and image files selectable.
- Other files hidden/disabled depending on macOS behavior.

## Validate busy-agent behavior

Start a long-running request, then run:

```text
/attach-files ./attachments
```

Expected:

- The command should not throw.
- It should queue the session message as a follow-up if the agent is busy.

## Lightweight unit tests

You can unit test pure helpers without PI:

- `parseArgs`
- `uniqueDestinationPath`
- `toDisplayPath`
- `buildChooseFilesScript`

Do not unit test the native picker itself unless you mock `osascript`.

## Recommended test command for TypeScript syntax

Depending on the repo setup:

```bash
npx tsc --noEmit
```

If this extension is loaded directly by PI via jiti, TypeScript compilation may not be required, but typechecking is still valuable.

## Acceptance checklist

- [ ] Extension loads without crashing.
- [ ] `/attach-files --help` shows usage.
- [ ] macOS-only check works.
- [ ] Destination path resolves against `ctx.cwd`.
- [ ] Folder picker works when destination is omitted.
- [ ] Multiple file selection works.
- [ ] Cancellation is handled cleanly.
- [ ] Existing files are not overwritten.
- [ ] Copy mode works.
- [ ] Move mode works.
- [ ] `--types` works.
- [ ] `--no-message` suppresses session message.
- [ ] Busy-agent follow-up delivery works.
- [ ] Error messages are user-understandable.
