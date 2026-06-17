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
import argparse, os, time
from datetime import datetime

from repository import get_repo, get_ch_store, is_live
from orchestrator import Orchestrator

CACHE_LOG = os.path.join(os.path.dirname(__file__), "..", "docs", "CACHE_LOG.md")


def _log_cache(mem, cycle: int, prev_db: int) -> int:
    """Append one row of memory-layer occupancy to docs/CACHE_LOG.md and print it.
    Returns the running db_queries total so the next cycle can show the delta."""
    s = mem.stats()
    st, sl = s["static"], s["slow"]
    this_db = s["db_queries"] - prev_db
    sb, lb = s["static_by_entity"], s["slow_by_entity"]
    line = (f"| {cycle} | {datetime.now():%H:%M:%S} | {st['size']} "
            f"(route {sb['route']}, demand {sb['demand']}, history {sb['history']}) "
            f"| {sl['size']} (rules {lb['rules']}, comp {lb['competitor']}, ltb {lb['ltb']}) "
            f"| {s['velocity_keys']} | {s['undo_depth']} "
            f"| {st['hits']}/{st['misses']} ({st['hit_rate']}) "
            f"| {sl['hits']}/{sl['misses']} ({sl['hit_rate']}) | {this_db} |")
    print(f"   [memory] STATIC={st['size']} SLOW={sl['size']} velocity={s['velocity_keys']} "
          f"undo={s['undo_depth']} | DB queries this cycle={this_db} "
          f"(static hit-rate {st['hit_rate']}, slow {sl['hit_rate']})", flush=True)
    try:
        new = not os.path.exists(CACHE_LOG)
        with open(CACHE_LOG, "a", encoding="utf-8") as f:
            if new:
                f.write("# Memory-layer cache log\n\nCache size built up per cycle "
                        "(STATIC = route/demand/history, SLOW = rules/competitor/LTB).\n\n"
                        "| cycle | time | STATIC size | SLOW size | velocity keys | undo depth "
                        "| STATIC hits/misses | SLOW hits/misses | DB queries |\n"
                        "|--|--|--|--|--|--|--|--|--|\n")
            f.write(line + "\n")
    except Exception as e:
        print(f"   [memory] cache-log write skipped: {e}", flush=True)
    return s["db_queries"]


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
    ap.add_argument("--undo-last", action="store_true",
                    help="revert the most recent logged decision on STAGING (durable undo)")
    ap.add_argument("--rebuild-features", action="store_true",
                    help="rebuild the DURABLE feature store (fs_service_features) and exit")
    args = ap.parse_args()

    ch = get_ch_store()
    from memory import MemoryManager
    mem = MemoryManager(ch=ch)
    repo = get_repo(mem=mem)
    live = is_live()

    if args.undo_last:
        _undo_last(ch)
        return
    if args.rebuild_features:
        if ch is None:
            print("[features] no ClickHouse configured"); return
        print("[features] rebuilding fs_service_features …")
        n = ch.rebuild_service_features()
        print(f"[features] built {n} service rows (booking curve + elasticity)")
        return
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
                        admin=admin, apply_only=apply_only, mem=mem)

    print("=" * 72)
    print(f" FreshBus Pricing — Multi-Agent Orchestration  [{'LIVE' if live else 'SEED'}]")
    print("=" * 72)
    if not live:
        _seed_before_after(repo, "BEFORE")

    cycle_no = {"n": 0, "db": 0}

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
        cycle_no["n"] += 1
        cycle_no["db"] = _log_cache(mem, cycle_no["n"], cycle_no["db"])

    cycle()
    if not live:
        _seed_before_after(repo, "AFTER")

    while args.loop > 0:
        print(f"\n[loop] sleeping {args.loop}s …")
        time.sleep(args.loop)
        cycle()


def _undo_last(ch):
    """Durable undo: revert the most recent logged decision on staging."""
    if ch is None:
        print("[undo] no ClickHouse — nothing to undo"); return
    row = ch.last_decision()
    if not row:
        print("[undo] no decisions logged yet"); return
    trip_id, model_class, new_class, adj = row
    print(f"[undo] last decision: trip {trip_id} {model_class}→{new_class} adj {adj:+}%")
    try:
        from db.admin_client import AdminClient
        admin = AdminClient()
        admin.set_classification(trip_id, model_class)   # back to model classification
        admin.set_fare_adjustment(trip_id, 0)            # neutral adjustment
        print(f"[undo] reverted trip {trip_id} → class {model_class}, adj 0% on staging")
    except Exception as e:
        print(f"[undo] revert failed: {e}")


if __name__ == "__main__":
    main()
