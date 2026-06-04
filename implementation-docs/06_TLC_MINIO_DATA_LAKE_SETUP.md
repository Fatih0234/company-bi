# 06 — Data Lake Setup: NYC TLC → MinIO → Local Evidence Sources

## Purpose

This file turns the data-lake part of the CMUX + Evidence + Pi workflow into a repeatable setup.

The chosen first-version architecture is:

```text
Official NYC TLC public data
  → download a curated seed subset
  → upload it to MinIO as a demo data lake
  → sync selected MinIO files into each local Evidence workspace
  → run Evidence sources
  → build dashboards with the coding agent
```

This is **Option A — safest first version: sync MinIO files locally**.

We are intentionally **not** querying MinIO/S3 directly from Evidence yet. The first version should be reliable and easy to demo. MinIO acts like the shared company data lake; each Evidence workspace syncs a curated subset locally before building sources.

---

## Outcome

At the end, you should have:

```text
your-evidence-project/
  data/
    tlc/
      raw/
        yellow/
          yellow_tripdata_2024-01.parquet
          yellow_tripdata_2024-02.parquet
          yellow_tripdata_2024-03.parquet
        green/
          green_tripdata_2024-01.parquet
          green_tripdata_2024-02.parquet
          green_tripdata_2024-03.parquet
      reference/
        taxi_zone_lookup.csv

  sources/
    tlc/
      trips.sql
      zones.sql

  pages/
    analysis/
      mobility-overview.md

  scripts/
    download_tlc_seed_data.py
    upload_tlc_seed_to_minio.sh
    sync_tlc_lake_from_minio.sh
```

And the workflow should be:

```bash
python scripts/download_tlc_seed_data.py
scripts/upload_tlc_seed_to_minio.sh
scripts/sync_tlc_lake_from_minio.sh
npm run sources -- --sources tlc
npm run dev
```

---

## Source data

We will use NYC Taxi & Limousine Commission trip record data.

For the first demo, use only:

```text
Yellow Taxi Trip Records: 2024-01, 2024-02, 2024-03
Green Taxi Trip Records:  2024-01, 2024-02, 2024-03
Taxi Zone Lookup Table:   CSV
```

This is enough for a realistic company analytics demo:

- demand by day/hour;
- revenue trends;
- trip distance and duration;
- pickup zones;
- payment mix;
- operational outliers.

Do **not** download the entire TLC archive for the first version.

---

## Important mental model

There are three data locations:

```text
1. .lake_seed/
   Temporary local download from the official TLC website.
   Used only to populate MinIO.

2. MinIO bucket
   The fake company data lake.
   This is the shared source of truth for demo data.

3. data/tlc/
   The local workspace copy.
   Evidence reads from here.
```

Normal users should not care about `.lake_seed/`.

Normal analysis workflow starts from:

```bash
scripts/sync_tlc_lake_from_minio.sh
```

---

## Prerequisites

You need:

```bash
python3 --version
node --version
npm --version
git --version
mc --version
```

You also need an Evidence app already created in the current project.

If `mc` is missing, install the MinIO Client first.

You need either:

1. an existing MinIO server; or
2. a local MinIO server running on your machine.

For local development, this guide assumes:

```text
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=demo-lake
```

If you use a real remote MinIO server, replace those values.

---

## Step 1 — Create folders

Run from the Evidence project root:

```bash
mkdir -p .lake_seed/tlc/raw/yellow
mkdir -p .lake_seed/tlc/raw/green
mkdir -p .lake_seed/tlc/reference

mkdir -p data/tlc/raw/yellow
mkdir -p data/tlc/raw/green
mkdir -p data/tlc/reference

mkdir -p sources/tlc
mkdir -p pages/analysis
mkdir -p scripts
```

---

## Step 2 — Update `.gitignore`

Add:

```gitignore
# Local data lake seed and synced raw data
.lake_seed/
data/tlc/raw/
data/tlc/reference/

# Local database artifacts
*.duckdb
*.db
*.sqlite

# Local secrets
.env
.env.local
connection.options.yaml
```

Commit scripts and SQL files. Do **not** commit raw Parquet files or MinIO credentials.

---

## Step 3 — Create the TLC downloader

Create:

```text
scripts/download_tlc_seed_data.py
```

with:

