from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from database import get_db_connection
from .sql_common import resolve_years

router = APIRouter()


@router.get("/busiest")
def get_busiest_stations(
    limit: int = Query(10, ge=1, le=100),
    borough: Optional[str] = Query(None),
    years: Optional[List[int]] = Query(None),
    year: Optional[int] = Query(None),
):
    """Query 1: Top N Busiest Stations by Total Ridership across selected years."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            target_years = resolve_years(
                years,
                year,
                "SELECT MAX(year)::int AS max_year FROM station_year_ridership_mv",
                cur,
            )
            if not target_years:
                return []

            post_conditions: list[str] = []
            post_params: list = []
            if borough:
                post_conditions.append("borough ILIKE %s")
                post_params.append(borough)

            where_clause = "WHERE year = ANY(%s)"
            if post_conditions:
                where_clause += " AND " + " AND ".join(post_conditions)

            sql = f"""
                SELECT
                    station_complex,
                    borough,
                    SUM(total_ridership) AS total_ridership
                FROM station_summary_mv
                {where_clause}
                GROUP BY station_complex, borough
                ORDER BY total_ridership DESC
                LIMIT %s
            """
            cur.execute(sql, [target_years, *post_params, limit])
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


@router.get("/arrest-intensity")
def get_arrest_intensity(
    borough: Optional[str] = Query(None),
    years: Optional[List[int]] = Query(None),
    year: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=500),
):
    """Query 7: Station-Level Arrest Intensity vs. Ridership.

    Aggregates ridership and arrests across all selected years into a single
    row per station, then computes arrests-per-100k-riders against the
    combined totals.
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            target_years = resolve_years(
                years,
                year,
                "SELECT MAX(year)::int AS max_year FROM station_year_ridership_mv",
                cur,
            )
            if not target_years:
                return []

            post_conditions: list[str] = []
            post_params: list = []
            if borough:
                post_conditions.append("sm.borough ILIKE %s")
                post_params.append(borough)

            where_clause = ("WHERE " + " AND ".join(post_conditions)) if post_conditions else ""
            params: list = [target_years, target_years]
            params.extend(post_params)
            params.append(limit)

            sql = f"""
                WITH station_ridership AS (
                    SELECT station_complex_id, SUM(total_ridership) AS total_ridership
                    FROM station_year_ridership_mv
                    WHERE year = ANY(%s)
                    GROUP BY station_complex_id
                ),
                station_arrests AS (
                    SELECT station_complex_id, SUM(total_arrests) AS total_arrests
                    FROM station_year_arrests_mv
                    WHERE year = ANY(%s)
                    GROUP BY station_complex_id
                )
                SELECT
                    sm.station_complex,
                    sm.borough,
                    sr.total_ridership,
                    COALESCE(sa.total_arrests, 0) AS total_arrests,
                    ROUND(
                        (100000.0 * COALESCE(sa.total_arrests, 0) / NULLIF(sr.total_ridership, 0))::numeric,
                        2
                    ) AS arrests_per_100k_riders
                FROM station_ridership sr
                JOIN station_meta_mv sm
                    ON sr.station_complex_id = sm.station_complex_id
                LEFT JOIN station_arrests sa
                    ON sr.station_complex_id = sa.station_complex_id
                {where_clause}
                ORDER BY arrests_per_100k_riders DESC
                LIMIT %s
            """
            cur.execute(sql, params)
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
