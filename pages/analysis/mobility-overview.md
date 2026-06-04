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
