from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from database import get_db_connection, resolve_fare_evasion_source
from .sql_common import resolve_years

router = APIRouter()


@router.get("/quarterly")
def get_quarterly_evasion(
    years: Optional[List[int]] = Query(None),
    year: Optional[int] = Query(None),
):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            fare_evasion_source = resolve_fare_evasion_source(cur)
            fare_evasion_table = fare_evasion_source["table"]
            fare_evasion_cols = fare_evasion_source["columns"]

            target_years = resolve_years(
                years,
                year,
                f"SELECT MAX({fare_evasion_cols['year']})::int AS max_year "
                f"FROM {fare_evasion_table} "
                f"WHERE {fare_evasion_cols['year']} IS NOT NULL",
                cur,
            )
            if not target_years:
                return []

            sql = """
                SELECT
                    {year_col} AS year,
                    {quarter_col} AS quarter,
                    ROUND(({fare_evasion_col} * 100)::numeric, 2)    AS evasion_pct,
                    ROUND(({margin_of_error_col} * 100)::numeric, 2) AS margin_of_error_pct
                FROM {fare_evasion_table}
                WHERE {fare_evasion_col} IS NOT NULL
                  AND {year_col} = ANY(%s)
                ORDER BY {year_col} ASC, {quarter_col} ASC
            """
            sql = sql.format(
                fare_evasion_table=fare_evasion_table,
                year_col=fare_evasion_cols["year"],
                quarter_col=fare_evasion_cols["quarter"],
                fare_evasion_col=fare_evasion_cols["fare_evasion"],
                margin_of_error_col=fare_evasion_cols["margin_of_error"],
            )
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
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            fare_evasion_source = resolve_fare_evasion_source(cur)
            fare_evasion_table = fare_evasion_source["table"]
            fare_evasion_cols = fare_evasion_source["columns"]

            target_years = resolve_years(
                years,
                year,
                "SELECT MAX(year)::int AS max_year FROM quarterly_paid_ridership",
                cur,
            )
            if not target_years:
                return []

            sql = """
                SELECT
                    qr.year,
                    qr.quarter,
                    qr.total_paid_rides,
                    fe.{fare_evasion_col} AS evasion_rate,
                    ROUND((qr.total_paid_rides / NULLIF(1 - fe.{fare_evasion_col}, 0))::numeric)                                  AS est_total_boardings,
                    ROUND((qr.total_paid_rides / NULLIF(1 - fe.{fare_evasion_col}, 0) * fe.{fare_evasion_col})::numeric)        AS est_evaded_rides,
                    ROUND((qr.total_paid_rides / NULLIF(1 - fe.{fare_evasion_col}, 0) * fe.{fare_evasion_col} * 2.90)::numeric, 2) AS est_revenue_lost_usd
                FROM quarterly_paid_ridership qr
                JOIN {fare_evasion_table} fe
                    ON qr.year = fe.{year_col}
                   AND qr.quarter = fe.{quarter_col}
                WHERE fe.{fare_evasion_col} IS NOT NULL
                  AND qr.year = ANY(%s)
                ORDER BY qr.year, qr.quarter
            """
            sql = sql.format(
                fare_evasion_table=fare_evasion_table,
                year_col=fare_evasion_cols["year"],
                quarter_col=fare_evasion_cols["quarter"],
                fare_evasion_col=fare_evasion_cols["fare_evasion"],
            )
            cur.execute(sql, [target_years])
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
