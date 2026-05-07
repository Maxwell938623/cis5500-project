from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from database import get_db_connection
from .sql_common import resolve_years

router = APIRouter()


@router.get("/top-stations")
def get_top_stations(
    borough: Optional[str] = Query(None),
    years: Optional[List[int]] = Query(None),
    year: Optional[int] = Query(None),
    top_k: int = Query(5, ge=1, le=100),
):
    """Query 10: Top Stations by Ridership with Arrest Counts per Borough.

    Sums ridership and arrests across all selected years and re-ranks within
    each borough by combined ridership. No CBD/geographic exclusions are
    applied so every Manhattan station (including south of 60th St) is
    eligible.
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            target_years = resolve_years(
                years,
                year,
                "SELECT MAX(year)::int AS max_year FROM station_summary_mv",
                cur,
            )
            if not target_years:
                return []

            inner_conditions = ["year = ANY(%s)"]
            params: list = [target_years]
            if borough:
                inner_conditions.append("borough ILIKE %s")
                params.append(borough)

            inner_where = " AND ".join(inner_conditions)
            params.append(top_k)

            sql = f"""
                WITH aggregated AS (
                    SELECT
                        station_complex,
                        borough,
                        AVG(latitude)  AS latitude,
                        AVG(longitude) AS longitude,
                        SUM(total_ridership) AS total_ridership,
                        SUM(total_arrests)   AS total_arrests
                    FROM station_summary_mv
                    WHERE {inner_where}
                    GROUP BY station_complex, borough
                ),
                ranked AS (
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
                    FROM aggregated
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
