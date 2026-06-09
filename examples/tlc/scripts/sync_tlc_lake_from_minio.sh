#!/usr/bin/env bash
set -euo pipefail

: "${MINIO_ENDPOINT:?Set MINIO_ENDPOINT}"
: "${MINIO_ACCESS_KEY:?Set MINIO_ACCESS_KEY}"
: "${MINIO_SECRET_KEY:?Set MINIO_SECRET_KEY}"

MINIO_BUCKET="${MINIO_BUCKET:-demo-lake}"

mc alias set lake "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"

mkdir -p data/tlc/raw/yellow
mkdir -p data/tlc/raw/green
mkdir -p data/tlc/reference

mc mirror --overwrite "lake/$MINIO_BUCKET/tlc/raw/yellow/" "data/tlc/raw/yellow/"
mc mirror --overwrite "lake/$MINIO_BUCKET/tlc/raw/green/" "data/tlc/raw/green/"
mc mirror --overwrite "lake/$MINIO_BUCKET/tlc/reference/" "data/tlc/reference/"

echo "Synced MinIO TLC lake subset into local data/tlc/"
find data/tlc -maxdepth 4 -type f | sort
