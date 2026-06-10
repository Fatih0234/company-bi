# PI Coding Agent macOS Attach Files Command

This package explains how to integrate a native macOS file-attachment command into PI Coding Agent using PI's extension capability.

The target command is:

```text
/attach-files ./attachments
```

Expected behavior:

1. User runs the command inside a PI chat session.
2. The extension opens a macOS Finder-style file picker.
3. The user selects one or more files.
4. The extension copies or moves those files into a destination folder.
5. The extension notifies the user and optionally posts a user-visible session message listing the saved files.

This is designed for cases where you want a terminal coding agent session to receive files chosen through the normal macOS file picker, without manually typing long file paths.

## Contents

| File | Purpose |
|---|---|
| `01-architecture.md` | How the command fits into PI extension architecture |
| `02-pi-extension-integration.md` | PI-specific implementation details |
| `03-macos-file-picker-implementation.md` | AppleScript/osascript implementation notes |
| `04-command-design.md` | Command syntax and option design |
| `05-security-permissions-gotchas.md` | Trust, permissions, sandboxing, privacy, and edge cases |
| `06-testing-and-validation.md` | Manual and automated validation plan |
| `src/attach-files.ts` | Production-oriented TypeScript PI extension |
| `src/attach-files-minimal.ts` | Short minimal implementation for learning |
| `src/package.json` | Optional package metadata/dependencies |
| `examples/usage.md` | Example PI commands and expected behavior |
| `prompts/pi-agent-handoff.md` | Prompt to give PI/Codex/Claude Code to implement this |
| `SOURCES.md` | Source notes and docs used |

## Recommended path

Start with `src/attach-files-minimal.ts` to understand the mechanism. Then use `src/attach-files.ts` as the real implementation.

## Install as a global PI extension

```bash
mkdir -p ~/.pi/agent/extensions/attach-files
cp src/attach-files.ts ~/.pi/agent/extensions/attach-files/index.ts
```

Then start PI or run `/reload` inside PI if extensions are hot-reloadable from that location.

## Test directly

From this package directory:

```bash
pi -e ./src/attach-files.ts
```

Then inside PI:

```text
/attach-files ./attachments
```

## Design stance

Make file attachment a manual slash command first, not an LLM-callable tool. File pickers and file movement should be explicit user-triggered actions.
