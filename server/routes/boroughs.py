from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from database import get_db_connection
from .sql_common import RIDERSHIP_ALL_CTE, STATION_META_CTE, resolve_years

router = APIRouter()


@router.get("/ada-stations")
def get_ada_stations():
    """Query 5: ADA-Accessible Stations per Borough.

    The loaded ``stationcoordsdataframe.ada`` is text with values
    ``'0' | '1' | '2'`` (1 = fully ADA accessible). The ``borough`` column
    uses MTA single/double-letter codes (M/Bk/Q/Bx/SI), so we expand them
    to the full names the rest of the app uses.
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT
                    CASE sc.borough
                        WHEN 'M'  THEN 'Manhattan'
                        WHEN 'Bk' THEN 'Brooklyn'
                        WHEN 'Q'  THEN 'Queens'
                        WHEN 'Bx' THEN 'Bronx'
                        WHEN 'SI' THEN 'Staten Island'
                        ELSE sc.borough
                    END AS borough,
                    COUNT(*) AS accessible_stations
                FROM stationcoordsdataframe sc
                WHERE sc.ada = '1'
                GROUP BY 1
                ORDER BY accessible_stations DESC
                """
            )
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


@router.get("/demographic-arrests")
def get_demographic_arrests(
    borough: Optional[str] = Query(None),
    years: Optional[List[int]] = Query(None),
    year: Optional[int] = Query(None),
):
    """Query 4: Demographic Breakdown of Arrests by Borough across selected years."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            target_years = resolve_years(
                years,
                year,
                "SELECT MAX(year::int) AS max_year FROM arrestsnypddataframe WHERE year IS NOT NULL",
                cur,
            )
            if not target_years:
                return []

            conditions = ["sm.borough IS NOT NULL", "a.year::int = ANY(%s)"]
            params: list = [target_years]
            if borough:
                conditions.append("sm.borough ILIKE %s")
                params.append(borough)

            where_clause = " AND ".join(conditions)
            sql = f"""
                WITH {STATION_META_CTE}
                SELECT sm.borough, a.AGE_GROUP, a.PERP_RACE,
                       COUNT(*) AS arrest_count
                FROM arrestsnypddataframe a
                JOIN station_meta sm ON a.station_complex_id = sm.station_complex_id
                WHERE {where_clause}
                GROUP BY sm.borough, a.AGE_GROUP, a.PERP_RACE
                ORDER BY sm.borough, arrest_count DESC
            """
            cur.execute(sql, params)
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


@router.get("/enforcement-disparity")
def get_enforcement_disparity(
    years: Optional[List[int]] = Query(None),
    year: Optional[int] = Query(None),
):
    """Query 8: Borough Enforcement Disparity, returns one row per (borough, year)."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            target_years = resolve_years(
                years,
                year,
                f"""
                WITH {RIDERSHIP_ALL_CTE}
                SELECT MAX(year)::int AS max_year
                FROM ridership_all
                WHERE year IS NOT NULL
                """,
                cur,
            )
            if not target_years:
                return []

            params = [target_years, target_years, target_years]

            sql = f"""
                WITH {RIDERSHIP_ALL_CTE},
                {STATION_META_CTE},
                borough_ridership AS (
                    SELECT sm.borough, r.year, SUM(r.ridership) AS paid_rides
                    FROM ridership_all r
                    JOIN station_meta sm ON r.station_complex_id = sm.station_complex_id
                    WHERE sm.borough IS NOT NULL AND r.year = ANY(%s)
                    GROUP BY sm.borough, r.year
                ),
                annual_evasion AS (
                    SELECT year, AVG("Fare Evasion") AS avg_evasion_rate
                    FROM fairevasionstatsdataframe
                    WHERE "Fare Evasion" IS NOT NULL AND year = ANY(%s)
                    GROUP BY year
                ),
                borough_est_evasion AS (
                    SELECT br.borough, br.year, br.paid_rides, ae.avg_evasion_rate,
                           ROUND((br.paid_rides / NULLIF(1 - ae.avg_evasion_rate, 0)
                                 * ae.avg_evasion_rate)::numeric) AS est_evaded_rides
                    FROM borough_ridership br
                    JOIN annual_evasion ae ON br.year = ae.year
                ),
                borough_arrests AS (
                    SELECT sm.borough, a.year::int AS year, COUNT(*) AS total_arrests
                    FROM arrestsnypddataframe a
                    JOIN station_meta sm ON a.station_complex_id = sm.station_complex_id
                    WHERE sm.borough IS NOT NULL AND a.year::int = ANY(%s)
                    GROUP BY sm.borough, a.year::int
                )
                SELECT
                    be.borough,
                    be.year,
                    be.est_evaded_rides,
                    COALESCE(ba.total_arrests, 0)                                         AS total_arrests,
                    ROUND((100.0 * COALESCE(ba.total_arrests, 0)
                          / NULLIF(be.est_evaded_rides, 0))::numeric, 4)                  AS arrest_to_evasion_ratio
                FROM borough_est_evasion be
                LEFT JOIN borough_arrests ba
                    ON be.borough = ba.borough AND be.year = ba.year
                ORDER BY be.year DESC, arrest_to_evasion_ratio DESC
            """
            cur.execute(sql, params)
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
