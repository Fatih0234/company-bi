#!/usr/bin/env bash
# DEPRECATED: This script is retained for backward compatibility with legacy
# workspaces that still use TLC/MinIO data sources. New workspaces should use
# ensure_workspace_sources.sh (called automatically by run_evidence_dev.sh).
#
# TLC sources have been moved to examples/tlc/. To use them:
#   cp -r examples/tlc/sources/tlc/ sources/tlc/
#   npm run sources -- --sources tlc
set -euo pipefail

MANIFEST=".evidence/template/static/data/manifest.json"

if [[ -f "$MANIFEST" ]]; then
  exit 0
fi

if [[ ! -d "sources/tlc" ]]; then
  echo "No Evidence source manifest found. Running sources..."
  npm run sources
  exit 0
fi

find_main_checkout() {
  local candidate

  # Content-only layout: shadow runtime stores a pointer to the source/runtime checkout.
  candidate="$({ python3 - <<'PY'
import json
from pathlib import Path
for path in [Path('.cmux/workspace.json'), Path('.cmux/evidence.json')]:
    try:
        data = json.loads(path.read_text())
    except Exception:
        continue
    runtime_root = data.get('runtimeRoot')
    if runtime_root:
        print(runtime_root)
        break
PY
  } 2>/dev/null || true)"
  if [[ -n "$candidate" && -f "$candidate/.cmux/evidence.json" && -f "$candidate/$MANIFEST" ]]; then
    printf '%s\n' "$candidate"
    return 0
  fi

  # Normal layout: main checkout/.workspaces/<analysis-worktree>
  for candidate in "../.." ".."; do
    if [[ -f "$candidate/.cmux/evidence.json" && -f "$candidate/$MANIFEST" ]]; then
      (cd "$candidate" && pwd)
      return 0
    fi
  done

  # Fallback: ask Git for all worktrees and pick the one on branch main with a manifest.
  while IFS= read -r line; do
    case "$line" in
      worktree\ *) candidate="${line#worktree }" ;;
      branch\ refs/heads/main)
        if [[ -n "${candidate:-}" && -f "$candidate/$MANIFEST" ]]; then
          printf '%s\n' "$candidate"
          return 0
        fi
        ;;
    esac
  done < <(git worktree list --porcelain 2>/dev/null || true)

  return 1
}

bootstrap_from_main_checkout() {
  local main_checkout="$1"

  if [[ -f "$main_checkout/$MANIFEST" ]]; then
    echo "Linking Evidence source manifest/cache from main checkout..."
    mkdir -p ".evidence/template/static"
    rm -rf ".evidence/template/static/data"
    ln -s "$main_checkout/.evidence/template/static/data" ".evidence/template/static/data"
  fi

  if [[ ! -e "data/tlc" && -d "$main_checkout/data/tlc" ]]; then
    echo "Linking synced TLC data from main checkout..."
    mkdir -p data
    ln -s "$main_checkout/data/tlc" "data/tlc"
  fi
}

main_checkout="$(find_main_checkout || true)"
if [[ -n "$main_checkout" ]]; then
  bootstrap_from_main_checkout "$main_checkout"
fi

if [[ -f "$MANIFEST" ]]; then
  exit 0
fi

load_env_file() {
  local candidate
  for candidate in ".env.local" "../.env.local" "../../.env.local"; do
    if [[ -f "$candidate" ]]; then
      # shellcheck disable=SC1090
      source "$candidate"
      return 0
    fi
  done
  return 1
}

if [[ ! -f "data/tlc/reference/taxi_zone_lookup.csv" || ! -d "data/tlc/raw/yellow" || ! -d "data/tlc/raw/green" ]]; then
  if ! command -v mc >/dev/null 2>&1; then
    echo "TLC data is missing and MinIO client 'mc' is not installed."
    echo "Install mc, then run: scripts/sync_tlc_lake_from_minio.sh"
    exit 1
  fi

  load_env_file || {
    echo "TLC data is missing and no .env.local was found in this workspace or its parents."
    echo "Create/source .env.local, then run: scripts/sync_tlc_lake_from_minio.sh"
    exit 1
  }

  echo "Syncing TLC data from MinIO..."
  scripts/sync_tlc_lake_from_minio.sh
fi

echo "Generating Evidence TLC source manifest..."
NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}" npm run sources -- --sources tlc
