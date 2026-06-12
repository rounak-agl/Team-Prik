# Setup — run the connection / schema check on a networked machine

The DB hosts are internal IPs / private RDS, reachable **only from inside the
FreshBus network/VPN**. Run these on a machine that is on that network.

## 1. Get the code + credentials onto the machine

- If you copy the folder directly (zip/scp): `.env` comes with it — done.
- If you share via **git**: `.env` is git-ignored and will **not** transfer.
  Recreate it: `cp .env.example .env` then fill in the values (Postgres +
  ClickHouse host/user/password). Without `.env` the check reports
  "not configured".

## 2. Install the drivers

```bash
cd "Team Prik"
python3 -m venv .venv && source .venv/bin/activate     # optional but clean
pip install psycopg2-binary clickhouse-connect python-dotenv
# (or: pip install -r requirements.txt)
```

## 3. Run the connection + schema check

```bash
python3 check_connections.py
```

Expected: it connects to Postgres and ClickHouse, prints the **column lists** of
`Trips`, `TripSeats`, `ReservedTicketSeats`, `ServiceAnalyticsData`, `Routes`,
row counts for `Trips`/`TripSeats`, a sample of `bus_ticket_data` columns, and
creates the `fs_pricing_decisions` ClickHouse table (write-permission test).

## 4. Send the full output back

Copy everything it prints — especially any `✗` lines and the column lists. That
confirms the schema mapping so `PostgresRepo` can be finalized and `run.py`
wired onto live data.

## Troubleshooting

- **`could not connect` / timeout** → the machine isn't on the FreshBus network/VPN.
- **`No module named psycopg2`** → drivers not installed (step 2).
- **ClickHouse SSL error** → confirm `CLICKHOUSE_SECURE=false` in `.env` (port 8123 is HTTP).
- **Postgres SSL error** → try `POSTGRES_SSLMODE=prefer` (or `disable`) in `.env`.
