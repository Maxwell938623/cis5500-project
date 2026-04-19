from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from database import get_db_connection
from .sql_common import RIDERSHIP_ALL_CTE

router = APIRouter()


@router.get("/quarterly")
def get_quarterly_evasion(
    year: Optional[int] = Query(None),
):
    """Query 2: Quarterly System-Wide Fare Evasion Rate Over Time"""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            target_year = year
            if target_year is None:
                cur.execute("SELECT MAX(year)::int AS max_year FROM fareevasionstats WHERE year IS NOT NULL")
                row = cur.fetchone()
                target_year = row["max_year"] if row else None
            if target_year is None:
                return []

            conditions = ["fare_evasion IS NOT NULL"]
            params = [target_year]
            conditions.append("year = %s")

            where_clause = " AND ".join(conditions)
            sql = f"""
                SELECT year, quarter,
                       ROUND(fare_evasion * 100, 2)    AS evasion_pct,
                       ROUND(margin_of_error * 100, 2) AS margin_of_error_pct
                FROM fareevasionstats
                WHERE {where_clause}
                ORDER BY year ASC, quarter ASC
            """
            cur.execute(sql, params)
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


@router.get("/revenue-loss")
def get_revenue_loss(
    year: Optional[int] = Query(None),
):
    """Query 6: Estimated Revenue Lost to Fare Evasion per Quarter"""
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

            conditions = ["fe.fare_evasion IS NOT NULL"]
            params = [target_year]
            conditions.append("r.year = %s")

            where_clause = " AND ".join(conditions)
            sql = f"""
                WITH {RIDERSHIP_ALL_CTE}
                SELECT
                    r.year,
                    r.quarter,
                    SUM(r.ridership)                                                      AS total_paid_rides,
                    fe.fare_evasion                                                        AS evasion_rate,
                    ROUND(SUM(r.ridership) / NULLIF(1 - fe.fare_evasion, 0))              AS est_total_boardings,
                    ROUND(SUM(r.ridership) / NULLIF(1 - fe.fare_evasion, 0)
                          * fe.fare_evasion)                                              AS est_evaded_rides,
                    ROUND(SUM(r.ridership) / NULLIF(1 - fe.fare_evasion, 0)
                          * fe.fare_evasion * 2.90, 2)                                   AS est_revenue_lost_usd
                FROM ridership_all r
                JOIN fareevasionstats fe ON r.year = fe.year AND r.quarter = fe.quarter
                WHERE {where_clause}
                GROUP BY r.year, r.quarter, fe.fare_evasion
                ORDER BY r.year, r.quarter
            """
            cur.execute(sql, params)
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
