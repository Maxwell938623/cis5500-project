from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from database import get_db_connection

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

            sql = """
                SELECT
                    year,
                    quarter,
                    ROUND((fare_evasion * 100)::numeric, 2)    AS evasion_pct,
                    ROUND((margin_of_error * 100)::numeric, 2) AS margin_of_error_pct
                FROM fareevasionstats
                WHERE fare_evasion IS NOT NULL
                  AND year = %s
                ORDER BY year ASC, quarter ASC
            """
            cur.execute(sql, [target_year])
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
                cur.execute("SELECT MAX(year)::int AS max_year FROM quarterly_paid_ridership")
                row = cur.fetchone()
                target_year = row["max_year"] if row else None
            if target_year is None:
                return []

            sql = """
                SELECT
                    qr.year,
                    qr.quarter,
                    qr.total_paid_rides,
                    fe.fare_evasion AS evasion_rate,
                    ROUND((qr.total_paid_rides / NULLIF(1 - fe.fare_evasion, 0))::numeric)                          AS est_total_boardings,
                    ROUND((qr.total_paid_rides / NULLIF(1 - fe.fare_evasion, 0) * fe.fare_evasion)::numeric)        AS est_evaded_rides,
                    ROUND((qr.total_paid_rides / NULLIF(1 - fe.fare_evasion, 0) * fe.fare_evasion * 2.90)::numeric, 2) AS est_revenue_lost_usd
                FROM quarterly_paid_ridership qr
                JOIN fareevasionstats fe
                    ON qr.year = fe.year
                   AND qr.quarter = fe.quarter
                WHERE fe.fare_evasion IS NOT NULL
                  AND qr.year = %s
                ORDER BY qr.year, qr.quarter
            """
            cur.execute(sql, [target_year])
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
