from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from database import get_db_connection

router = APIRouter()


@router.get("/annual")
def get_annual_trends(
    year: Optional[int] = Query(None),
):
    """Single-year monthly ridership and arrest trends with month-over-month change."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            target_year = year
            if target_year is None:
                cur.execute("SELECT MAX(year)::int AS max_year FROM monthly_ridership_mv")
                row = cur.fetchone()
                target_year = row["max_year"] if row else None

            if target_year is None:
                return []

            sql = """
                WITH calendar AS (
                    SELECT generate_series(1, 12) AS month
                ),
                combined AS (
                    SELECT
                        %s::int                          AS year,
                        c.month,
                        COALESCE(mr.total_ridership, 0)  AS total_ridership,
                        COALESCE(ma.total_arrests, 0)    AS total_arrests
                    FROM calendar c
                    LEFT JOIN monthly_ridership_mv mr
                        ON mr.year = %s::int AND mr.month = c.month
                    LEFT JOIN monthly_arrests_mv ma
                        ON ma.year = %s::int AND ma.month = c.month
                ),
                with_lag AS (
                    SELECT
                        year,
                        month,
                        total_ridership,
                        total_arrests,
                        LAG(total_ridership) OVER (ORDER BY month) AS prev_ridership,
                        LAG(total_arrests)   OVER (ORDER BY month) AS prev_arrests
                    FROM combined
                )
                SELECT
                    year,
                    month,
                    total_ridership,
                    total_arrests,
                    CASE
                        WHEN month = 1 THEN 0
                        ELSE ROUND((100.0 * (total_ridership - prev_ridership) / NULLIF(prev_ridership, 0))::numeric, 2)
                    END AS mom_ridership_change_pct,
                    CASE
                        WHEN month = 1 THEN 0
                        ELSE ROUND((100.0 * (total_arrests - prev_arrests) / NULLIF(prev_arrests, 0))::numeric, 2)
                    END AS mom_arrest_change_pct
                FROM with_lag
                ORDER BY month
            """
            cur.execute(sql, [target_year, target_year, target_year])
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
