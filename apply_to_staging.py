"""Execute one real agent decision on a STAGING trip (proves the agent ACTS).

Staging trips have no live inventory, so we DECIDE on a real prod trip (signals
→ Gemini → validate) and EXECUTE that decision on the given staging trip,
clamping the classification to the staging trip's allowed tiers.

    python3 apply_to_staging.py <staging_trip_id> [prod_trip_id]

  staging_trip_id : the trip to write to (must exist on staging, e.g. 91458)
  prod_trip_id    : whose decision to apply (default: highest-priority changed)
"""
from __future__ import annotations
import os, sys

# keep the decision cycle small + fast for the apply demo (before repo import)
os.environ.setdefault("PRICING_MAX_TRIPS", "10")

from repository import get_repo
from orchestrator import Orchestrator
from pricing_core import clamp_to_allowed
from db.admin_client import AdminClient


def main():
    if len(sys.argv) < 2:
        print("usage: python3 apply_to_staging.py <staging_trip_id> [prod_trip_id]"); return
    staging_id = int(sys.argv[1])
    from_id = int(sys.argv[2]) if len(sys.argv) > 2 else None

    repo = get_repo()
    # ch_store=None → Collector skips the per-trip LY-demand ClickHouse calls
    # (neutral demand is fine here; the point is to prove the staging write).
    bb = Orchestrator(repo, ch_store=None, apply_fares=False).run_cycle()

    targets = sorted((t for t in bb.targets() if t.decision and t.decision.changed),
                     key=lambda t: t.priority, reverse=True)
    if not targets:
        print("no changed decisions to apply"); return
    src = next((t for t in targets if t.decision.trip_id == from_id), targets[0])
    d = src.decision

    admin = AdminClient()
    allowed = admin.allowed_classifications(staging_id)
    new_cls = clamp_to_allowed(d.new_class, allowed)

    print(f"\nSource decision  : prod trip {d.trip_id} → class {d.new_class}, adj {d.adjustment_pct:+d}%")
    print(f"Staging trip     : {staging_id}  allowed tiers: {allowed}")
    print(f"Will execute     : class {new_cls} (clamped), adj {d.adjustment_pct:+d}%")
    print("BEFORE adjustment:", admin.get_fare_adjustment(staging_id))

    admin.set_classification(staging_id, new_cls)
    admin.set_fare_adjustment(staging_id, d.adjustment_pct)

    print("AFTER  adjustment:", admin.get_fare_adjustment(staging_id))
    print(f"✅ executed on staging trip {staging_id}: classification={new_cls}, adjustment={d.adjustment_pct:+d}%")


if __name__ == "__main__":
    main()
