"""Connectivity + schema smoke test. Run this the moment credentials are in .env:

    python check_connections.py

It (1) connects to Postgres and ClickHouse, (2) confirms read access, and
(3) introspects the columns of the key tables the agent maps onto — so we verify
the PostgresRepo mapping against reality instead of guessing.
"""
from __future__ import annotations
import config

PG_TABLES = ["Trips", "TripSeats", "ReservedTicketSeats", "ServiceAnalyticsData", "Routes"]


def check_postgres():
    print("\n=== PostgreSQL ===")
    if not config.have_postgres():
        print("  not configured (set POSTGRES_* in .env)"); return
    try:
        import psycopg2, psycopg2.extras
        conn = psycopg2.connect(config.postgres_dsn())
        conn.set_session(readonly=True, autocommit=True)
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT version()")
        print("  connected:", cur.fetchone()["version"][:60])
        for t in PG_TABLES:
            try:
                cur.execute(
                    "SELECT column_name, data_type FROM information_schema.columns "
                    "WHERE table_name = %s ORDER BY ordinal_position", (t,))
                cols = cur.fetchall()
                if cols:
                    names = ", ".join(c["column_name"] for c in cols)
                    print(f"  ✓ {t} ({len(cols)} cols): {names[:160]}")
                else:
                    print(f"  ✗ {t}: not found / no access")
            except Exception as e:
                print(f"  ✗ {t}: {e}")
        # row counts for the live tables
        for t in ("Trips", "TripSeats"):
            try:
                cur.execute(f'SELECT count(*) AS n FROM "{t}"')
                print(f"    {t} rows: {cur.fetchone()['n']}")
            except Exception as e:
                print(f"    {t} count failed: {e}")
        conn.close()
    except Exception as e:
        print("  CONNECTION FAILED:", e)


def check_clickhouse():
    print("\n=== ClickHouse ===")
    if not config.have_clickhouse():
        print("  not configured (set CLICKHOUSE_* in .env)"); return
    try:
        from db.clickhouse_store import ClickHouseStore
        ch = ClickHouseStore()
        print("  connected, version:", ch.ping())
        rows = ch.query("SELECT name FROM system.columns "
                        "WHERE database = {db:String} AND table = 'bus_ticket_data' LIMIT 5",
                        {"db": config.clickhouse_config()["database"]})
        print("  bus_ticket_data sample cols:", [r[0] for r in rows])
        print("  creating decisions table (new-table write test) …")
        ch.ensure_decisions_table()
        print("  ✓ fs_pricing_decisions ready (CREATE permission OK)")
    except Exception as e:
        print("  CONNECTION FAILED:", e)


if __name__ == "__main__":
    print("FreshBus — connection smoke test")
    check_postgres()
    check_clickhouse()
    print("\nDone. Share any ✗ lines and I'll fix the schema mapping.")
