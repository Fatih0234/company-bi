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
