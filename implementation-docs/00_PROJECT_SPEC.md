# Project Spec: CMUX + Evidence Agent Workspace

## One-line description

Build a local-first, CMUX-powered workspace for creating Evidence dashboards with a coding agent. The first version runs without Docker and uses Git branches/worktrees for isolation, CMUX for the three-pane interface, Pi for agent-driven editing, and GitHub pull requests for collaboration.

## Story

A technical analyst wants to create a dashboard or one-off business analysis from company data. Instead of manually opening an editor, terminal, browser, and agent session, they run one command from an Evidence project.

The command opens a repeatable workspace:

```text
left pane:       Pi coding agent
right/top pane:  Evidence browser preview
right/bottom:    Evidence dev server logs
```

The analyst asks the agent to create or revise an Evidence page. The agent edits Markdown and SQL. The Evidence preview updates. The analyst iterates until the dashboard is useful. When ready, the analyst validates the work and publishes it through Git.

The project deliberately starts as a technical workflow, not a polished SaaS application. It should feel like a product, but it is implemented as a disciplined local developer workflow.

## Target users

| User | What they need |
|---|---|
| Technical analyst | Create analysis pages quickly using an agent and live preview. |
| Data/BI engineer | Maintain shared sources, data contracts, validation, and publish rules. |
| Teammate/reviewer | Read a preview, inspect the diff, and approve or request changes. |
| Future non-technical user | Eventually use the same workflow behind a friendlier UI, without learning Git. |

## First-version user scenarios

### Scenario 1: Open the default Evidence workspace

The user runs:

```bash
cmux-evidence .
```

Expected result:

1. CMUX opens a workspace.
2. Pi starts in the Evidence project directory.
3. Evidence dev server starts.
4. Browser pane opens the local Evidence URL.
5. The user can ask Pi to edit the current dashboard page.

### Scenario 2: Start a new analysis

The user runs:

```bash
cmux-evidence new "churn by region"
```

Expected result:

1. A branch is created, for example `analysis/churn-by-region`.
2. A Git worktree is created under `.workspaces/churn-by-region`.
3. A new page is created, for example `pages/analysis/churn-by-region.md`.
4. A unique port is assigned.
5. CMUX opens Pi, browser preview, and logs for that workspace.

### Scenario 3: Iterate with the agent

The user asks Pi:

```text
Create a dashboard showing churn by region for the last 6 months.
```

Expected result:

1. Pi reads the project context and available Evidence schema.
2. Pi edits only allowed files, primarily `pages/**` and possibly `queries/**`.
3. Evidence hot reloads the page.
4. The user sees the rendered dashboard and asks for revisions.

### Scenario 4: Publish through Git

The user runs a future command such as:

```text
/evidence-publish
```

Expected result:

1. Validation runs.
2. The diff is shown.
3. The user confirms.
4. The branch is committed and pushed.
5. A pull request is created.
6. A teammate reviews before merge.

## Scope for version 1

Version 1 includes:

- A project spec and step-by-step implementation docs.
- An Evidence app structure.
- A CMUX launcher command.
- A marker file at `.cmux/evidence.json`.
- A branch/worktree model for isolated analyses.
- A `new analysis` flow.
- Initial Pi extension design notes.

Version 1 does not include:

- Docker Sandbox.
- A hosted multi-user web app.
- In-app users, profiles, or permissions.
- Real-time collaborative editing.
- Automated production deployment.
- Full database governance.
- Custom Evidence framework patches.

## Architecture

```text
Evidence project repo
  ├── pages/
  ├── sources/
  ├── queries/
  ├── .cmux/evidence.json
  ├── .pi/extensions/
  └── bin/cmux-evidence

User starts analysis
  ↓
Git branch + Git worktree
  ↓
CMUX opens three panes
  ↓
Pi edits Markdown/SQL
  ↓
Evidence preview renders changes
  ↓
Validation
  ↓
GitHub pull request
```

## Collaboration principle

Collaboration is handled by Git, not by Evidence itself.

- A branch/worktree isolates unfinished work.
- A pull request is the review request.
- CODEOWNERS and branch protection can later enforce who must review sensitive paths.
- The production dashboard should only come from the protected main branch.

## File ownership principle

The agent should be treated as a powerful code editor, not as a trusted administrator.

Recommended default permissions:

| Path | Agent access | Notes |
|---|---|---|
| `pages/**` | Allow | Main dashboard authoring surface. |
| `queries/**` | Allow | Reusable SQL may live here. |
| `components/**` | Ask first | Component changes are broader than one analysis. |
| `sources/**/*.sql` | Ask first | Source queries affect shared data cache. |
| `sources/**/connection.yaml` | Block by default | Data connection configuration. |
| `.env*` | Block | Secrets. |
| `package.json`, lockfiles | Ask first/block | Dependency changes should be intentional. |
| `.github/**` | Block | CI and governance. |
| `bin/**` | Ask first | Tooling changes. |

## Success criteria

The first version is successful when:

- A fresh technical user can follow the docs from an empty workspace.
- `cmux-evidence .` opens the three-pane layout.
- `cmux-evidence new "example analysis"` creates an isolated analysis workspace.
- Evidence preview renders the generated page.
- The user can ask Pi to edit the page and see changes.
- The original main checkout is not modified by analysis work.
- The workflow can be repeated for multiple analyses without port or branch collisions.
- The generated analysis can be validated and prepared for a future PR flow.

## Implementation order

1. Empty workspace bootstrap.
2. Evidence app setup.
3. CMUX three-pane launcher.
4. Workspace and branch model.
5. New analysis command.
6. Pi extension and publish workflow later.

## External references

- Evidence deployment overview: https://docs.evidence.dev/deployment/overview
- Evidence data sources: https://docs.evidence.dev/core-concepts/data-sources/
- Evidence first app tutorial: https://docs.evidence.dev/build-your-first-app
- Git worktree documentation: https://git-scm.com/docs/git-worktree
- GitHub CODEOWNERS: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
- GitHub protected branches: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
