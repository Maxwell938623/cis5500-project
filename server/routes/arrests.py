from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from database import get_db_connection
from .sql_common import resolve_years

router = APIRouter()


@router.get("/by-charge-year")
def get_arrests_by_charge_year(
    years: Optional[List[int]] = Query(None),
    year: Optional[int] = Query(None),
):
    """Query 3: Total Arrests by Charge Severity for one or more selected years."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            target_years = resolve_years(
                years,
                year,
                "SELECT MAX(year)::int AS max_year FROM arrestsnypddataframe WHERE year IS NOT NULL",
                cur,
            )
            if not target_years:
                return []

            sql = """
                SELECT year::int AS year, law_cat_cd, COUNT(*) AS arrest_count
                FROM arrestsnypddataframe
                WHERE year::int = ANY(%s)
                  AND law_cat_cd IN ('F', 'M', 'V')
                GROUP BY year::int, law_cat_cd
                ORDER BY year::int, arrest_count DESC
            """
            cur.execute(sql, [target_years])
            rows = cur.fetchall()
            return [dict(r) for r in rows]
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")
