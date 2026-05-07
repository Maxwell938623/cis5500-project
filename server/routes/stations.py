from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from database import get_db_connection

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
                cur.execute("SELECT MAX(year)::int AS max_year FROM station_year_ridership_mv")
                row = cur.fetchone()
                target_year = row["max_year"] if row else None
            if target_year is None:
                return []

            sql = """
                SELECT
                    station_complex,
                    borough,
                    total_ridership
                FROM station_summary_mv
                WHERE year = %s
                ORDER BY total_ridership DESC
                LIMIT %s
            """
            cur.execute(sql, [target_year, limit])
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
                cur.execute("SELECT MAX(year)::int AS max_year FROM station_year_ridership_mv")
                row = cur.fetchone()
                target_year = row["max_year"] if row else None
            if target_year is None:
                return []

            conditions = []
            params = []
            if borough:
                conditions.append("sm.borough ILIKE %s")
                params.append(borough)
            if target_year is not None:
                conditions.append("sr.year = %s")
                params.append(target_year)

            where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""
            params.append(limit)

            sql = f"""
                SELECT
                    sm.station_complex,
                    sm.borough,
                    sr.year,
                    sr.total_ridership,
                    COALESCE(sa.total_arrests, 0) AS total_arrests,
                    ROUND(
                        (100000.0 * COALESCE(sa.total_arrests, 0) / NULLIF(sr.total_ridership, 0))::numeric,
                        2
                    ) AS arrests_per_100k_riders
                FROM station_year_ridership_mv sr
                JOIN station_meta_mv sm
                    ON sr.station_complex_id = sm.station_complex_id
                LEFT JOIN station_year_arrests_mv sa
                    ON sr.station_complex_id = sa.station_complex_id
                   AND sr.year                = sa.year
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
