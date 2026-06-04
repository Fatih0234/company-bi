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
