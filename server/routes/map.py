from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from database import get_db_connection
from .sql_common import RIDERSHIP_ALL_CTE, STATION_META_CTE

router = APIRouter()


@router.get("/top-non-cbd-stations")
def get_top_non_cbd_stations(
    borough: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    top_k: int = Query(5, ge=1, le=100),
):
    """Query 10: Top Non-CBD Stations by Ridership with Arrest Counts per Borough"""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            target_year = year
            if target_year is None:
                cur.execute(
                    f"""
                    WITH {RIDERSHIP_ALL_CTE}
                    SELECT MAX(year)::int AS max_year
                    FROM ridership_all
                    WHERE year IS NOT NULL
                    """
                )
                row = cur.fetchone()
                target_year = row["max_year"] if row else None
            if target_year is None:
                return []

            sv_conditions = ["sm.borough IS NOT NULL"]
            sv_params = []
            if borough:
                sv_conditions.append("sm.borough ILIKE %s")
                sv_params.append(borough)
            if target_year is not None:
                sv_conditions.append("r.year = %s")
                sv_params.append(target_year)

            ar_conditions = ["year IS NOT NULL"]
            ar_params = []
            if target_year is not None:
                ar_conditions.append("year = %s")
                ar_params.append(target_year)

            sv_where = " AND ".join(sv_conditions)
            ar_where = " AND ".join(ar_conditions)
            params = sv_params + ar_params + [top_k]

            sql = f"""
                WITH {RIDERSHIP_ALL_CTE},
                {STATION_META_CTE},
                station_volume AS (
                    SELECT r.station_complex_id, sm.station_complex, sm.borough,
                           SUM(r.ridership) AS total_ridership
                    FROM ridership_all r
                    JOIN station_meta sm ON r.station_complex_id = sm.station_complex_id
                    WHERE {sv_where}
                    GROUP BY r.station_complex_id, sm.station_complex, sm.borough
                ),
                station_arrests AS (
                    SELECT station_complex_id, COUNT(*) AS total_arrests
                    FROM arrestsnypddataframe
                    WHERE {ar_where}
                    GROUP BY station_complex_id
                ),
                stationcoords_norm AS (
                    SELECT
                        COALESCE(
                            NULLIF(to_jsonb(sc)->>'complex_id', ''),
                            NULLIF(to_jsonb(sc)->>'Complex ID', '')
                        ) AS complex_id,
                        COALESCE(
                            NULLIF(to_jsonb(sc)->>'latitude', '')::double precision,
                            NULLIF(to_jsonb(sc)->>'gtfs_latitude', '')::double precision,
                            NULLIF(to_jsonb(sc)->>'GTFS Latitude', '')::double precision
                        ) AS latitude,
                        COALESCE(
                            NULLIF(to_jsonb(sc)->>'longitude', '')::double precision,
                            NULLIF(to_jsonb(sc)->>'gtfs_longitude', '')::double precision,
                            NULLIF(to_jsonb(sc)->>'GTFS Longitude', '')::double precision
                        ) AS longitude
                    FROM stationcoords sc
                ),
                stationcoords_agg AS (
                    SELECT
                        complex_id,
                        AVG(latitude) AS latitude,
                        AVG(longitude) AS longitude
                    FROM stationcoords_norm
                    WHERE complex_id IS NOT NULL
                    GROUP BY complex_id
                ),
                station_aggregated AS (
                    SELECT
                        MIN(sv.station_complex) AS station_complex,
                        sv.borough,
                        LOWER(TRIM(sv.station_complex)) AS station_name_key,
                        SUM(sv.total_ridership) AS total_ridership,
                        SUM(COALESCE(sa.total_arrests, 0)) AS total_arrests,
                        AVG(sc.latitude) AS latitude,
                        AVG(sc.longitude) AS longitude
                    FROM station_volume sv
                    LEFT JOIN station_arrests sa
                        ON sv.station_complex_id = sa.station_complex_id
                    LEFT JOIN stationcoords_agg sc
                        ON sv.station_complex_id::TEXT = sc.complex_id::TEXT
                    GROUP BY sv.borough, LOWER(TRIM(sv.station_complex))
                ),
                ranked AS (
                    SELECT
                        station_complex, borough, total_ridership,
                        total_arrests,
                        latitude, longitude,
                        RANK() OVER (
                            PARTITION BY borough
                            ORDER BY total_ridership DESC
                        )                                                     AS borough_rank
                    FROM station_aggregated
                )
                SELECT station_complex, borough, latitude, longitude,
                       total_ridership, total_arrests, borough_rank
                FROM ranked
                WHERE borough_rank <= %s
                ORDER BY borough, borough_rank
            """
            cur.execute(sql, params)
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
