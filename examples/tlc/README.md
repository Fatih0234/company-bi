# TLC Taxi Data Example (Optional)

This is an **optional** demo dataset, not required for normal workspace usage.

## What is it?

A slice of NYC TLC (Taxi & Limousine Commission) taxi trip data:
- **Yellow cab** trips (98.3% of data)
- **Green cab** trips (1.7% of data)
- **Zone lookup** — 265 NYC taxi zones with Borough/Zone/service_zone

Data covers Jan–Mar 2024 and is synced from a local MinIO bucket via DuckDB.

## How to use it

### 1. Sync data from MinIO

Requires MinIO client (`mc`) and credentials in `.env.local`:

```bash
scripts/sync_tlc_lake_from_minio.sh
```

Or download seed data directly:

```bash
scripts/download_tlc_seed_data.py
```

### 2. Copy sources to your workspace

```bash
cp -r sources/tlc/ /path/to/workspace/sources/tlc/
```

### 3. Run Evidence sources

```bash
npm run sources -- --sources tlc
```

### 4. Query in dashboard pages

```sql
SELECT service_type, COUNT(*) FROM tlc.trips GROUP BY 1
SELECT * FROM tlc.zones WHERE Borough = 'Manhattan'
```

## Why is this optional?

The default workflow uses workspace-local files (CSV, Parquet, JSON) registered via `cmux-evidence data refresh`. TLC is preserved here as a reference example for users who want to work with larger datasets synced from object storage.

## Files

| File | Purpose |
|------|---------|
| `sources/tlc/connection.yaml` | DuckDB connection config |
| `sources/tlc/trips.sql` | Trip data source (reads parquet files) |
| `sources/tlc/zones.sql` | Zone lookup source (reads CSV) |
| `scripts/sync_tlc_lake_from_minio.sh` | Sync from MinIO |
| `scripts/download_tlc_seed_data.py` | Download seed data |
| `scripts/upload_tlc_seed_to_minio.sh` | Upload to MinIO |
