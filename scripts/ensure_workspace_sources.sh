#!/usr/bin/env bash
# ensure_workspace_sources.sh — Generic source bootstrap for workspace-local data.
#
# This script replaces the TLC-specific ensure_evidence_sources.sh for the
# default workflow. It:
#   1. Detects whether running from a content workspace or shadow runtime.
#   2. Locates workspace root and shadow runtime root.
#   3. Ensures workspace data/ exists.
#   4. If data files exist, ensures .cmux/data-registry.json exists.
#   5. Generates sources/files/*.sql from registry.
#   6. Runs Evidence source extraction for 'files' only when registered tables exist.
#   7. Exits successfully if no files exist.
#
# Must not: require MinIO, require TLC, read secrets, publish data.

set -euo pipefail

MANIFEST=".evidence/template/static/data/manifest.json"

# If the manifest already exists and is valid, sources are bootstrapped.
if [[ -f "$MANIFEST" ]]; then
  exit 0
fi

# ---------------------------------------------------------------------------
# Helper: resolve content workspace root from shadow runtime context
# ---------------------------------------------------------------------------
find_workspace_root() {
  local candidate

  # Case 1: We're inside a content workspace (has .cmux/evidence.json)
  if [[ -f ".cmux/evidence.json" ]]; then
    candidate="$(python3 -c "
import json, sys
from pathlib import Path
try:
    data = json.loads(Path('.cmux/evidence.json').read_text())
    wr = data.get('workspaceRoot') or data.get('workspaceDir')
    if wr:
        p = Path(wr).expanduser().resolve()
        if p.is_dir():
            print(p)
            sys.exit(0)
except Exception:
    pass
# Fallback: check if 'data' directory exists here
p = Path('.').resolve()
if (p / 'data').is_dir():
    print(p)
" 2>/dev/null || true)"
    if [[ -n "$candidate" && -d "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  fi

  # Case 2: We're in the shadow runtime, find content workspace via metadata
  if [[ -f ".cmux/workspace.json" ]]; then
    candidate="$(python3 -c "
import json, sys
from pathlib import Path
try:
    data = json.loads(Path('.cmux/workspace.json').read_text())
    wr = data.get('workspaceRoot')
    if wr:
        p = Path(wr).expanduser().resolve()
        if p.is_dir():
            print(p)
            sys.exit(0)
except Exception:
    pass
" 2>/dev/null || true)"
    if [[ -n "$candidate" && -d "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  fi

  # Case 3: Check parent directories for content workspace
  for candidate in ".." "../.."; do
    if [[ -f "$candidate/.cmux/evidence.json" && -d "$candidate/data" ]]; then
      (cd "$candidate" && pwd)
      return 0
    fi
  done

  return 1
}

# ---------------------------------------------------------------------------
# Helper: find shadow runtime root from content workspace
# ---------------------------------------------------------------------------
find_shadow_root() {
  local workspace_root="$1"
  python3 -c "
import json, sys
from pathlib import Path
try:
    data = json.loads(Path('$workspace_root/.cmux/evidence.json').read_text())
    sr = data.get('shadowRuntimeRoot')
    if sr:
        p = Path(sr).expanduser().resolve()
        if p.is_dir():
            print(p)
            sys.exit(0)
except Exception:
    pass
try:
    ws = json.loads(Path('$workspace_root/.cmux/workspace.json').read_text())
    sr = ws.get('shadowRuntimeRoot')
    if sr:
        p = Path(sr).expanduser().resolve()
        if p.is_dir():
            print(p)
            sys.exit(0)
except Exception:
    pass
# Fallback: assume shadow is same as workspace
print(Path('$workspace_root').resolve())
" 2>/dev/null || printf '%s\n' "$workspace_root"
}

# ---------------------------------------------------------------------------
# Step 1: Locate workspace root
# ---------------------------------------------------------------------------
WORKSPACE_ROOT="$(find_workspace_root || true)"
if [[ -z "$WORKSPACE_ROOT" || ! -d "$WORKSPACE_ROOT" ]]; then
  # No workspace found; check if there's a TLC-specific path (legacy)
  if [[ -d "sources/tlc" ]]; then
    exec scripts/ensure_evidence_sources.sh
  fi
  exit 0
fi

# ---------------------------------------------------------------------------
# Step 2: Check for data files and registry
# ---------------------------------------------------------------------------
DATA_DIR="$WORKSPACE_ROOT/data"
HAS_DATA_FILES=false

if [[ -d "$DATA_DIR" ]]; then
  # Check for supported data files
  while IFS= read -r -d '' file; do
    HAS_DATA_FILES=true
    break
  done < <(find "$DATA_DIR" -maxdepth 5 -type f \( -name "*.csv" -o -name "*.tsv" -o -name "*.parquet" -o -name "*.json" -o -name "*.jsonl" \) ! -name ".*" -print0 2>/dev/null || true)
fi

# If no workspace data files, check for legacy TLC sources and fall back
if [[ "$HAS_DATA_FILES" == "false" ]]; then
  if [[ -d "sources/tlc" ]]; then
    exec scripts/ensure_evidence_sources.sh
  fi
  exit 0
fi

# ---------------------------------------------------------------------------
# Step 3: Ensure registry exists, refresh if needed
# ---------------------------------------------------------------------------
REGISTRY_FILE="$WORKSPACE_ROOT/.cmux/data-registry.json"
if [[ ! -f "$REGISTRY_FILE" ]]; then
  echo "No data registry found. Creating one..."
  (cd "$WORKSPACE_ROOT" && python3 "$OLDPWD/bin/cmux-evidence" data refresh --no-open 2>/dev/null) || \
    (cd "$WORKSPACE_ROOT" && python3 -c "
import sys; sys.path.insert(0, '$(pwd)/scripts')
import workspace_data_registry as wdr
from pathlib import Path
wdr.refresh_workspace_data_registry(Path('.'))
") || true
fi

# ---------------------------------------------------------------------------
# Step 4: Find shadow runtime and generate sources
# ---------------------------------------------------------------------------
SHADOW_ROOT="$(find_shadow_root "$WORKSPACE_ROOT")"

if [[ -n "$SHADOW_ROOT" && -d "$SHADOW_ROOT" ]]; then
  # Generate source SQL files via Python
  python3 -c "
import sys; sys.path.insert(0, '$(pwd)/scripts')
import workspace_data_registry as wdr
from pathlib import Path

workspace_root = Path('$WORKSPACE_ROOT')
shadow_root = Path('$SHADOW_ROOT')
registry = wdr.load_data_registry(workspace_root)
ready = [t for t in registry.get('tables', []) if t.get('status') == 'ready']
if ready:
    wdr.generate_workspace_file_sources(workspace_root, shadow_root, registry)
" 2>/dev/null || true

  # Run Evidence sources for 'files' if we have registered tables
  REGISTRY_FILE="$WORKSPACE_ROOT/.cmux/data-registry.json"
  if [[ -f "$REGISTRY_FILE" ]]; then
    HAS_READY="$(python3 -c "
import json
try:
    data = json.loads(open('$REGISTRY_FILE').read())
    ready = [t for t in data.get('tables', []) if t.get('status') == 'ready']
    print('yes' if ready else 'no')
except: print('no')
" 2>/dev/null || echo "no")"

    if [[ "$HAS_READY" == "yes" ]]; then
      if [[ -d "$SHADOW_ROOT/sources/files" ]]; then
        echo "Running Evidence source extraction for workspace data..."
        NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}" \
          npm run sources -- --sources files 2>/dev/null || \
          echo "Warning: Evidence source extraction encountered issues."
      fi
    fi
  fi
fi

# Also handle legacy TLC if present (backward compatibility)
if [[ -d "sources/tlc" ]]; then
  scripts/ensure_evidence_sources.sh 2>/dev/null || true
fi
