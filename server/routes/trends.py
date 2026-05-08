from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from database import get_db_connection
from .sql_common import resolve_years

router = APIRouter()


@router.get("/annual")
def get_annual_trends(
    years: Optional[List[int]] = Query(None),
    year: Optional[int] = Query(None),
):
    # Build full year-month grid so missing months return as zeros.
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            target_years = resolve_years(
                years,
                year,
                "SELECT MAX(year)::int AS max_year FROM monthly_ridership_mv",
                cur,
            )
            if not target_years:
                return []

            sql = """
                WITH calendar AS (
                    SELECT y AS year, m AS month
                    FROM unnest(%s::int[]) AS y
                    CROSS JOIN generate_series(1, 12) AS m
                ),
                combined AS (
                    SELECT
                        c.year,
                        c.month,
                        COALESCE(mr.total_ridership, 0) AS total_ridership,
                        COALESCE(ma.total_arrests, 0)   AS total_arrests
                    FROM calendar c
                    LEFT JOIN monthly_ridership_mv mr
                        ON mr.year = c.year AND mr.month = c.month
                    LEFT JOIN monthly_arrests_mv ma
                        ON ma.year = c.year AND ma.month::int = c.month
                ),
                with_lag AS (
                    SELECT
                        year, month, total_ridership, total_arrests,
                        LAG(total_ridership) OVER (
                            PARTITION BY year ORDER BY month
                        ) AS prev_ridership,
                        LAG(total_arrests) OVER (
                            PARTITION BY year ORDER BY month
                        ) AS prev_arrests
                    FROM combined
                )
                SELECT
                    year, month, total_ridership, total_arrests,
                    CASE
                        WHEN month = 1 THEN 0
                        ELSE ROUND((100.0 * (total_ridership - prev_ridership)
                             / NULLIF(prev_ridership, 0))::numeric, 2)
                    END AS mom_ridership_change_pct,
                    CASE
                        WHEN month = 1 THEN 0
                        ELSE ROUND((100.0 * (total_arrests - prev_arrests)
                             / NULLIF(prev_arrests, 0))::numeric, 2)
                    END AS mom_arrest_change_pct
                FROM with_lag
                ORDER BY year, month
            """
            cur.execute(sql, [target_years])
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