```python
from pathlib import Path
import csv
import time
import urllib.request

BASE_URL = "https://d37ci6vzurychx.cloudfront.net"

# Keep this small for the first demo.
MONTHS = ["2024-01", "2024-02", "2024-03"]
TRIP_TYPES = ["yellow", "green"]

ROOT = Path(__file__).resolve().parents[1]
SEED_DIR = ROOT / ".lake_seed" / "tlc"
RAW_DIR = SEED_DIR / "raw"
REF_DIR = SEED_DIR / "reference"
MANIFEST_PATH = SEED_DIR / "manifest.csv"


def download_file(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)

    if destination.exists() and destination.stat().st_size > 0:
        print(f"Already exists: {destination}")
        return

    print(f"Downloading: {url}")
    urllib.request.urlretrieve(url, destination)
    time.sleep(0.5)


def main() -> None:
    rows = []

    for trip_type in TRIP_TYPES:
        for month in MONTHS:
            filename = f"{trip_type}_tripdata_{month}.parquet"
            url = f"{BASE_URL}/trip-data/{filename}"
            destination = RAW_DIR / trip_type / filename

            download_file(url, destination)

            rows.append({
                "dataset": "nyc_tlc_trip_record_data",
                "trip_type": trip_type,
                "month": month,
                "url": url,
                "seed_path": str(destination.relative_to(ROOT)),
                "file_size_bytes": destination.stat().st_size if destination.exists() else "",
            })

    zone_url = f"{BASE_URL}/misc/taxi_zone_lookup.csv"
    zone_destination = REF_DIR / "taxi_zone_lookup.csv"
    download_file(zone_url, zone_destination)

    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    with MANIFEST_PATH.open("w", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "dataset",
                "trip_type",
                "month",
                "url",
                "seed_path",
                "file_size_bytes",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote manifest: {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
```

Run:

```bash
python scripts/download_tlc_seed_data.py
```

Expected result:

```text
.lake_seed/tlc/raw/yellow/*.parquet
.lake_seed/tlc/raw/green/*.parquet
.lake_seed/tlc/reference/taxi_zone_lookup.csv
.lake_seed/tlc/manifest.csv
```

---

## Step 4 — Configure MinIO environment variables

Create a local shell file that you do **not** commit:

```text
.env.local
```

Example:

```bash
export MINIO_ENDPOINT="http://localhost:9000"
export MINIO_ACCESS_KEY="minioadmin"
export MINIO_SECRET_KEY="minioadmin"
export MINIO_BUCKET="demo-lake"
```

Load it:

```bash
source .env.local
```

Check:

```bash
echo "$MINIO_ENDPOINT"
echo "$MINIO_BUCKET"
```

Do not commit `.env.local`.

---

## Step 5 — Connect `mc` to MinIO

Run:

```bash
mc alias set lake "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"
```

Create the bucket if it does not already exist:

```bash
mc mb --ignore-existing "lake/$MINIO_BUCKET"
```

Verify:

```bash
mc ls lake
```

You should see the bucket.

---

## Step 6 — Upload the seed files into MinIO

Create:

```text
scripts/upload_tlc_seed_to_minio.sh
```

with:

```bash
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
```

Make it executable:

```bash
chmod +x scripts/upload_tlc_seed_to_minio.sh
```

Run:

```bash
scripts/upload_tlc_seed_to_minio.sh
```

Verify:

```bash
mc ls "lake/$MINIO_BUCKET/tlc/raw/yellow/"
mc ls "lake/$MINIO_BUCKET/tlc/raw/green/"
mc ls "lake/$MINIO_BUCKET/tlc/reference/"
```

---

## Step 7 — Sync MinIO files into the local Evidence workspace

This is the normal analyst/workspace step.

Create:

```text
scripts/sync_tlc_lake_from_minio.sh
```

with:

```bash
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
```

Make it executable:

```bash
chmod +x scripts/sync_tlc_lake_from_minio.sh
```

Run:

```bash
scripts/sync_tlc_lake_from_minio.sh
```

Expected result:

```text
data/tlc/raw/yellow/yellow_tripdata_2024-01.parquet
data/tlc/raw/yellow/yellow_tripdata_2024-02.parquet
data/tlc/raw/yellow/yellow_tripdata_2024-03.parquet
data/tlc/raw/green/green_tripdata_2024-01.parquet
data/tlc/raw/green/green_tripdata_2024-02.parquet
data/tlc/raw/green/green_tripdata_2024-03.parquet
data/tlc/reference/taxi_zone_lookup.csv
```

