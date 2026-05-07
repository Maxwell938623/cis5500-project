from fastapi import APIRouter, HTTPException
from database import get_db_connection
from .sql_common import STATION_META_CTE

router = APIRouter()


@router.get("/boroughs")
def get_boroughs():
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                f"""
                WITH {STATION_META_CTE}
                SELECT DISTINCT borough
                FROM station_meta
                WHERE borough IS NOT NULL
                ORDER BY borough
                """
            )
            rows = cur.fetchall()
            return [r["borough"] for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


@router.get("/lines")
def get_lines():
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT DISTINCT "Daytime Routes" AS daytime_routes
                FROM stationcoordsdataframe
                WHERE "Daytime Routes" IS NOT NULL
                ORDER BY "Daytime Routes"
                """
            )
            rows = cur.fetchall()
            return [r["daytime_routes"] for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
