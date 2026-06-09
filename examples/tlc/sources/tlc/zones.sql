select
    LocationID as location_id,
    Borough as borough,
    Zone as zone,
    service_zone
from read_csv_auto('data/tlc/reference/taxi_zone_lookup.csv')
