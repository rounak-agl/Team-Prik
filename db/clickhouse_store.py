"""ClickHouseStore — historical reads (booking curves, LY anchors, ticket
history) and our NEW feature/decision tables. ClickHouse existing tables are
read-only to us, but we ARE allowed to CREATE new tables, so decision logs and
feature stores live here under a dedicated prefix.
"""
from __future__ import annotations

import config

DECISIONS_TABLE = "fs_pricing_decisions"   # our new table (we create it)


class ClickHouseStore:
    def __init__(self):
        import clickhouse_connect
        self.client = clickhouse_connect.get_client(**config.clickhouse_config())

    def query(self, sql: str, params: dict | None = None):
        return self.client.query(sql, parameters=params or {}).result_rows

    def ping(self) -> str:
        return str(self.client.query("SELECT version()").result_rows[0][0])

    # ── our writable decision/audit table (new table — allowed) ───────────────
    def ensure_decisions_table(self) -> None:
        self.client.command(f'''
            CREATE TABLE IF NOT EXISTS {DECISIONS_TABLE} (
                ts            DateTime DEFAULT now(),
                trip_id       Int64,
                day_type      String,
                strategy      String,
                old_price     Float64,
                new_price     Float64,
                surge_pct     Float64,
                capped        UInt8,
                reason        String
            ) ENGINE = MergeTree ORDER BY (ts, trip_id)
        ''')

    def log_decision(self, d) -> None:
        self.client.insert(
            DECISIONS_TABLE,
            [[d.trip_id, d.strategy, getattr(d, "day_type", ""), d.old_price,
              d.final_price, d.surge_pct, int(d.capped), d.reason]],
            column_names=["trip_id", "strategy", "day_type", "old_price",
                          "new_price", "surge_pct", "capped", "reason"],
        )

    # ── example historical read (booking-curve / velocity feature) ────────────
    def booking_velocity_24h(self, service_number: str, journey_date) -> int:
        # bus_ticket_data is seat-grain with Booked_date_time. # VERIFY join key.
        rows = self.query(
            '''SELECT count() FROM freshbus_operations.bus_ticket_data
               WHERE Service_Number = {sn:String} AND Journey_Date = {jd:Date}
                 AND Ticket_Status = 'A'
                 AND Booked_date_time >= now() - INTERVAL 24 HOUR''',
            {"sn": service_number, "jd": journey_date})
        return int(rows[0][0]) if rows else 0
