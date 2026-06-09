# pi-ask-user (vendored)

Vendored from [edlsh/pi-ask-user](https://github.com/edlsh/pi-ask-user) v0.11.2 (commit `edlsh/pi-ask-user@main`).

Do not edit in place. To sync from upstream, replace `index.ts`, `single-select-layout.ts`, and `skills/ask-user/SKILL.md` with the latest versions, then re-run `npm install` in this directory.

## Why vendored?

This extension provides the `ask_user` LLM-callable tool — an interactive Q&A primitive that lets the agent ask the user a focused question and get a structured response. It's used by the `analysis-intention` extension (our iterative interview flow) and is available to any Pi agent for high-stakes decisions.

The Pi harness resolves extensions via the jiti loader and walks up from the extension's directory to find peer dependencies. The vendored copy ships its own `package.json` with peerDeps and a local `node_modules/` (currently containing `@sinclair/typebox`, which is not in the global pi install).
