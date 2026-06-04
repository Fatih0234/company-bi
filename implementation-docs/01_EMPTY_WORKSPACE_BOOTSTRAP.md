# Step 01: Empty Workspace Bootstrap

## Goal

Start from an empty folder and prepare it to become a local-first CMUX + Evidence agent workspace.

This step does not create the full Evidence app yet. It creates the repository, baseline folders, ignore rules, and local conventions that later steps depend on.

## Starting point

You are in an empty directory:

```bash
mkdir cmux-evidence-workspace
cd cmux-evidence-workspace
```

## Prerequisites

Install or verify these tools before continuing:

```bash
git --version
node --version
npm --version
cmux --version
pi --version
```

If `pi` or `cmux` is not installed yet, stop here and install them before continuing. Do not write wrappers around missing binaries.

## Create the Git repository

```bash
git init
git branch -M main
```

## Create the base folders

```bash
mkdir -p docs
mkdir -p bin
mkdir -p scripts
mkdir -p .cmux
mkdir -p .pi/extensions
mkdir -p .workspaces
mkdir -p pages/analysis
mkdir -p queries
mkdir -p sources
```

## Add `.gitignore`

Create `.gitignore`:

```gitignore
# Dependencies
node_modules/

# Evidence generated state
.evidence/
build/

# Local environment and secrets
.env
.env.*
!.env.example

# Local analysis worktrees
.workspaces/

# Logs
*.log
npm-debug.log*
pnpm-debug.log*
yarn-debug.log*

# OS/editor noise
.DS_Store
.vscode/
.idea/
```

## Add a minimal project README

Create `README.md`:

```markdown
# CMUX Evidence Workspace

Local-first workspace for creating Evidence dashboards with a coding agent.

Use:

```bash
cmux-evidence .
```

Later:

```bash
cmux-evidence new "analysis name"
```
```

## Add a placeholder marker file

Create `.cmux/evidence.json`:

```json
{
  "type": "evidence",
  "port": 3000,
  "agentCommand": "pi",
  "devCommand": "npm run dev",
  "url": "http://localhost:3000",
  "workspaceDir": ".workspaces"
}
```

This file becomes the project-local configuration used by the launcher in Step 03.

## Add a placeholder Pi extension file

Create `.pi/extensions/README.md`:

```markdown
# Pi Extensions

This directory will contain project-local Pi extensions for Evidence-aware commands.

Initial planned commands:

- /evidence-status
- /evidence-schema
- /evidence-refresh
- /evidence-diff
- /evidence-validate
- /evidence-publish
```

## Commit the bootstrap

```bash
git add .
git commit -m "Bootstrap CMUX Evidence workspace"
```

## Acceptance criteria

This step is complete when:

```bash
git status --short
```

prints nothing, and this tree exists:

```text
.cmux/evidence.json
.pi/extensions/
bin/
docs/
pages/analysis/
queries/
scripts/
sources/
.workspaces/
README.md
.gitignore
```

## Common mistakes

| Mistake | Fix |
|---|---|
| `.workspaces/` is committed | Keep `.workspaces/` ignored. It is local runtime state. |
| `.env` is committed | Remove it from Git and keep only `.env.example` if needed. |
| `cmux` or `pi` not installed | Install them before building the launcher. |
| Work starts before committing bootstrap | Commit now so later diffs stay clean. |

## Next step

Continue to `02_EVIDENCE_APP_SETUP.md`.
