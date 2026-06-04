# Step 05: New Analysis Command

## Goal

Implement:

```bash
cmux-evidence new "analysis name"
```

This command creates an isolated analysis workspace and opens it in CMUX.

## User experience

The user runs:

```bash
cmux-evidence new "churn by region"
```

Expected output:

```text
Created analysis workspace

Title:  churn by region
Slug:   churn-by-region
Branch: analysis/churn-by-region
Path:   .workspaces/churn-by-region
Page:   pages/analysis/churn-by-region.md
Port:   3100

Opening CMUX...
```

CMUX then opens:

```text
left:       Pi in .workspaces/churn-by-region
right/top:  browser at http://localhost:3100/analysis/churn-by-region
right/bot:  Evidence dev server logs
```

## Command responsibilities

`cmux-evidence new` must:

1. Verify it is being run from the main Evidence project root.
2. Read `.cmux/evidence.json`.
3. Slugify the analysis name.
4. Choose a unique branch name.
5. Choose a unique worktree path.
6. Choose a unique port.
7. Create the Git worktree and branch.
8. Create the initial Markdown page.
9. Update the worktree `.cmux/evidence.json` to use the assigned port.
10. Write optional workspace metadata.
11. Open CMUX for that worktree.

## Add subcommand parsing

Modify `bin/cmux-evidence` so it supports:

```bash
cmux-evidence .
cmux-evidence open .
cmux-evidence new "analysis name"
```

Suggested routing:

```python
args = sys.argv[1:]

if not args:
    return open_workspace(Path("."))

if args[0] == "new":
    title = " ".join(args[1:]).strip()
    return new_analysis(Path("."), title)

if args[0] == "open":
    return open_workspace(Path(args[1] if len(args) > 1 else "."))

return open_workspace(Path(args[0]))
```

## Slugify function

Add:

```python
import re

def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = value.strip("-")
    return value or "untitled-analysis"
```

## Unique name function

Add logic like:

```python
def unique_slug(base_slug: str, root: Path) -> str:
    slug = base_slug
    i = 2
    while (
        (root / ".workspaces" / slug).exists()
        or branch_exists(f"analysis/{slug}")
    ):
        slug = f"{base_slug}-{i}"
        i += 1
    return slug
```

## Branch existence check

Use:

```bash
git rev-parse --verify analysis/<slug>
```

In Python:

```python
def branch_exists(branch: str) -> bool:
    result = subprocess.run(
        ["git", "rev-parse", "--verify", branch],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return result.returncode == 0
```

## Port selection

Add:

```python
import socket

def port_is_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) != 0
```

Then:

```python
def choose_port(base_port: int = 3100) -> int:
    for port in range(base_port, base_port + 100):
        if port_is_free(port):
            return port
    raise RuntimeError("No free Evidence analysis ports found")
```

## Create the worktree

Run from the main project root:

```python
subprocess.run([
    "git",
    "worktree",
    "add",
    "-b",
    branch,
    str(worktree_path),
    "main"
], check=True)
```

Later, make the base branch configurable. For version 1, `main` is acceptable.

## Create the initial page

Inside the worktree, create:

```text
pages/analysis/<slug>.md
```

Content:

````markdown
# <Title>

This is an agent-created Evidence analysis workspace.

## Question

Describe the business question here.

## Draft query

```draft_query
select 1 as example_metric
```

<DataTable data={draft_query} />

## Notes

Ask Pi to replace this draft with a useful dashboard.
````

## Update the worktree marker

In the worktree, update `.cmux/evidence.json`:

```json
{
  "type": "evidence",
  "port": 3100,
  "agentCommand": "pi",
  "devCommand": "npm run dev -- --port 3100",
  "url": "http://localhost:3100/analysis/churn-by-region",
  "workspaceDir": ".workspaces",
  "analysisBasePort": 3100
}
```

If your Evidence dev command does not accept `-- --port`, replace this with the working port mechanism for your setup. The launcher contract remains the same: the marker must contain the actual URL and dev command for this workspace.

## Write workspace metadata

Create `.cmux/workspace.json` inside the worktree:

```json
{
  "kind": "analysis",
  "title": "churn by region",
  "slug": "churn-by-region",
  "branch": "analysis/churn-by-region",
  "port": 3100,
  "page": "pages/analysis/churn-by-region.md",
  "status": "draft"
}
```

## Open the new workspace

After creation, call the existing open flow:

```python
return open_workspace(worktree_path)
```

## First manual test

Run:

```bash
./bin/cmux-evidence new "test analysis"
```

Expected:

```bash
git worktree list
git branch --list "analysis/*"
ls .workspaces/test-analysis/pages/analysis/test-analysis.md
```

Then inspect the CMUX panes.

## Second manual test

Run:

```bash
./bin/cmux-evidence new "test analysis"
```

Expected:

- It does not overwrite the first workspace.
- It creates `test-analysis-2`.
- It assigns a different branch and port.

## Third manual test

From the new worktree, edit the generated page:

```bash
cd .workspaces/test-analysis
echo "\n## Manual edit\n\nThis proves the worktree is isolated." >> pages/analysis/test-analysis.md
```

Expected:

- The Evidence preview updates.
- The main checkout remains unchanged.

## Commit behavior

Do not auto-commit in this step.

The new branch/worktree can remain dirty while the user iterates. Commit/push/PR belongs to a later publish step.

## Acceptance criteria

This step is complete when:

- `cmux-evidence new "name"` creates a branch.
- It creates a worktree.
- It creates a page.
- It assigns a unique port.
- It opens CMUX.
- The generated page renders.
- Running the command twice with the same title creates two separate workspaces.
- Main checkout files are not modified except for intentional shared config changes.

## Common mistakes

| Mistake | Fix |
|---|---|
| Creating the page in main instead of the worktree | Always write to `worktree_path / page`. |
| Reusing the same branch name | Check branch existence and suffix the slug. |
| Reusing port 3000 | Use the analysis port range. |
| Auto-committing too early | Keep publishing for a later step. |
| Hiding failed Git commands | Let subprocess errors stop the command. |

## Next step after this document set

After Step 05 works, create the next docs/files for:

1. Pi extension.
2. Validation command.
3. Publish/PR command.
4. Security boundaries.
5. Optional Docker Sandbox mode.
