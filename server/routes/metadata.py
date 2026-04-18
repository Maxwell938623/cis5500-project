from fastapi import APIRouter, HTTPException
from database import get_db_connection

router = APIRouter()


@router.get("/boroughs")
def get_boroughs():
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT DISTINCT borough FROM ridership WHERE borough IS NOT NULL ORDER BY borough"
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
                "SELECT DISTINCT daytime_routes FROM stationcoords WHERE daytime_routes IS NOT NULL ORDER BY daytime_routes"
            )
            rows = cur.fetchall()
            return [r["daytime_routes"] for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


@router.get("/payment-methods")
def get_payment_methods():
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT DISTINCT payment_method FROM ridership WHERE payment_method IS NOT NULL ORDER BY payment_method"
            )
            rows = cur.fetchall()
            return [r["payment_method"] for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


@router.get("/fare-categories")
def get_fare_categories():
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT DISTINCT fare_class_category FROM ridership WHERE fare_class_category IS NOT NULL ORDER BY fare_class_category"
            )
            rows = cur.fetchall()
            return [r["fare_class_category"] for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
