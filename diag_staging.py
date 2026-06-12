"""Probe staging read endpoints for a specific trip id so we can read+decide+
apply on the SAME staging trip. Read-only GETs via the authenticated client.

    python3 diag_staging.py [trip_id]      # default 91458
"""
from __future__ import annotations
import json, sys
from datetime import date

import config  # loads .env
from db.admin_client import AdminClient


def show(label, get):
    print(f"\n=== {label} ===")
    try:
        resp = get()
    except Exception as e:
        print("  ERROR", type(e).__name__, str(e)[:200]); return
    try:
        data = resp.json()
    except Exception:
        print("  (non-JSON, len=%d)" % len(resp.text or ""), (resp.text or "")[:200]); return
    s = json.dumps(data, default=str)
    print("  type:", type(data).__name__, "| len:", len(s))
    print("  body[:800]:", s[:800])


def main():
    tid = sys.argv[1] if len(sys.argv) > 1 else "91458"
    today = date.today().isoformat()
    a = AdminClient()
    print("authenticated OK; probing trip", tid)
    show(f"GET /trips/{tid}/priceClassifications", lambda: a._send("get", f"/trips/{tid}/priceClassifications"))
    show(f"GET /trips/{tid}/fare_adjustment",      lambda: a._send("get", f"/trips/{tid}/fare_adjustment"))
    show(f"GET /trips/{tid}/trip-seats-details",   lambda: a._send("get", f"/trips/{tid}/trip-seats-details"))
    show(f"GET /services/trips?journeyDate={today}", lambda: a._send("get", f"/services/trips?journeyDate={today}"))


if __name__ == "__main__":
    main()
