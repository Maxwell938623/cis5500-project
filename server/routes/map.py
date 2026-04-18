from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from database import get_db_connection

router = APIRouter()


@router.get("/top-non-cbd-stations")
def get_top_non_cbd_stations(
    borough: Optional[str] = Query(None),
    top_k: int = Query(5, ge=1, le=50),
):
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            sv_conditions = []
            sv_params = []
            if borough:
                sv_conditions.append("r.borough ILIKE %s")
                sv_params.append(borough)

            sv_where = ("WHERE " + " AND ".join(sv_conditions)) if sv_conditions else ""
            params = sv_params + [top_k]

            sql = f"""
                WITH station_volume AS (
                    SELECT r.station_complex_id, r.station_complex, r.borough,
                        SUM(r.ridership) AS total_ridership,
                        AVG(r.latitude) AS latitude,
                        AVG(r.longitude) AS longitude
                    FROM ridership r
                    {sv_where}
                    GROUP BY r.station_complex_id, r.station_complex, r.borough
                ),
                with_coords AS (
                    SELECT sv.station_complex, sv.borough, sv.total_ridership,
                        sv.latitude, sv.longitude,
                        sc.daytime_routes AS lines, sc.cbd AS is_cbd,
                        RANK() OVER (PARTITION BY sv.borough ORDER BY sv.total_ridership DESC) AS borough_rank
                    FROM station_volume sv
                    JOIN stationcoords sc ON sv.station_complex_id::text = sc.complex_id::text
                    WHERE sc.cbd = FALSE
                )
                SELECT station_complex, borough, lines, total_ridership,
                    latitude, longitude, borough_rank
                FROM with_coords
                WHERE borough_rank <= %s
                ORDER BY borough, borough_rank
            """
            cur.execute(sql, params)
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
