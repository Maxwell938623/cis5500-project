"""Deprecated SQL helpers.

The inline yearly-UNION CTE constants previously exported from this module
have been replaced by materialized views (``station_meta_mv``,
``station_year_ridership_mv``, ``monthly_ridership_mv``,
``borough_ridership_mv``, ``station_summary_mv``,
``quarterly_paid_ridership``, etc.) created in the database. Routes now read
those MVs directly. The module is kept (rather than deleted) so that any
stale ``from .sql_common import ...`` of the old constants surfaces as a
clean ``ImportError`` on the missing name instead of silently rebuilding the
heavy yearly UNION ALL aggregates.
"""
