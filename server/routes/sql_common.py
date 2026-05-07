from typing import Iterable, Optional


VALID_YEARS = {2020, 2021, 2022, 2023, 2024}


def resolve_years(
    years: Optional[Iterable[int]],
    year: Optional[int],
    fallback_latest_sql: str,
    cur,
) -> list[int]:
    """Validate, dedupe, and sort multi-year input.

    Accepts the new ``years`` list param and the legacy single-value ``year``
    param. Falls back to the latest available year via ``fallback_latest_sql``
    when no valid years are supplied. Returns ``[]`` only if the fallback
    itself returns no data.
    """
    selected: list[int] = []
    if years:
        selected.extend(int(y) for y in years if y is not None)
    if year is not None:
        selected.append(int(year))

    selected = [y for y in selected if y in VALID_YEARS]

    if not selected:
        cur.execute(fallback_latest_sql)
        row = cur.fetchone()
        latest = row["max_year"] if row else None
        return [int(latest)] if latest is not None else []

    return sorted(set(selected))


# NOTE: The loaded ridership tables only contain
#   station_complex_id, ridership, transfers, transit_timestamp_millis.
# Year, quarter, and month are derived from transit_timestamp_millis at query
# time. Casts go through ::text so the CTE is portable across the 2023 table
# (which was loaded with text columns) and the others (numeric/double).
RIDERSHIP_ALL_CTE = """
ridership_all AS (
    SELECT
        station_complex_id::text AS station_complex_id,
        EXTRACT(YEAR    FROM to_timestamp(transit_timestamp_millis::text::double precision / 1000.0))::int AS year,
        EXTRACT(QUARTER FROM to_timestamp(transit_timestamp_millis::text::double precision / 1000.0))::int AS quarter,
        EXTRACT(MONTH   FROM to_timestamp(transit_timestamp_millis::text::double precision / 1000.0))::int AS month,
        ridership::text::bigint AS ridership
    FROM ridership2020dataframe
    UNION ALL
    SELECT
        station_complex_id::text,
        EXTRACT(YEAR    FROM to_timestamp(transit_timestamp_millis::text::double precision / 1000.0))::int,
        EXTRACT(QUARTER FROM to_timestamp(transit_timestamp_millis::text::double precision / 1000.0))::int,
        EXTRACT(MONTH   FROM to_timestamp(transit_timestamp_millis::text::double precision / 1000.0))::int,
        ridership::text::bigint
    FROM ridership2021dataframe
    UNION ALL
    SELECT
        station_complex_id::text,
        EXTRACT(YEAR    FROM to_timestamp(transit_timestamp_millis::text::double precision / 1000.0))::int,
        EXTRACT(QUARTER FROM to_timestamp(transit_timestamp_millis::text::double precision / 1000.0))::int,
        EXTRACT(MONTH   FROM to_timestamp(transit_timestamp_millis::text::double precision / 1000.0))::int,
        ridership::text::bigint
    FROM ridership2022dataframe
    UNION ALL
    SELECT
        station_complex_id::text,
        EXTRACT(YEAR    FROM to_timestamp(transit_timestamp_millis::text::double precision / 1000.0))::int,
        EXTRACT(QUARTER FROM to_timestamp(transit_timestamp_millis::text::double precision / 1000.0))::int,
        EXTRACT(MONTH   FROM to_timestamp(transit_timestamp_millis::text::double precision / 1000.0))::int,
        ridership::text::bigint
    FROM ridership2023dataframe
    UNION ALL
    SELECT
        station_complex_id::text,
        EXTRACT(YEAR    FROM to_timestamp(transit_timestamp_millis::text::double precision / 1000.0))::int,
        EXTRACT(QUARTER FROM to_timestamp(transit_timestamp_millis::text::double precision / 1000.0))::int,
        EXTRACT(MONTH   FROM to_timestamp(transit_timestamp_millis::text::double precision / 1000.0))::int,
        ridership::text::bigint
    FROM ridership2024dataframe
)
"""


STATION_META_CTE = """
station_meta_raw AS (
    SELECT station_complex_id::text AS station_complex_id, station_complex, borough
    FROM ridership2020uselessdatadataframe
    UNION ALL
    SELECT station_complex_id::text AS station_complex_id, station_complex, borough
    FROM ridership2021uselessdatadataframe
    UNION ALL
    SELECT station_complex_id::text AS station_complex_id, station_complex, borough
    FROM ridership2022uselessdatadataframe
    UNION ALL
    SELECT station_complex_id::text AS station_complex_id, station_complex, borough
    FROM ridership2023uselessdatadataframe
    UNION ALL
    SELECT station_complex_id::text AS station_complex_id, station_complex, borough
    FROM ridership2024uselessdatadataframe
),
station_meta AS (
    SELECT station_complex_id, MAX(station_complex) AS station_complex, MAX(borough) AS borough
    FROM station_meta_raw
    GROUP BY station_complex_id
)
"""
