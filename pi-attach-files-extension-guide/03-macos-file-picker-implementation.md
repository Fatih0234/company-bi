# 03 — macOS File Picker Implementation

## Why AppleScript through `osascript`

A PI extension runs in Node/TypeScript inside a terminal process. The simplest way to open a native macOS picker from that environment is:

```bash
osascript -e '<AppleScript>'
```

This avoids building a separate Swift helper app.

## Choose multiple files

AppleScript:

```applescript
set chosenFiles to choose file with prompt "Choose files to attach:" with multiple selections allowed
set output to ""
repeat with chosenFile in chosenFiles
  set output to output & POSIX path of chosenFile & linefeed
end repeat
return output
```

The important parts:

- `choose file` opens the file picker.
- `with multiple selections allowed` allows selecting more than one file.
- `POSIX path of chosenFile` returns Unix-style paths like `/Users/me/Desktop/foo.pdf`.

## Choose a destination folder

AppleScript:

```applescript
set chosenFolder to choose folder with prompt "Choose destination folder:"
return POSIX path of chosenFolder
```

## Restrict file types

AppleScript supports `of type`.

Examples:

```applescript
choose file with prompt "Choose PDFs:" of type {"pdf"} with multiple selections allowed
```

or UTIs:

```applescript
choose file with prompt "Choose images:" of type {"public.image"} with multiple selections allowed
```

In the TypeScript implementation, you can build the type list dynamically from:

```text
--types pdf,png,jpg
--types public.image
```

## Cancellation behavior

When the user cancels the picker, `osascript` exits with an error. The common AppleScript cancellation code is `-128`. Treat that as a normal cancellation, not a crash.

Implementation pattern:

```ts
try {
  const files = await chooseFiles(types);
} catch (error) {
  if (isUserCancel(error)) {
    ctx.ui.notify("File selection cancelled.", "warning");
    return;
  }
  throw error;
}
```

## Quoting and injection safety

Never directly concatenate untrusted text into AppleScript without escaping. For string values like prompts or type identifiers, escape backslashes and double quotes:

```ts
function quoteAppleScriptString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
```

For file types:

```ts
function appleScriptList(values: string[]): string {
  return `{${values.map(quoteAppleScriptString).join(", ")}}`;
}
```

## `execFile`, not `exec`

Use:

```ts
execFile("osascript", ["-e", script])
```

Do not use:

```ts
exec(`osascript -e "${script}"`)
```

`execFile` avoids shell parsing and reduces injection risk.

## TCC / permissions

macOS may ask for permissions depending on environment and security settings. The terminal application running PI may need permission to interact with Finder-style dialogs and access selected files.

Practical advice:

- Test in the same terminal app you use daily.
- If the picker does not appear, check macOS privacy/security settings.
- Avoid hidden background invocation; make this user-triggered.
- Document that this is macOS-only.

## Why not Swift?

A Swift helper can provide more control, but it adds build/distribution complexity. AppleScript is sufficient for:

- choosing files,
- choosing folders,
- restricting file types,
- returning POSIX paths.

Use Swift only if you need:

- custom accessory views,
- progress UI,
- persistent security-scoped bookmarks,
- a signed helper app,
- App Sandbox entitlement management.

## Why not Electron/Tauri dialog APIs?

They are viable if PI is already running inside an app shell, but PI is a terminal coding agent. Adding GUI framework dependencies for one picker is too heavy.

## Recommended abstraction

Keep macOS picker code isolated:

```ts
async function chooseFiles(options): Promise<string[]>
async function chooseFolder(): Promise<string | null>
```

That makes it easier to later add:

- Linux `zenity`/`kdialog`
- Windows PowerShell `OpenFileDialog`
- terminal fallback path input
