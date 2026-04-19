RIDERSHIP_ALL_CTE = """
ridership_all AS (
    SELECT
        station_complex_id::text AS station_complex_id,
        COALESCE(
            NULLIF(year::int, 0),
            EXTRACT(YEAR FROM to_timestamp(transit_timestamp_millis / 1000.0))::int
        ) AS year,
        COALESCE(
            NULLIF(quarter::int, 0),
            EXTRACT(QUARTER FROM to_timestamp(transit_timestamp_millis / 1000.0))::int
        ) AS quarter,
        COALESCE(
            EXTRACT(MONTH FROM to_timestamp(transit_timestamp_millis / 1000.0))::int,
            CASE NULLIF(quarter::int, 0)
                WHEN 1 THEN 1
                WHEN 2 THEN 4
                WHEN 3 THEN 7
                WHEN 4 THEN 10
                ELSE NULL
            END
        ) AS month,
        ridership
    FROM ridership2020dataframe
    UNION ALL
    SELECT
        station_complex_id::text AS station_complex_id,
        COALESCE(
            NULLIF(year::int, 0),
            EXTRACT(YEAR FROM to_timestamp(transit_timestamp_millis / 1000.0))::int
        ) AS year,
        COALESCE(
            NULLIF(quarter::int, 0),
            EXTRACT(QUARTER FROM to_timestamp(transit_timestamp_millis / 1000.0))::int
        ) AS quarter,
        COALESCE(
            EXTRACT(MONTH FROM to_timestamp(transit_timestamp_millis / 1000.0))::int,
            CASE NULLIF(quarter::int, 0)
                WHEN 1 THEN 1
                WHEN 2 THEN 4
                WHEN 3 THEN 7
                WHEN 4 THEN 10
                ELSE NULL
            END
        ) AS month,
        ridership
    FROM ridership2021dataframe
    UNION ALL
    SELECT
        station_complex_id::text AS station_complex_id,
        COALESCE(
            NULLIF(year::int, 0),
            EXTRACT(YEAR FROM to_timestamp(transit_timestamp_millis / 1000.0))::int
        ) AS year,
        COALESCE(
            NULLIF(quarter::int, 0),
            EXTRACT(QUARTER FROM to_timestamp(transit_timestamp_millis / 1000.0))::int
        ) AS quarter,
        COALESCE(
            EXTRACT(MONTH FROM to_timestamp(transit_timestamp_millis / 1000.0))::int,
            CASE NULLIF(quarter::int, 0)
                WHEN 1 THEN 1
                WHEN 2 THEN 4
                WHEN 3 THEN 7
                WHEN 4 THEN 10
                ELSE NULL
            END
        ) AS month,
        ridership
    FROM ridership2022dataframe
    UNION ALL
    SELECT
        station_complex_id::text AS station_complex_id,
        COALESCE(
            NULLIF(year::int, 0),
            EXTRACT(YEAR FROM to_timestamp(transit_timestamp_millis / 1000.0))::int
        ) AS year,
        COALESCE(
            NULLIF(quarter::int, 0),
            EXTRACT(QUARTER FROM to_timestamp(transit_timestamp_millis / 1000.0))::int
        ) AS quarter,
        COALESCE(
            EXTRACT(MONTH FROM to_timestamp(transit_timestamp_millis / 1000.0))::int,
            CASE NULLIF(quarter::int, 0)
                WHEN 1 THEN 1
                WHEN 2 THEN 4
                WHEN 3 THEN 7
                WHEN 4 THEN 10
                ELSE NULL
            END
        ) AS month,
        ridership
    FROM ridership2023dataframe
    UNION ALL
    SELECT
        station_complex_id::text AS station_complex_id,
        COALESCE(
            NULLIF(year::int, 0),
            EXTRACT(YEAR FROM to_timestamp(transit_timestamp_millis / 1000.0))::int
        ) AS year,
        COALESCE(
            NULLIF(quarter::int, 0),
            EXTRACT(QUARTER FROM to_timestamp(transit_timestamp_millis / 1000.0))::int
        ) AS quarter,
        COALESCE(
            EXTRACT(MONTH FROM to_timestamp(transit_timestamp_millis / 1000.0))::int,
            CASE NULLIF(quarter::int, 0)
                WHEN 1 THEN 1
                WHEN 2 THEN 4
                WHEN 3 THEN 7
                WHEN 4 THEN 10
                ELSE NULL
            END
        ) AS month,
        ridership
    FROM ridership2024dataframe
)
"""


STATION_META_CTE = """
station_meta_raw AS (
    SELECT station_complex_id::text AS station_complex_id, station_complex, borough
    FROM ridership2020uselessdataframe
    UNION ALL
    SELECT station_complex_id::text AS station_complex_id, station_complex, borough
    FROM ridership2021uselessdataframe
    UNION ALL
    SELECT station_complex_id::text AS station_complex_id, station_complex, borough
    FROM ridership2022uselessdataframe
    UNION ALL
    SELECT station_complex_id::text AS station_complex_id, station_complex, borough
    FROM ridership2023uselessdataframe
    UNION ALL
    SELECT station_complex_id::text AS station_complex_id, station_complex, borough
    FROM ridership2024uselessdataframe
),
station_meta AS (
    SELECT station_complex_id, MAX(station_complex) AS station_complex, MAX(borough) AS borough
    FROM station_meta_raw
    GROUP BY station_complex_id
)
"""
