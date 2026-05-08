# Normalize year-query inputs for routes that support years/year params.

from typing import Iterable, Optional


VALID_YEARS = {2020, 2021, 2022, 2023, 2024}


def resolve_years(
    years: Optional[Iterable[int]],
    year: Optional[int],
    fallback_latest_sql: str,
    cur,
) -> list[int]:
    selected: list[int] = []
    if years:
        selected.extend(int(y) for y in years if y is not None)
    if year is not None:
        selected.append(int(year))

    selected = [y for y in selected if y in VALID_YEARS]

    if not selected:
        # Fallback to latest available year when filters are missing/invalid.
        cur.execute(fallback_latest_sql)
        row = cur.fetchone()
        latest = row["max_year"] if row else None
        return [int(latest)] if latest is not None else []

    return sorted(set(selected))
