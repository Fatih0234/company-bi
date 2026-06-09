// Test-only stub for @earendil-works/pi-coding-agent.
// defineTool is invoked at tool-registration time; we don't need schema
// validation, so identity-passthrough is enough. ExtensionAPI is just
// a type, erased at runtime.

export function defineTool(def) {
  return def;
}

export class ExtensionAPI {}
