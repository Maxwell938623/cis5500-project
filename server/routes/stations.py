from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from database import get_db_connection

router = APIRouter()


@router.get("/busiest")
def get_busiest_stations(
    limit: int = Query(10, ge=1, le=100),
    year_start: Optional[int] = Query(None),
    year_end: Optional[int] = Query(None),
    borough: Optional[str] = Query(None),
):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            conditions = ["borough IS NOT NULL"]
            params = []

            if year_start is not None:
                conditions.append("year >= %s")
                params.append(year_start)
            if year_end is not None:
                conditions.append("year <= %s")
                params.append(year_end)
            if borough:
                conditions.append("borough ILIKE %s")
                params.append(borough)

            where_clause = " AND ".join(conditions)
            params.append(limit)

            sql = f"""
                SELECT station_complex, borough, SUM(ridership) AS total_ridership
                FROM ridership
                WHERE {where_clause}
                GROUP BY station_complex, borough
                ORDER BY total_ridership DESC
                LIMIT %s
            """
            cur.execute(sql, params)
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


@router.get("/risk-profile")
def get_station_risk_profile(
    borough: Optional[str] = Query(None),
    station_name: Optional[str] = Query(None),
    line: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            rid_conditions = []
            rid_params = []
            if borough:
                rid_conditions.append("r.borough ILIKE %s")
                rid_params.append(borough)
            if station_name:
                rid_conditions.append("r.station_complex ILIKE %s")
                rid_params.append(f"%{station_name}%")

            rid_where = ("WHERE " + " AND ".join(rid_conditions)) if rid_conditions else ""

            post_params = []
            line_filter = ""
            if line:
                line_filter = "WHERE daytime_routes ILIKE %s"
                post_params.append(f"%{line}%")

            post_params.append(limit)

            sql = f"""
                WITH station_fare_breakdown AS (
                    SELECT r.station_complex_id, r.station_complex, r.borough,
                        SUM(r.ridership) AS total_ridership,
                        SUM(CASE WHEN fare_class_category ILIKE '%%unlimited%%' OR fare_class_category ILIKE '%%full fare%%' THEN ridership ELSE 0 END) AS full_fare_rides,
                        SUM(CASE WHEN fare_class_category ILIKE '%%reduced%%' OR fare_class_category ILIKE '%%student%%' OR fare_class_category ILIKE '%%senior%%' THEN ridership ELSE 0 END) AS reduced_fare_rides
                    FROM ridership r
                    {rid_where}
                    GROUP BY r.station_complex_id, r.station_complex, r.borough
                ),
                station_risk AS (
                    SELECT sfd.*,
                        ROUND(100.0 * reduced_fare_rides / NULLIF(total_ridership, 0), 2) AS reduced_fare_pct,
                        RANK() OVER (PARTITION BY sfd.borough ORDER BY 100.0 * reduced_fare_rides / NULLIF(total_ridership, 0) DESC) AS borough_rank,
                        sc.daytime_routes, sc.ada, sc.cbd, sc.structure
                    FROM station_fare_breakdown sfd
                    LEFT JOIN stationcoords sc ON sfd.station_complex_id::text = sc.complex_id::text
                )
                SELECT station_complex, borough, total_ridership, reduced_fare_pct,
                    borough_rank, daytime_routes, ada, cbd, structure
                FROM station_risk
                {line_filter}
                ORDER BY borough, borough_rank
                LIMIT %s
            """
            cur.execute(sql, rid_params + post_params)
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


@router.get("/search")
def search_stations(q: str = Query("", min_length=0)):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT DISTINCT station_complex, borough,
                    MIN(station_complex_id) AS station_complex_id
                FROM ridership
                WHERE station_complex ILIKE %s
                GROUP BY station_complex, borough
                ORDER BY station_complex
                LIMIT 20
                """,
                (f"%{q}%",),
            )
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


@router.get("/{station_complex_id}")
def get_station_detail(station_complex_id: str):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT r.station_complex_id, r.station_complex, r.borough,
                    SUM(r.ridership) AS total_ridership,
                    ROUND(100.0 * SUM(CASE WHEN fare_class_category ILIKE '%%reduced%%' OR fare_class_category ILIKE '%%student%%' OR fare_class_category ILIKE '%%senior%%' THEN ridership ELSE 0 END) / NULLIF(SUM(r.ridership), 0), 2) AS reduced_fare_pct,
                    sc.daytime_routes, sc.ada, sc.cbd, sc.structure,
                    sc.gtfs_latitude AS latitude, sc.gtfs_longitude AS longitude
                FROM ridership r
                LEFT JOIN stationcoords sc ON r.station_complex_id::text = sc.complex_id::text
                WHERE r.station_complex_id = %s
                GROUP BY r.station_complex_id, r.station_complex, r.borough,
                    sc.daytime_routes, sc.ada, sc.cbd, sc.structure,
                    sc.gtfs_latitude, sc.gtfs_longitude
                """,
                (station_complex_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Station not found")
            return dict(row)
    except HTTPException:
        raise
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
