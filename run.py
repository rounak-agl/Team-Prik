"""Entry point — runs orchestration cycles.

  python run.py                # one cycle; live (PostgresRepo) if .env present, else seed
  python run.py --loop 300     # every 5 minutes
  python run.py --apply-fares  # DANGER: apply class+adjustment on STAGING (off by default)

The agent emits TWO levers per trip: Model Classification (≤1 tier step) and
Bus Fare Adjustment % (0..20). On live data fares/classification are NOT applied
unless --apply-fares is passed AND staging admin creds (PORTAL_USER/PORTAL_PASS)
are set. Decisions always log to ClickHouse fs_pricing_decisions.
"""
from __future__ import annotations
import argparse, time

from repository import MemoryRepo, get_repo, get_ch_store
from orchestrator import Orchestrator


def _seed_before_after(repo, label):
    print(f"\n── {label} ──")
    for trip in repo.active_trips():
        seats = repo.seats(trip["id"])
        booked = sum(1 for s in seats if s["is_booked"])
        print(f"  trip {trip['id']} class={trip.get('fare_classification')} "
              f"booked {booked}/{len(seats)} ({booked/len(seats)*100:.0f}%)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--loop", type=int, default=0)
    ap.add_argument("--apply-fares", action="store_true",
                    help="apply class+adjustment on STAGING for ALL changed trips")
    ap.add_argument("--apply-one", type=int, default=None,
                    help="apply on STAGING for ONE trip id only (safest first apply)")
    args = ap.parse_args()

    repo = get_repo()
    ch = get_ch_store()
    live = not isinstance(repo, MemoryRepo)
    apply_only = {args.apply_one} if args.apply_one is not None else None
    want_apply = args.apply_fares or (args.apply_one is not None)
    apply_fares = want_apply or (not live)   # seed demo applies to seed; live applies only if asked

    admin = None
    if want_apply and live:
        try:
            from db.admin_client import AdminClient
            admin = AdminClient()
            print("[admin] staging admin API authenticated")
        except Exception as e:
            print(f"[admin] cannot apply ({e}); falling back to LOG-ONLY")
            apply_fares = False

    orch = Orchestrator(repo, apply_fares=apply_fares, ch_store=ch,
                        admin=admin, apply_only=apply_only)

    print("=" * 72)
    print(f" FreshBus Pricing — Multi-Agent Orchestration  [{'LIVE' if live else 'SEED'}]")
    print("=" * 72)
    if not live:
        _seed_before_after(repo, "BEFORE")

    def cycle():
        bb = orch.run_cycle()
        targets = sorted(bb.targets(), key=lambda t: t.priority, reverse=True)
        changed = [t for t in targets if t.decision and t.decision.changed]
        print(f"\n── DECISIONS ({len(changed)} changed of {len(bb.trips)} trips) ──")
        for ts in targets[:15]:
            d = ts.decision
            tag = "ACT" if d.changed else "hold"
            step = {1: "↑", -1: "↓", 0: "="}[d.tier_step]
            print(f"  [{tag:4}] trip {d.trip_id} ({d.source}): now ₹{d.old_price:.0f} → "
                  f"class {d.model_class}{step}{d.new_class}, adj {d.adjustment_pct:+d}%")
            print(f"          {d.reason}")
        if len(targets) > 15:
            print(f"  … +{len(targets)-15} more")

    cycle()
    if not live:
        _seed_before_after(repo, "AFTER")

    while args.loop > 0:
        print(f"\n[loop] sleeping {args.loop}s …")
        time.sleep(args.loop)
        cycle()


if __name__ == "__main__":
    main()
