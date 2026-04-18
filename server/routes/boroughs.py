from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from database import get_db_connection

router = APIRouter()


@router.get("/ridership-by-year")
def get_ridership_by_year(
    borough: Optional[str] = Query(None),
    year_start: Optional[int] = Query(None),
    year_end: Optional[int] = Query(None),
):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            conditions = ["borough IS NOT NULL"]
            params = []
            if borough:
                conditions.append("borough ILIKE %s")
                params.append(borough)
            if year_start is not None:
                conditions.append("year >= %s")
                params.append(year_start)
            if year_end is not None:
                conditions.append("year <= %s")
                params.append(year_end)

            where_clause = " AND ".join(conditions)
            sql = f"""
                SELECT borough, year, SUM(ridership) AS total_ridership
                FROM ridership
                WHERE {where_clause}
                GROUP BY borough, year
                ORDER BY borough, year
            """
            cur.execute(sql, params)
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


@router.get("/ada-stations")
def get_ada_stations(borough: Optional[str] = Query(None)):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            # borough param for stationcoords uses abbreviations; map full name -> abbrev if needed
            borough_map = {
                "brooklyn": "Bk",
                "bronx": "Bx",
                "manhattan": "M",
                "queens": "Q",
                "staten island": "SI",
            }

            conditions = ["ada = 1"]
            params = []
            if borough:
                mapped = borough_map.get(borough.lower(), borough)
                conditions.append("borough = %s")
                params.append(mapped)

            where_clause = " AND ".join(conditions)
            sql = f"""
                SELECT
                    CASE borough
                        WHEN 'Bk' THEN 'Brooklyn'
                        WHEN 'Bx' THEN 'Bronx'
                        WHEN 'M'  THEN 'Manhattan'
                        WHEN 'Q'  THEN 'Queens'
                        WHEN 'SI' THEN 'Staten Island'
                        ELSE borough
                    END AS borough,
                    COUNT(*) AS accessible_stations
                FROM stationcoords
                WHERE {where_clause}
                GROUP BY borough
                ORDER BY accessible_stations DESC
            """
            cur.execute(sql, params)
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


@router.get("/payment-share")
def get_payment_share(
    borough: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            conditions = ["borough IS NOT NULL"]
            params = []
            if borough:
                conditions.append("borough ILIKE %s")
                params.append(borough)
            if payment_method:
                conditions.append("payment_method ILIKE %s")
                params.append(payment_method)
            if year is not None:
                conditions.append("year = %s")
                params.append(year)

            where_clause = " AND ".join(conditions)
            sql = f"""
                SELECT borough, payment_method,
                    SUM(ridership) AS total_ridership,
                    ROUND(100.0 * SUM(ridership) / SUM(SUM(ridership)) OVER (PARTITION BY borough), 2) AS pct_of_borough
                FROM ridership
                WHERE {where_clause}
                GROUP BY borough, payment_method
                ORDER BY borough, total_ridership DESC
            """
            cur.execute(sql, params)
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


@router.get("/evasion-intensity")
def get_evasion_intensity(
    borough: Optional[str] = Query(None),
    year_start: Optional[int] = Query(None),
    year_end: Optional[int] = Query(None),
):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            br_conditions = ["r.borough IS NOT NULL"]
            br_params = []
            if borough:
                br_conditions.append("r.borough ILIKE %s")
                br_params.append(borough)
            if year_start is not None:
                br_conditions.append("r.year >= %s")
                br_params.append(year_start)
            if year_end is not None:
                br_conditions.append("r.year <= %s")
                br_params.append(year_end)

            br_where = " AND ".join(br_conditions)
            sql = f"""
                WITH borough_ridership AS (
                    SELECT r.borough, r.year, SUM(r.ridership) AS paid_rides
                    FROM ridership r
                    WHERE {br_where}
                    GROUP BY r.borough, r.year
                ),
                borough_evasion_est AS (
                    SELECT br.borough, br.year, br.paid_rides, fe_avg.avg_evasion_rate,
                        ROUND(br.paid_rides / NULLIF(1 - fe_avg.avg_evasion_rate, 0) * fe_avg.avg_evasion_rate) AS est_evaded_rides
                    FROM borough_ridership br
                    JOIN (
                        SELECT year, AVG(fare_evasion) AS avg_evasion_rate
                        FROM fareevasionstats
                        WHERE fare_evasion IS NOT NULL
                        GROUP BY year
                    ) fe_avg ON br.year = fe_avg.year
                )
                SELECT borough, year, paid_rides, est_evaded_rides,
                    ROUND(100000.0 * est_evaded_rides / NULLIF(paid_rides, 0), 2) AS est_evaded_per_100k_riders
                FROM borough_evasion_est
                ORDER BY year DESC, est_evaded_per_100k_riders DESC
            """
            cur.execute(sql, br_params)
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
