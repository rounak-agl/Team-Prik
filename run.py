"""Entry point — runs one orchestration cycle on the seeded data and prints the
before → orchestration trace → after + audit log. This is the demo.

    python run.py            # one cycle (uses Gemini if GEMINI_API_KEY set)
    python run.py --loop 300 # every 5 minutes
"""
from __future__ import annotations
import argparse, time

from repository import MemoryRepo
from orchestrator import Orchestrator


def _before_after(repo, label):
    print(f"\n── {label} ──")
    for trip in repo.active_trips():
        seats = repo.seats(trip["id"])
        un = [s for s in seats if not s["is_booked"]]
        booked = len(seats) - len(un)
        prices = sorted({s["price"] for s in un})
        rt = repo.route(trip["route_id"])
        print(f"  trip {trip['id']} {rt['origin']}→{rt['destination']:<10} "
              f"booked {booked}/{len(seats)} ({booked/len(seats)*100:.0f}%) "
              f"unsold@₹{prices}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--loop", type=int, default=0)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    repo = MemoryRepo()
    orch = Orchestrator(repo, apply=not args.dry_run)

    print("=" * 72)
    print(" FreshBus Pricing — Multi-Agent Orchestration")
    print("=" * 72)
    _before_after(repo, "BEFORE")

    def cycle():
        bb = orch.run_cycle()
        print("\n── DECISIONS ──")
        for ts in sorted(bb.targets(), key=lambda t: t.priority, reverse=True):
            d = ts.decision
            tag = "REPRICED" if d.changed else "held"
            print(f"  [{tag:8}] trip {d.trip_id}: ₹{d.old_price:.0f}→₹{d.final_price} "
                  f"({d.surge_pct:+.0f}%)  {d.reason}")
        we = bb.trips.get(101)
        if we and we.decision:
            ok = "✅" if we.decision.final_price == 880 else "❌"
            print(f"\n  worked-example check (trip 101): expected ₹880 → "
                  f"₹{we.decision.final_price} {ok}")
        print("\n── price_history (audit) ──")
        for h in repo.price_history():
            print(f"  trip {h['trip_id']}: ₹{h['old_price']:.0f}→₹{h['new_price']:.0f} | {h['reason']}")

    cycle()
    _before_after(repo, "AFTER")

    while args.loop > 0:
        print(f"\n[loop] sleeping {args.loop}s …")
        time.sleep(args.loop)
        cycle()


if __name__ == "__main__":
    main()
