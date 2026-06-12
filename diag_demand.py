"""Diagnose LY-demand on the ACTUAL live trips (journeyDate >= today, the ones
run.py prices) and call ly_demand_score directly. Read-only.

    python3 diag_demand.py
"""
from __future__ import annotations
import config


def main():
    import psycopg2, psycopg2.extras
    conn = psycopg2.connect(config.postgres_dsn())
    conn.set_session(readonly=True, autocommit=True)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    # the SAME selection run.py uses: active + upcoming
    cur.execute('SELECT id, "serviceNumber", "journeyDate" FROM "Trips" '
                'WHERE active = TRUE AND "journeyDate" >= CURRENT_DATE '
                'ORDER BY "journeyDate" LIMIT 6')
    pg = cur.fetchall()
    print("=== LIVE Trips (journeyDate >= today) ===")
    for r in pg:
        print(f"  id={r['id']}  serviceNumber={r['serviceNumber']!r}  journeyDate={r['journeyDate']}")

    from db.clickhouse_store import ClickHouseStore
    ch = ClickHouseStore()
    print("\n=== per-trip: does Service_Number exist in CH, and what ly_demand_score returns ===")
    for r in pg:
        sn = r["serviceNumber"]
        jd = r["journeyDate"]
        if sn is None:
            print(f"  id={r['id']}: serviceNumber is NULL → can't match"); continue
        try:
            cnt = ch.query("SELECT count(), min(Journey_Date), max(Journey_Date) "
                           "FROM freshbus_operations.bus_ticket_data WHERE Service_Number = {sn:String}",
                           {"sn": sn})
            n = cnt[0][0] if cnt else 0
            rng = f"{cnt[0][1]}..{cnt[0][2]}" if n else "-"
            score = ch.ly_demand_score(sn, jd)
            print(f"  id={r['id']} sn={sn!r}: CH rows={n} (range {rng}) → ly_demand_score={score}")
        except Exception as e:
            print(f"  id={r['id']} sn={sn!r}: ERROR {type(e).__name__}: {e}")


if __name__ == "__main__":
    main()
