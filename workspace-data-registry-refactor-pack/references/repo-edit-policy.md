# Repo Edit Policy for This Refactor

## Normal dashboard editing policy

Allowed by default:

```text
pages/**
queries/**
reports/**
data/**
```

Ask before editing:

```text
components/**
sources/**
package.json
package-lock.json
```

Do not edit:

```text
.env*
**/connection.yaml
.github/**
```

## Refactor-specific exception

This implementation refactor explicitly requires touching some runtime/tooling files:

```text
bin/cmux-evidence
scripts/**
pi-pkg/extensions/**
pi-pkg/skills/**
tests/**
README.md
```

These files may be edited only for the workspace data registry refactor.

## Still forbidden

Do not edit or expose real secrets:

```text
.env*
connection.options.yaml
real credentials
private keys
```

Do not publish raw workspace data by default.
