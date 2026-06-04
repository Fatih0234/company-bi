#!/usr/bin/env bash
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
