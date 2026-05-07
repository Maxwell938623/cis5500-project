from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from database import get_db_connection, resolve_fare_evasion_source
from .sql_common import resolve_years

router = APIRouter()


@router.get("/ada-stations")
def get_ada_stations():
    """Query 5: ADA-Accessible Stations per Borough"""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT borough, COUNT(*) AS accessible_stations
                FROM stationcoordsdataframe
                WHERE ada = '1'
                GROUP BY borough
                ORDER BY accessible_stations DESC
                """
            )
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


@router.get("/demographic-arrests")
def get_demographic_arrests(
    borough: Optional[str] = Query(None),
    years: Optional[List[int]] = Query(None),
    year: Optional[int] = Query(None),
):
    """Query 4: Demographic Breakdown of Arrests by Borough across selected years."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            target_years = resolve_years(
                years,
                year,
                "SELECT MAX(year)::int AS max_year FROM demographic_arrests_mv WHERE year IS NOT NULL",
                cur,
            )
            if not target_years:
                return []

            conditions = ["borough IS NOT NULL", "year = ANY(%s)"]
            params: list = [target_years]
            if borough:
                conditions.append("borough ILIKE %s")
                params.append(borough)

            where_clause = " AND ".join(conditions)
            sql = f"""
                SELECT
                    borough,
                    age_group,
                    perp_race,
                    SUM(arrest_count) AS arrest_count
                FROM demographic_arrests_mv
                WHERE {where_clause}
                GROUP BY borough, age_group, perp_race
                ORDER BY borough, arrest_count DESC
            """
            cur.execute(sql, params)
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


@router.get("/enforcement-disparity")
def get_enforcement_disparity(
    years: Optional[List[int]] = Query(None),
    year: Optional[int] = Query(None),
):
    """Query 8: Borough Enforcement Disparity, returns one row per (borough, year)."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            fare_evasion_source = resolve_fare_evasion_source(cur)
            fare_evasion_table = fare_evasion_source["table"]
            fare_evasion_cols = fare_evasion_source["columns"]

            target_years = resolve_years(
                years,
                year,
                "SELECT MAX(year)::int AS max_year FROM borough_ridership_mv",
                cur,
            )
            if not target_years:
                return []

            sql = """
                WITH annual_evasion AS (
                    SELECT
                        {year_col} AS year,
                        AVG({fare_evasion_col}) AS avg_evasion_rate
                    FROM {fare_evasion_table}
                    WHERE {fare_evasion_col} IS NOT NULL
                      AND {year_col} = ANY(%s)
                    GROUP BY {year_col}
                ),
                borough_est_evasion AS (
                    SELECT
                        br.borough,
                        br.year,
                        br.paid_rides,
                        ae.avg_evasion_rate,
                        ROUND(
                            (br.paid_rides / NULLIF(1 - ae.avg_evasion_rate, 0) * ae.avg_evasion_rate)::numeric
                        ) AS est_evaded_rides
                    FROM borough_ridership_mv br
                    JOIN annual_evasion ae
                        ON br.year = ae.year
                    WHERE br.year = ANY(%s)
                )
                SELECT
                    be.borough,
                    be.year,
                    be.est_evaded_rides,
                    COALESCE(ba.total_arrests, 0) AS total_arrests,
                    ROUND(
                        (100.0 * COALESCE(ba.total_arrests, 0) / NULLIF(be.est_evaded_rides, 0))::numeric,
                        4
                    ) AS arrest_to_evasion_ratio
                FROM borough_est_evasion be
                LEFT JOIN borough_arrests_mv ba
                    ON be.borough = ba.borough
                   AND be.year    = ba.year
                ORDER BY be.year DESC, arrest_to_evasion_ratio DESC
            """
            sql = sql.format(
                fare_evasion_table=fare_evasion_table,
                year_col=fare_evasion_cols["year"],
                fare_evasion_col=fare_evasion_cols["fare_evasion"],
            )
            cur.execute(sql, [target_years, target_years])
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
