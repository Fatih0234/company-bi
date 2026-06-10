# Sources and Documentation Notes

This package was based on the following source-of-truth materials.

## PI Coding Agent

- Repository: `earendil-works/pi`
- Docs map: `packages/coding-agent/docs/docs.json`
- Extension docs: `packages/coding-agent/docs/extensions.md`
- Example: `packages/coding-agent/examples/extensions/send-user-message.ts`

Key PI facts used:

- PI extensions are TypeScript modules.
- Extensions can register custom slash commands via `pi.registerCommand()`.
- Extensions can interact with users via `ctx.ui`.
- Extensions can use Node built-ins.
- Extensions can send user-visible messages via `pi.sendUserMessage()`.
- Global extension location: `~/.pi/agent/extensions/`
- Project extension location: `.pi/extensions/`
- Quick test loading: `pi -e ./path.ts`

## Apple macOS scripting

Apple's Mac Automation Scripting Guide documents:

- `choose file`
- `choose file ... with multiple selections allowed`
- `choose folder`
- file type filtering with `of type`
- returning selected files/folders as paths

Relevant Apple doc:
https://developer.apple.com/library/archive/documentation/LanguagesUtilities/Conceptual/MacAutomationScriptingGuide/PromptforaFileorFolder.html

## Design assumptions

- This is intended for interactive macOS terminal use.
- The extension copies files into a known project/session path.
- The model is informed through a session message listing destination paths.
- The first implementation should be a manual slash command, not an LLM-callable tool.
