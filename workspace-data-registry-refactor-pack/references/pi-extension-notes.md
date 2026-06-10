# Pi Extension Notes

Use current Pi docs as source of truth.

Relevant live repo docs:

- `earendil-works/pi/packages/coding-agent/docs/docs.json`
- `earendil-works/pi/packages/coding-agent/docs/index.md`
- `earendil-works/pi/packages/coding-agent/docs/extensions.md`
- `earendil-works/pi/packages/coding-agent/docs/packages.md`

Important facts:

- Pi is a minimal terminal coding harness.
- Pi is extended through TypeScript extensions, skills, prompt templates, themes, and Pi packages.
- Extensions can register LLM-callable tools, lifecycle hooks, commands, custom UI, and state.
- Pi packages bundle resources through `package.json` under the `pi` key.
- Extensions run locally with user permissions, so path and safety controls matter.

Design implication:

Workspace data registration should be surfaced through Pi tools/context, but the implementation must remain local, bounded, and safe.