---

## Step 8 — Create the Evidence DuckDB source

Use the Evidence UI for this step because it writes the connection files in the format expected by your installed Evidence version.

Run:

```bash
npm run dev
```

Open:

```text
http://localhost:3000/settings
```

Create a new source:

```text
Source name: tlc
Source type: DuckDB
Filename: :memory:
```

Save it.

You should now have:

```text
sources/tlc/
  connection.yaml
```

Depending on your Evidence version, you may also see:

```text
sources/tlc/connection.options.yaml
```

Do not commit `connection.options.yaml`.

---

## Step 9 — Create Evidence source query: `trips.sql`

Create:

```text
sources/tlc/trips.sql
```

with:

```sql
with yellow as (
    select
        'yellow' as service_type,
        tpep_pickup_datetime as pickup_ts,
        tpep_dropoff_datetime as dropoff_ts,
        PULocationID as pickup_location_id,
        DOLocationID as dropoff_location_id,
        passenger_count,
        trip_distance,
        fare_amount,
        tip_amount,
        total_amount,
        payment_type
    from read_parquet('data/tlc/raw/yellow/*.parquet', union_by_name = true)
),

green as (
    select
        'green' as service_type,
        lpep_pickup_datetime as pickup_ts,
        lpep_dropoff_datetime as dropoff_ts,
        PULocationID as pickup_location_id,
        DOLocationID as dropoff_location_id,
        passenger_count,
        trip_distance,
        fare_amount,
        tip_amount,
        total_amount,
        payment_type
    from read_parquet('data/tlc/raw/green/*.parquet', union_by_name = true)
),

combined as (
    select * from yellow
    union all
    select * from green
)

select
    service_type,
    pickup_ts,
    dropoff_ts,
    cast(pickup_ts as date) as pickup_date,
    extract(hour from pickup_ts) as pickup_hour,
    pickup_location_id,
    dropoff_location_id,
    passenger_count,
    trip_distance,
    fare_amount,
    tip_amount,
    total_amount,
    payment_type,
    date_diff('minute', pickup_ts, dropoff_ts) as trip_minutes
from combined
where pickup_ts is not null
  and dropoff_ts is not null
  and pickup_ts < dropoff_ts
  and total_amount >= 0
  and trip_distance >= 0
```

---

## Step 10 — Create Evidence source query: `zones.sql`

Create:

```text
sources/tlc/zones.sql
```

with:

```sql
select
    LocationID as location_id,
    Borough as borough,
    Zone as zone,
    service_zone
from read_csv_auto('data/tlc/reference/taxi_zone_lookup.csv')
```

---

## Step 11 — Run Evidence sources

Run:

```bash
npm run sources -- --sources tlc
```

If you hit memory issues, use:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run sources -- --sources tlc
```

Expected result:

```text
tlc.trips
tlc.zones
```

These tables are now queryable from Evidence Markdown pages.

---

## Step 12 — Create the starter dashboard page

Create:

```text
pages/analysis/mobility-overview.md
```

with:

````markdown
# MetroMobility Operations Overview

This page uses a synced local subset of the company demo lake.

```sql daily_metrics
select
    pickup_date,
    service_type,
    count(*) as trip_count,
    sum(total_amount) as total_revenue,
    avg(total_amount) as avg_trip_value,
    avg(trip_distance) as avg_trip_distance,
    avg(trip_minutes) as avg_trip_minutes,
    sum(tip_amount) as total_tips
from tlc.trips
group by 1, 2
order by 1, 2
```

```sql hourly_demand
select
    pickup_hour,
    service_type,
    count(*) as trip_count,
    avg(total_amount) as avg_trip_value
from tlc.trips
group by 1, 2
order by 1, 2
```

```sql zone_metrics
select
    z.borough,
    z.zone,
    t.service_type,
    count(*) as trip_count,
    sum(t.total_amount) as total_revenue,
    avg(t.trip_distance) as avg_trip_distance,
    avg(t.trip_minutes) as avg_trip_minutes
from tlc.trips t
left join tlc.zones z
    on t.pickup_location_id = z.location_id
