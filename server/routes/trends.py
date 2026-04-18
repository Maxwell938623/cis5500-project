from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from database import get_db_connection

router = APIRouter()


@router.get("/ridership-vs-evasion")
def get_ridership_vs_evasion(
    year_start: Optional[int] = Query(None),
    year_end: Optional[int] = Query(None),
):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            conditions = []
            params = []
            if year_start is not None:
                conditions.append("r.year >= %s")
                params.append(year_start)
            if year_end is not None:
                conditions.append("r.year <= %s")
                params.append(year_end)

            where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

            sql = f"""
                WITH annual_stats AS (
                    SELECT r.year,
                        SUM(r.ridership) AS total_ridership,
                        AVG(fe.fare_evasion) AS avg_evasion_rate
                    FROM ridership r
                    LEFT JOIN fareevasionstats fe ON r.year = fe.year AND fe.fare_evasion IS NOT NULL
                    {where_clause}
                    GROUP BY r.year
                ),
                with_lag AS (
                    SELECT year, total_ridership,
                        ROUND(avg_evasion_rate * 100, 3) AS evasion_pct,
                        LAG(total_ridership) OVER (ORDER BY year) AS prev_ridership,
                        LAG(avg_evasion_rate) OVER (ORDER BY year) AS prev_evasion
                    FROM annual_stats
                )
                SELECT year, total_ridership, evasion_pct,
                    ROUND(100.0 * (total_ridership - prev_ridership) / NULLIF(prev_ridership, 0), 2) AS yoy_ridership_change_pct,
                    ROUND(100.0 * (evasion_pct/100 - prev_evasion) / NULLIF(prev_evasion, 0), 2) AS yoy_evasion_change_pct
                FROM with_lag
                ORDER BY year
            """
            cur.execute(sql, params)
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
