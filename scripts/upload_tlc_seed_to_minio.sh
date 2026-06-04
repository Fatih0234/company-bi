#!/usr/bin/env bash
set -euo pipefail

: "${MINIO_ENDPOINT:?Set MINIO_ENDPOINT}"
: "${MINIO_ACCESS_KEY:?Set MINIO_ACCESS_KEY}"
: "${MINIO_SECRET_KEY:?Set MINIO_SECRET_KEY}"

MINIO_BUCKET="${MINIO_BUCKET:-demo-lake}"

mc alias set lake "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"
mc mb --ignore-existing "lake/$MINIO_BUCKET"

test -d ".lake_seed/tlc/raw/yellow" || {
  echo "Missing .lake_seed/tlc/raw/yellow. Run python scripts/download_tlc_seed_data.py first."
  exit 1
}

test -d ".lake_seed/tlc/raw/green" || {
  echo "Missing .lake_seed/tlc/raw/green. Run python scripts/download_tlc_seed_data.py first."
  exit 1
}

test -f ".lake_seed/tlc/reference/taxi_zone_lookup.csv" || {
  echo "Missing .lake_seed/tlc/reference/taxi_zone_lookup.csv. Run python scripts/download_tlc_seed_data.py first."
  exit 1
}

mc mirror --overwrite ".lake_seed/tlc/raw/yellow/" "lake/$MINIO_BUCKET/tlc/raw/yellow/"
mc mirror --overwrite ".lake_seed/tlc/raw/green/" "lake/$MINIO_BUCKET/tlc/raw/green/"
mc mirror --overwrite ".lake_seed/tlc/reference/" "lake/$MINIO_BUCKET/tlc/reference/"

echo "Uploaded TLC seed data to lake/$MINIO_BUCKET/tlc/"
mc ls "lake/$MINIO_BUCKET/tlc/"
