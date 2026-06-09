# AGENTS.md

## Post-Implementation Registration Rule

**CRITICAL: After implementing any new extension, skill, prompt template, or theme, you MUST register it in `pi-pkg/package.json` under the appropriate `pi` section.**

### Why This Matters

- The `bin/lumen-pi` script loads extensions from `pi-pkg/` via `-e "$PROJECT_ROOT/pi-pkg"`
- Workspaces inherit extensions from the root `pi-pkg/package.json`
- If you don't register your implementation, it won't be loaded by Pi
- This is a common source of "it works in isolation but not in the workspace" bugs

### Registration Locations

| Asset Type | Registration Location |
|------------|----------------------|
| Extensions | `pi-pkg/package.json` → `pi.extensions` array |
| Skills | `pi-pkg/package.json` → `pi.skills` array |
| Prompt Templates | `pi-pkg/package.json` → `pi.prompts` array |
| Themes | `pi-pkg/package.json` → `pi.themes` array |

### Registration Format

```json
{
  "pi": {
    "extensions": [
      "./extensions/existing-extension.ts",
      "./extensions/new-extension"  // <-- Add here (directory or .ts file)
    ],
    "skills": [
      "./skills/existing-skill",
      "./skills/new-skill"  // <-- Add here
    ]
  }
}
```

### Post-Implementation Checklist

After implementing any new Pi asset:

1. ✅ Asset created in `pi-pkg/extensions/`, `pi-pkg/skills/`, `pi-pkg/prompts/`, or `pi-pkg/themes/`
2. ✅ Asset registered in `pi-pkg/package.json` under the correct `pi` section
3. ✅ Tests pass (`npm test` in the asset directory)
4. ✅ New workspaces will pick up the asset automatically
5. ⚠️ Existing workspaces need manual sync or recreation

### Common Mistakes to Avoid

- ❌ Creating an extension but forgetting to register it
- ❌ Registering with wrong path (e.g., `./extensions/new.ts` when it's a directory)
- ❌ Not testing that the asset loads in a real workspace
- ❌ Assuming existing workspaces will auto-update (they won't)

---

