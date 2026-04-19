from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from database import get_db_connection
from .sql_common import RIDERSHIP_ALL_CTE, STATION_META_CTE

router = APIRouter()


@router.get("/ada-stations")
def get_ada_stations():
    """Query 5: ADA-Accessible Stations per Borough"""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT sc.borough, COUNT(*) AS accessible_stations
                FROM stationcoords sc
                WHERE sc.ADA = TRUE
                GROUP BY sc.borough
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
    year: Optional[int] = Query(None),
):
    """Query 4: Demographic Breakdown of Arrests by Borough"""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            target_year = year
            if target_year is None:
                cur.execute("SELECT MAX(year::int) AS max_year FROM arrestsnypddataframe WHERE year IS NOT NULL")
                row = cur.fetchone()
                target_year = row["max_year"] if row else None
            if target_year is None:
                return []

            conditions = ["sm.borough IS NOT NULL"]
            params = []
            if borough:
                conditions.append("sm.borough ILIKE %s")
                params.append(borough)
            if target_year is not None:
                conditions.append("a.year::int = %s")
                params.append(target_year)

            where_clause = " AND ".join(conditions)
            sql = f"""
                WITH {STATION_META_CTE}
                SELECT sm.borough,
                       a.AGE_GROUP  AS age_group,
                       a.PERP_RACE  AS perp_race,
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
def get_enforcement_disparity(year: Optional[int] = Query(None)):
    """Query 8: Borough Enforcement Disparity — Arrests vs. Estimated Evasion Volume"""
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

            yr_cond_r = ""
            yr_cond_fe = ""
            yr_cond_a = ""
            params = []
            if target_year is not None:
                yr_cond_r = "AND r.year::int = %s"
                yr_cond_fe = "AND year::int = %s"
                yr_cond_a = "AND a.year::int = %s"
                params = [target_year, target_year, target_year]

            sql = f"""
                WITH {RIDERSHIP_ALL_CTE},
                {STATION_META_CTE},
                borough_ridership AS (
                    SELECT sm.borough, r.year, SUM(r.ridership) AS paid_rides
                    FROM ridership_all r
                    JOIN station_meta sm ON r.station_complex_id = sm.station_complex_id
                    WHERE sm.borough IS NOT NULL {yr_cond_r}
                    GROUP BY sm.borough, r.year
                ),
                annual_evasion AS (
                    SELECT year, AVG(fare_evasion) AS avg_evasion_rate
                    FROM fareevasionstats
                    WHERE fare_evasion IS NOT NULL {yr_cond_fe}
                    GROUP BY year
                ),
                borough_est_evasion AS (
                    SELECT br.borough, br.year, br.paid_rides, ae.avg_evasion_rate,
                           ROUND(br.paid_rides / NULLIF(1 - ae.avg_evasion_rate, 0)
                                 * ae.avg_evasion_rate) AS est_evaded_rides
                    FROM borough_ridership br
                    JOIN annual_evasion ae ON br.year = ae.year
                ),
                borough_arrests AS (
                    SELECT sm.borough, a.year, COUNT(*) AS total_arrests
                    FROM arrestsnypddataframe a
                    JOIN station_meta sm ON a.station_complex_id = sm.station_complex_id
                    WHERE sm.borough IS NOT NULL {yr_cond_a}
                    GROUP BY sm.borough, a.year
                )
                SELECT
                    be.borough,
                    be.year,
                    be.est_evaded_rides,
                    COALESCE(ba.total_arrests, 0)                                         AS total_arrests,
                    ROUND(100.0 * COALESCE(ba.total_arrests, 0)
                          / NULLIF(be.est_evaded_rides, 0), 4)                           AS arrest_to_evasion_ratio
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
