from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from database import get_db_connection

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
                cur.execute("SELECT MAX(year)::int AS max_year FROM station_summary_mv")
                row = cur.fetchone()
                target_year = row["max_year"] if row else None
            if target_year is None:
                return []

            inner_conditions = ["NOT is_cbd"]
            params = []
            if target_year is not None:
                inner_conditions.append("year = %s")
                params.append(target_year)
            if borough:
                inner_conditions.append("borough ILIKE %s")
                params.append(borough)

            inner_where = " AND ".join(inner_conditions)
            params.append(top_k)

            sql = f"""
                WITH ranked AS (
                    SELECT
                        station_complex,
                        borough,
                        latitude,
                        longitude,
                        total_ridership,
                        total_arrests,
                        RANK() OVER (
                            PARTITION BY borough
                            ORDER BY total_ridership DESC
                        ) AS borough_rank
                    FROM station_summary_mv
                    WHERE {inner_where}
                )
                SELECT
                    station_complex,
                    borough,
                    latitude,
                    longitude,
                    total_ridership,
                    total_arrests,
                    borough_rank
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
