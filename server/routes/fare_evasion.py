from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from database import get_db_connection
from .sql_common import RIDERSHIP_ALL_CTE, resolve_years

router = APIRouter()


@router.get("/quarterly")
def get_quarterly_evasion(
    years: Optional[List[int]] = Query(None),
    year: Optional[int] = Query(None),
):
    """Query 2: Quarterly System-Wide Fare Evasion Rate across selected years."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            target_years = resolve_years(
                years,
                year,
                "SELECT MAX(year)::int AS max_year FROM fairevasionstatsdataframe WHERE year IS NOT NULL",
                cur,
            )
            if not target_years:
                return []

            sql = """
                SELECT year, quarter,
                       ROUND(("Fare Evasion" * 100)::numeric, 2)    AS evasion_pct,
                       ROUND(("Margin of Error" * 100)::numeric, 2) AS margin_of_error_pct
                FROM fairevasionstatsdataframe
                WHERE "Fare Evasion" IS NOT NULL AND year = ANY(%s)
                ORDER BY year ASC, quarter ASC
            """
            cur.execute(sql, [target_years])
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


@router.get("/revenue-loss")
def get_revenue_loss(
    years: Optional[List[int]] = Query(None),
    year: Optional[int] = Query(None),
):
    """Query 6: Estimated Revenue Lost to Fare Evasion per Quarter across selected years."""
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

            sql = f"""
                WITH {RIDERSHIP_ALL_CTE}
                SELECT
                    r.year,
                    r.quarter,
                    SUM(r.ridership)                                                                AS total_paid_rides,
                    fe."Fare Evasion"                                                               AS evasion_rate,
                    ROUND((SUM(r.ridership) / NULLIF(1 - fe."Fare Evasion", 0))::numeric)           AS est_total_boardings,
                    ROUND((SUM(r.ridership) / NULLIF(1 - fe."Fare Evasion", 0)
                          * fe."Fare Evasion")::numeric)                                            AS est_evaded_rides,
                    ROUND((SUM(r.ridership) / NULLIF(1 - fe."Fare Evasion", 0)
                          * fe."Fare Evasion" * 2.90)::numeric, 2)                                  AS est_revenue_lost_usd
                FROM ridership_all r
                JOIN fairevasionstatsdataframe fe
                    ON r.year = fe.year AND r.quarter = fe.quarter
                WHERE fe."Fare Evasion" IS NOT NULL AND r.year = ANY(%s)
                GROUP BY r.year, r.quarter, fe."Fare Evasion"
                ORDER BY r.year, r.quarter
            """
            cur.execute(sql, [target_years])
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