group by 1, 2, 3
order by trip_count desc
limit 25
```

<Grid cols=2>
    <BigValue
        data={daily_metrics}
        value=trip_count
        title="Trips"
    />

    <BigValue
        data={daily_metrics}
        value=total_revenue
        title="Revenue"
        fmt=usd
    />
</Grid>

## Daily Demand

<LineChart
    data={daily_metrics}
    x=pickup_date
    y=trip_count
    series=service_type
/>

## Hourly Demand

<BarChart
    data={hourly_demand}
    x=pickup_hour
    y=trip_count
    series=service_type
/>

## Top Pickup Zones

<DataTable data={zone_metrics} />
````

---

## Step 13 — Run the dashboard

Start the Evidence dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000/analysis/mobility-overview
```

You should see:

- BigValue cards;
- a daily demand line chart;
- an hourly demand bar chart;
- a top pickup zones table.

---

## Step 14 — Use it with the CMUX/Pi workflow

Once this page works manually, the normal agent workflow should be:

```bash
source .env.local
scripts/sync_tlc_lake_from_minio.sh
npm run sources -- --sources tlc
cmux-evidence new "mobility demand analysis"
```

Inside Pi, ask something like:

```text
Create a new Evidence page analyzing daily and hourly demand in the TLC demo lake.
Use tlc.trips and tlc.zones.
Focus on operations questions a mobility company would ask.
```

The agent should mostly edit:

```text
pages/analysis/*.md
```

Optionally:

```text
queries/
```

It should not edit:

```text
data/tlc/raw/**
sources/tlc/connection.yaml
.env.local
package.json
```

---

## Step 15 — Final validation checklist

Run:

```bash
source .env.local
python scripts/download_tlc_seed_data.py
scripts/upload_tlc_seed_to_minio.sh
scripts/sync_tlc_lake_from_minio.sh
npm run sources -- --sources tlc
npm run dev
```

Then verify:

```text
[ ] MinIO bucket exists
[ ] TLC files exist in MinIO
[ ] TLC files sync into data/tlc/
[ ] Evidence source tlc exists
[ ] npm run sources -- --sources tlc succeeds
[ ] tlc.trips is queryable
[ ] tlc.zones is queryable
[ ] /analysis/mobility-overview renders
[ ] raw Parquet files are not committed to Git
```

Before publishing later:

```bash
npm run build:strict
```

---

## Troubleshooting

### `mc: command not found`

Install MinIO Client and verify:

```bash
mc --version
```

### `Unable to initialize new alias`

Check:

```bash
echo "$MINIO_ENDPOINT"
echo "$MINIO_ACCESS_KEY"
echo "$MINIO_SECRET_KEY"
```

Then rerun:

```bash
mc alias set lake "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"
```

### `bucket does not exist`

Run:

```bash
mc mb --ignore-existing "lake/$MINIO_BUCKET"
```

### Evidence source cannot find Parquet files

Check:

```bash
find data/tlc -maxdepth 4 -type f | sort
```

Then rerun:

```bash
scripts/sync_tlc_lake_from_minio.sh
npm run sources -- --sources tlc
```

### Evidence source fails with memory error

Use:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run sources -- --sources tlc
```

### DuckDB source setup is confusing

Use the Evidence UI:

```text
http://localhost:3000/settings
```

Create source:

```text
name: tlc
type: DuckDB
filename: :memory:
```

---

## Design notes for the product

This data-lake setup supports the broader product story:

```text
Data team:
  owns MinIO bucket and curated source data

Evidence project:
  owns SQL source definitions and dashboard pages

Pi coding agent:
  edits Markdown dashboards and analysis SQL

Git:
  owns branch isolation, review, and publishing
```

The local sync model is intentionally boring and reliable. After this works, a later version can try direct S3/MinIO querying from DuckDB, but that should not be the first demo.

---

## References

- NYC TLC Trip Record Data: https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page
- Evidence Data Sources: https://docs.evidence.dev/core-concepts/data-sources/
- Evidence DuckDB Data Source: https://docs.evidence.dev/core-concepts/data-sources/duckdb
- MinIO Client `mc alias set`: https://docs.min.io/aistor/reference/cli/mc-alias/mc-alias-set/
- MinIO Client `mc mirror`: https://docs.min.io/aistor/reference/cli/mc-mirror/
