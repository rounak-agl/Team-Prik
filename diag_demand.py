"""Diagnose why LY-demand returns nothing (all trips classed 'pseudo').
Compares Postgres Trips.serviceNumber vs ClickHouse bus_ticket_data.Service_Number
and checks date coverage. Read-only. Run on the networked machine:

    python3 diag_demand.py
"""
from __future__ import annotations
import config


def main():
    import psycopg2, psycopg2.extras
    conn = psycopg2.connect(config.postgres_dsn())
    conn.set_session(readonly=True, autocommit=True)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute('SELECT id, "serviceNumber", "journeyDate" FROM "Trips" '
                'WHERE active = TRUE ORDER BY "journeyDate" LIMIT 5')
    pg = cur.fetchall()
    print("=== Postgres Trips sample (id, serviceNumber, journeyDate) ===")
    for r in pg:
        print(f"  id={r['id']}  serviceNumber={r['serviceNumber']!r}  journeyDate={r['journeyDate']}")

    from db.clickhouse_store import ClickHouseStore
    ch = ClickHouseStore()
    print("\n=== ClickHouse bus_ticket_data.Service_Number sample (20 distinct) ===")
    print(" ", ch.query("SELECT DISTINCT Service_Number FROM freshbus_operations.bus_ticket_data "
                        "ORDER BY Service_Number LIMIT 20"))
    print("\n=== ClickHouse Journey_Date range ===")
    print(" ", ch.query("SELECT min(Journey_Date), max(Journey_Date) "
                        "FROM freshbus_operations.bus_ticket_data"))

    if pg:
        sn = str(pg[0]["serviceNumber"])
        print(f"\n=== CH rows for Service_Number={sn!r} (any date) ===")
        print(" ", ch.query("SELECT count(), min(Journey_Date), max(Journey_Date) "
                            "FROM freshbus_operations.bus_ticket_data "
                            "WHERE Service_Number = {sn:String}", {"sn": sn}))
        # also try matching by the trip id as service number, in case columns differ
        print(f"=== CH rows where Service_Number LIKE %{sn}% ===")
        print(" ", ch.query("SELECT DISTINCT Service_Number FROM freshbus_operations.bus_ticket_data "
                            "WHERE Service_Number LIKE {p:String} LIMIT 10", {"p": f"%{sn}%"}))


if __name__ == "__main__":
    main()
