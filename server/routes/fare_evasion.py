from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from database import get_db_connection

router = APIRouter()


@router.get("/quarterly")
def get_quarterly_evasion(
    year_start: Optional[int] = Query(None),
    year_end: Optional[int] = Query(None),
):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            conditions = ["fare_evasion IS NOT NULL"]
            params = []
            if year_start is not None:
                conditions.append("year >= %s")
                params.append(year_start)
            if year_end is not None:
                conditions.append("year <= %s")
                params.append(year_end)

            where_clause = " AND ".join(conditions)
            sql = f"""
                SELECT year, quarter,
                    ROUND(fare_evasion * 100, 2) AS evasion_pct,
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
    fare_amount: float = Query(2.90, ge=0.01),
    year_start: Optional[int] = Query(None),
    year_end: Optional[int] = Query(None),
):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            conditions = ["fe.fare_evasion IS NOT NULL"]
            params = [fare_amount]
            if year_start is not None:
                conditions.append("r.year >= %s")
                params.append(year_start)
            if year_end is not None:
                conditions.append("r.year <= %s")
                params.append(year_end)

            where_clause = " AND ".join(conditions)
            sql = f"""
                SELECT r.year, r.quarter,
                    SUM(r.ridership) AS total_paid_rides,
                    fe.fare_evasion AS evasion_rate,
                    ROUND(SUM(r.ridership) / NULLIF(1 - fe.fare_evasion, 0)) AS est_total_boardings,
                    ROUND(SUM(r.ridership) / NULLIF(1 - fe.fare_evasion, 0) * fe.fare_evasion) AS est_evaded_rides,
                    ROUND(CAST(SUM(r.ridership) / NULLIF(1 - fe.fare_evasion, 0) * fe.fare_evasion * %s AS numeric), 2) AS est_revenue_lost_usd
                FROM ridership r
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
