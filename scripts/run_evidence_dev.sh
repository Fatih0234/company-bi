#!/usr/bin/env bash
set -euo pipefail

find_main_checkout() {
  local candidate

  for candidate in "../.." ".."; do
    if [[ -f "$candidate/.cmux/evidence.json" && -f "$candidate/package.json" ]]; then
      (cd "$candidate" && pwd)
      return 0
    fi
  done

  while IFS= read -r line; do
    case "$line" in
      worktree\ *) candidate="${line#worktree }" ;;
      branch\ refs/heads/main)
        if [[ -n "${candidate:-}" && -f "$candidate/package.json" ]]; then
          printf '%s\n' "$candidate"
          return 0
        fi
        ;;
    esac
  done < <(git worktree list --porcelain 2>/dev/null || true)

  return 1
}

extract_port() {
  local previous=""
  local arg
  for arg in "$@"; do
    if [[ "$previous" == "--port" ]]; then
      printf '%s\n' "$arg"
      return 0
    fi
    case "$arg" in
      --port=*)
        printf '%s\n' "${arg#--port=}"
        return 0
        ;;
    esac
    previous="$arg"
  done
  return 1
}

ensure_node_modules() {
  if [[ -e "node_modules" ]]; then
    return 0
  fi

  local main_checkout="$(find_main_checkout || true)"
  if [[ -n "$main_checkout" && -d "$main_checkout/node_modules" ]]; then
    echo "Linking node_modules from main checkout..."
    ln -s "$main_checkout/node_modules" node_modules
    return 0
  fi

  echo "node_modules is missing. Run npm install in the main checkout first." >&2
  exit 1
}

ensure_port_free() {
  local port="${1:-}"
  if [[ -z "$port" ]]; then
    return 0
  fi

  if ! [[ "$port" =~ ^[0-9]+$ ]]; then
    return 0
  fi

  if lsof -iTCP:"$port" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
    echo "Port $port is already in use. Stop the existing Evidence dev server or choose another port." >&2
    lsof -iTCP:"$port" -sTCP:LISTEN -n -P >&2 || true
    exit 1
  fi
}

ensure_node_modules

# Prefer the generic workspace sources script; fall back to legacy TLC script.
if [[ -x "scripts/ensure_workspace_sources.sh" ]]; then
  scripts/ensure_workspace_sources.sh
elif [[ -x "scripts/ensure_evidence_sources.sh" ]]; then
  scripts/ensure_evidence_sources.sh
fi
ensure_port_free "$(extract_port "$@" || true)"
exec evidence dev "$@"
