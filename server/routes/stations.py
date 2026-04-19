from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from database import get_db_connection
from .sql_common import RIDERSHIP_ALL_CTE, STATION_META_CTE

router = APIRouter()


@router.get("/busiest")
def get_busiest_stations(
    limit: int = Query(10, ge=1, le=100),
    year: Optional[int] = Query(None),
):
    """Query 1: Top N Busiest Stations by Total Ridership (single year)."""
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

            conditions = ["r.year IS NOT NULL"]
            params = []
            if target_year is not None:
                conditions.append("r.year = %s")
                params.append(target_year)
            where_clause = " AND ".join(conditions)
            params.append(limit)
            cur.execute(
                f"""
                WITH {RIDERSHIP_ALL_CTE},
                {STATION_META_CTE}
                SELECT sm.station_complex, sm.borough,
                       SUM(r.ridership) AS total_ridership
                FROM ridership_all r
                JOIN station_meta sm ON r.station_complex_id = sm.station_complex_id
                WHERE {where_clause}
                GROUP BY sm.station_complex, sm.borough
                ORDER BY total_ridership DESC
                LIMIT %s
                """,
                params,
            )
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


@router.get("/arrest-intensity")
def get_arrest_intensity(
    borough: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=500),
):
    """Query 7: Station-Level Arrest Intensity vs. Ridership"""
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

            post_conditions = []
            post_params = []
            if borough:
                post_conditions.append("sm.borough ILIKE %s")
                post_params.append(borough)
            if target_year is not None:
                post_conditions.append("sr.year = %s")
                post_params.append(target_year)

            where_clause = ("WHERE " + " AND ".join(post_conditions)) if post_conditions else ""
            post_params.append(limit)

            sql = f"""
                WITH {RIDERSHIP_ALL_CTE},
                {STATION_META_CTE},
                station_arrests AS (
                    SELECT station_complex_id, year, COUNT(*) AS total_arrests
                    FROM arrestsnypddataframe
                    GROUP BY station_complex_id, year
                ),
                station_ridership AS (
                    SELECT station_complex_id, year, SUM(ridership) AS total_ridership
                    FROM ridership_all
                    GROUP BY station_complex_id, year
                )
                SELECT
                    sm.station_complex,
                    sm.borough,
                    sr.year,
                    sr.total_ridership,
                    COALESCE(sa.total_arrests, 0)                                        AS total_arrests,
                    ROUND(100000.0 * COALESCE(sa.total_arrests, 0)
                          / NULLIF(sr.total_ridership, 0), 2)                           AS arrests_per_100k_riders
                FROM station_ridership sr
                JOIN station_meta sm ON sr.station_complex_id = sm.station_complex_id
                LEFT JOIN station_arrests sa
                    ON sr.station_complex_id = sa.station_complex_id
                    AND sr.year = sa.year
                {where_clause}
                ORDER BY arrests_per_100k_riders DESC
                LIMIT %s
            """
            cur.execute(sql, post_params)
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
