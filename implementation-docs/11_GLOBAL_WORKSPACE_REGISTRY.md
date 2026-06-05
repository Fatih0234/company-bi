# Step 11: Global Workspace Registry

References: `10_CMUX_EVIDENCE_WORKSPACE_OS_SPEC.md` sections **Configuration contract**, **Metadata contract**, and **Success criteria**.

## Goal

Make Evidence analysis workspaces discoverable and reopenable even when they are stored outside the project folder.

The command should support both modes:

1. Current local mode: worktrees under `.workspaces/`.
2. New global mode: worktrees under `~/.local/share/cmux-evidence/workspaces/<projectId>/`.

## Why this matters

A user may create many dashboard workspaces over time. If the workspaces only live in a hidden project-local folder, they are harder to manage globally. A registry gives the system a source of truth for listing, reopening, validating, and publishing analyses.

## Extend `.cmux/evidence.json`

Add optional fields:

```json
{
  "projectId": "company-bi",
  "workspaceDir": "~/.local/share/cmux-evidence/workspaces/company-bi",
  "registryPath": "~/.local/share/cmux-evidence/registry.json"
}
```

Rules:

- If `projectId` is missing, default to the Git root directory name.
- If `workspaceDir` is missing, keep the current `.workspaces` behavior.
- If `registryPath` is missing, default to `~/.local/share/cmux-evidence/registry.json`.
- Expand `~` and environment variables in paths.

## Registry file shape

Create or update:

```text
~/.local/share/cmux-evidence/registry.json
```

Recommended shape:

```json
{
  "version": 1,
  "projects": {
    "company-bi": {
      "root": "/Volumes/T7/projects/company-bi",
      "workspaces": {
        "revenue-quality-by-segment": {
          "kind": "evidence-analysis",
          "title": "Revenue Quality by Segment",
          "slug": "revenue-quality-by-segment",
          "branch": "analysis/revenue-quality-by-segment",
          "path": "/Users/fatihkarahan/.local/share/cmux-evidence/workspaces/company-bi/revenue-quality-by-segment",
          "page": "pages/analysis/revenue-quality-by-segment.md",
          "port": 3104,
          "url": "http://localhost:3104/analysis/revenue-quality-by-segment",
          "status": "draft",
          "createdAt": "2026-06-05T00:00:00Z",
          "updatedAt": "2026-06-05T00:00:00Z"
        }
      }
    }
  }
}
```

## Update `bin/cmux-evidence`

Add helper functions:

```python
def expand_path(value: str, *, base: Path | None = None) -> Path:
    expanded = os.path.expandvars(os.path.expanduser(value))
    path = Path(expanded)
    if not path.is_absolute() and base is not None:
        path = base / path
    return path.resolve()


def project_id(root: Path, config: dict[str, Any]) -> str:
    return str(config.get("projectId") or root.name)


def registry_path(config: dict[str, Any]) -> Path:
    return expand_path(
        str(config.get("registryPath") or "~/.local/share/cmux-evidence/registry.json")
    )


def workspace_dir(root: Path, config: dict[str, Any]) -> Path:
    raw = str(config.get("workspaceDir") or ".workspaces")
    return expand_path(raw, base=root)
```

Add registry helpers:

```python
def load_registry(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"version": 1, "projects": {}}
    return json.loads(path.read_text())


def save_registry(path: Path, registry: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(registry, indent=2, sort_keys=True) + "\n")
    tmp.replace(path)
```

Add `upsert_workspace_registry(...)`:

```python
def upsert_workspace_registry(
    *,
    registry_file: Path,
    project_id_value: str,
    project_root: Path,
    workspace: dict[str, Any],
) -> None:
    registry = load_registry(registry_file)
    projects = registry.setdefault("projects", {})
    project = projects.setdefault(project_id_value, {"root": str(project_root), "workspaces": {}})
    project["root"] = str(project_root)
    project.setdefault("workspaces", {})[workspace["slug"]] = workspace
    save_registry(registry_file, registry)
```

## Update `new_analysis`

When creating a new analysis:

1. Resolve `projectId`.
2. Resolve `workspaceDir`.
3. Resolve `registryPath`.
4. Create worktree under the resolved workspace directory.
5. Write `.cmux/workspace.json` in the worktree.
6. Upsert the same metadata into the global registry.

Important: keep using Git worktree. The worktree path can be outside the repo.

## Add `cmux-evidence list`

Usage:

```bash
cmux-evidence list
```

Behavior:

1. Load project config from current Git root.
2. Load registry.
3. Find current `projectId`.
4. Print a compact table.

Example output:

```text
Analyses for company-bi

SLUG                         STATUS  PORT  BRANCH
revenue-quality-by-segment   draft   3104  analysis/revenue-quality-by-segment
churn-by-region              draft   3105  analysis/churn-by-region
```

If no registry exists:

```text
No analysis workspaces found for company-bi.
```

## Add `cmux-evidence open <slug>`

Current `open` accepts a path. Preserve that behavior, but add slug support:

```bash
cmux-evidence open revenue-quality-by-segment
```

Resolution order:

1. If argument is a directory path, open it as today.
2. Else load registry and resolve slug for current project.
3. Verify the registered path still exists.
4. Call `open_workspace(path)`.

## Add `cmux-evidence current`

Usage inside a worktree:

```bash
cmux-evidence current
```

Behavior:

1. Read `.cmux/workspace.json` if present.
2. Print title, slug, branch, page, port, URL, status.
3. If missing, fall back to `.cmux/evidence.json` and Git branch.

## Add `cmux-evidence status`

Usage:

```bash
cmux-evidence status
```

Behavior:

1. Print current workspace metadata.
2. Print Git status short output.
3. Print whether the Evidence port appears reachable.
4. Optionally set CMUX sidebar status if `CMUX_WORKSPACE_ID` is present.

## Migration command: optional but useful

Add later if needed:

```bash
cmux-evidence registry import-local
```

Behavior:

- Scan `.workspaces/*/.cmux/workspace.json`.
- Add missing entries to the global registry.

## Acceptance criteria

- `.cmux/evidence.json` can point `workspaceDir` to a global path.
- `cmux-evidence new "x"` creates the worktree in that path.
- `.cmux/workspace.json` is written inside the worktree.
- `registry.json` is created or updated.
- `cmux-evidence list` shows the created analysis.
- `cmux-evidence open <slug>` reopens it in CMUX.
- Existing `.workspaces` behavior still works when no global path is configured.

## Test plan

From `/Volumes/T7/projects/company-bi`:

```bash
python3 -m json.tool .cmux/evidence.json
./bin/cmux-evidence new --print-layout "registry smoke test"
./bin/cmux-evidence list
./bin/cmux-evidence open --print-layout registry-smoke-test
```

Then inspect:

```bash
cat ~/.local/share/cmux-evidence/registry.json | jq .
cat ~/.local/share/cmux-evidence/workspaces/company-bi/registry-smoke-test/.cmux/workspace.json | jq .
```

## Rollback

If global storage causes confusion, remove `workspaceDir` from `.cmux/evidence.json`. The command should return to `.workspaces` mode.
