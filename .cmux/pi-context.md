# Evidence Dashboard Workspace Context

You are helping build an Evidence dashboard inside a CMUX workspace.

## Active analysis

- Project: company-bi
- Title: company-bi
- Slug: company-bi
- Branch: main
- Worktree: /Volumes/T7/projects/company-bi
- Primary page: 
- Preview URL: http://localhost:3000
- Dev server port: 3000

## Main task

Help the user create and refine the Evidence dashboard for this analysis.
Start with the primary page unless the user explicitly asks for broader changes.

## Safe edit policy

Allowed by default:

- pages/**
- queries/**

Ask before editing:

- components/**
- sources/**
- package.json
- package-lock.json

Do not edit:

- .env*
- **/connection.yaml
- .github/**

## CMUX workflow

When making dashboard changes:

1. Inspect the relevant Evidence files.
2. Make a small, focused edit.
3. Check the Evidence preview in the CMUX browser pane when possible.
4. Fix visible Evidence errors before saying the task is complete.
5. Summarize changed files and remaining questions.

Use CMUX status/progress/notifications for long-running work when available.
