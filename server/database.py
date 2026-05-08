import os
import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "port": int(os.getenv("DB_PORT", 5432)),
    "dbname": os.getenv("DB_NAME"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "connect_timeout": int(os.getenv("DB_CONNECT_TIMEOUT", 600)),
    "options": os.getenv("DB_OPTIONS", "-c statement_timeout=600000"),
}


@contextmanager
def get_db_connection():
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG, cursor_factory=psycopg2.extras.RealDictCursor)
        yield conn
    except psycopg2.OperationalError as e:
        raise RuntimeError(f"Database connection failed: {e}")
    finally:
        if conn and not conn.closed:
            conn.close()


def _quote_ident(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def _resolve_fare_evasion_relation(cur):
    # Pick the best-available fare-evasion relation across schema variants.
    cur.execute(
        """
        SELECT
            n.nspname AS schema_name,
            c.relname AS relation_name
        FROM pg_class c
        JOIN pg_namespace n
          ON n.oid = c.relnamespace
        WHERE lower(c.relname) IN (
            'fareevasionstats',
            'fairevasion',
            'fairevasionstatsdataframe',
            'fareevasionstatsdataframe'
        )
          AND c.relkind IN ('r', 'v', 'm')
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY
            CASE lower(c.relname)
                WHEN 'fareevasionstats' THEN 1
                WHEN 'fairevasionstatsdataframe' THEN 2
                WHEN 'fareevasionstatsdataframe' THEN 3
                ELSE 4
            END,
            CASE n.nspname
                WHEN 'public' THEN 1
                ELSE 2
            END
        LIMIT 1
        """
    )
    row = cur.fetchone()
    if row:
        return row["schema_name"], row["relation_name"]

    raise RuntimeError(
        "Database relation missing: expected fareevasionstats or fairevasion (table/view/materialized view)"
    )


def resolve_fare_evasion_table(cur):
    schema_name, relation_name = _resolve_fare_evasion_relation(cur)
    return f"{_quote_ident(schema_name)}.{_quote_ident(relation_name)}"


def resolve_fare_evasion_source(cur):
    # Resolve canonical fare-evasion columns when source schemas differ.
    schema_name, relation_name = _resolve_fare_evasion_relation(cur)
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = %s
          AND table_name = %s
        """,
        [schema_name, relation_name],
    )
    raw_columns = [r["column_name"] for r in cur.fetchall()]
    columns_by_lower = {name.lower(): name for name in raw_columns}

    def pick_column(canonical_name, aliases):
        for alias in aliases:
            key = alias.lower()
            if key in columns_by_lower:
                return _quote_ident(columns_by_lower[key])
        raise RuntimeError(
            f"Missing required column for '{canonical_name}' in "
            f"{schema_name}.{relation_name}; found columns: {raw_columns}"
        )

    return {
        "table": f"{_quote_ident(schema_name)}.{_quote_ident(relation_name)}",
        "columns": {
            "year": pick_column("year", ["year"]),
            "quarter": pick_column("quarter", ["quarter"]),
            "fare_evasion": pick_column("fare_evasion", ["fare_evasion", "fare evasion"]),
            "margin_of_error": pick_column("margin_of_error", ["margin_of_error", "margin of error"]),
        },
    }
