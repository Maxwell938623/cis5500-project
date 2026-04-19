from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from database import get_db_connection

router = APIRouter()


@router.get("/by-charge-year")
def get_arrests_by_charge_year(year: Optional[int] = Query(None)):
    """Query 3: Total Arrests by Charge Severity and Year"""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            target_year = year
            if target_year is None:
                cur.execute("SELECT MAX(year::int) AS max_year FROM arrestsnypddataframe WHERE year IS NOT NULL")
                row = cur.fetchone()
                target_year = row["max_year"] if row else None
            if target_year is None:
                return []

            where_clause = "WHERE year::int = %s AND LAW_CAT_CD IN ('F', 'M', 'V')"
            sql = f"""
                SELECT year::int AS year, LAW_CAT_CD AS law_cat_cd, COUNT(*) AS arrest_count
                FROM arrestsnypddataframe
                {where_clause}
                GROUP BY year, LAW_CAT_CD
                ORDER BY year, arrest_count DESC
            """
            cur.execute(sql, [target_year])
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
