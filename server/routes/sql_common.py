"""Shared SQL helpers for the optimized routes.

The heavy yearly UNION-ALL CTE constants that used to live here have been
replaced by materialized views (``monthly_ridership_mv``,
``station_year_ridership_mv``, ``borough_ridership_mv``, ``station_summary_mv``,
``demographic_arrests_mv``, ``quarterly_paid_ridership``, etc.) that already
pre-aggregate every fact by year. Routes now read those MVs directly.

What stays here is the multi-year resolution helper used by every year-aware
endpoint to validate, dedupe, and sort the ``years`` list query param while
still accepting the legacy ``year`` single-value param.
"""

from typing import Iterable, Optional


VALID_YEARS = {2020, 2021, 2022, 2023, 2024}


def resolve_years(
    years: Optional[Iterable[int]],
    year: Optional[int],
    fallback_latest_sql: str,
    cur,
) -> list[int]:
    """Validate, dedupe, and sort multi-year input.

    Accepts the new ``years`` list param and the legacy single-value ``year``
    param. Falls back to the latest available year via ``fallback_latest_sql``
    when no valid years are supplied. Returns ``[]`` only if the fallback
    itself returns no data.
    """
    selected: list[int] = []
    if years:
        selected.extend(int(y) for y in years if y is not None)
    if year is not None:
        selected.append(int(year))

    selected = [y for y in selected if y in VALID_YEARS]

    if not selected:
        cur.execute(fallback_latest_sql)
        row = cur.fetchone()
        latest = row["max_year"] if row else None
        return [int(latest)] if latest is not None else []

    return sorted(set(selected))
