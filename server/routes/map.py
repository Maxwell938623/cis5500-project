from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from database import get_db_connection

router = APIRouter()


@router.get("/top-non-cbd-stations")
def get_top_non_cbd_stations(
    borough: Optional[str] = Query(None),
    top_k: Optional[int] = Query(None, ge=1, le=100),
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
            params = sv_params + [top_k, top_k]

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
                stationcoords_dedup AS (
                    SELECT
                        complex_id::text AS complex_id,
                        MAX(daytime_routes) AS lines,
                        BOOL_OR(cbd) AS is_cbd
                    FROM stationcoords
                    GROUP BY complex_id::text
                ),
                with_coords AS (
                    SELECT sv.station_complex, sv.borough, sv.total_ridership,
                        sv.latitude, sv.longitude,
                        scd.lines, scd.is_cbd,
                        RANK() OVER (PARTITION BY sv.borough ORDER BY sv.total_ridership DESC) AS borough_rank
                    FROM station_volume sv
                    JOIN stationcoords_dedup scd ON sv.station_complex_id::text = scd.complex_id
                )
                SELECT station_complex, borough, lines, total_ridership,
                    latitude, longitude, borough_rank
                FROM with_coords
                WHERE (%s IS NULL OR borough_rank <= %s)
                ORDER BY borough, borough_rank
            """
            cur.execute(sql, params)
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
