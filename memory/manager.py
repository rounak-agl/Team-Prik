"""MemoryManager — the complete memory layer in one place.

Owns every tier from the MemoryPlan and routes each data family to its correct
store, so the agents never re-pull heavy data within a TTL:

  LRU-STATIC (self.static)  route · demand (LY anchor) · history (final-occ curve)
  LRU-SLOW   (self.slow)    price_rules · competitor (APSRTC) · LTB funnel · SRP
  DEQUE      (self.velocity) per-trip 24h booking window (cross-cycle velocity)
  STACK      (self.undo)     LIFO fare-action rollback
  LIVE                       occupancy / fares / lead — read direct, never cached
  DURABLE                    the ClickHouse history/competitor/LTB sources, fronted
                             by the LRUs above
  DERIVED                    composites/signals — recomputed each cycle, not stored

Partial-fetch families (history, demand) are MISS-BATCHED: only uncached services
are queried. Full-scan families (competitor, LTB) are SENTINEL-GATED: one scan
populates per-cell entries, and within the TTL the index is rebuilt from the
cache with zero DB hits. `db_queries` counts the DB round-trips actually issued,
so the cache pay-off is observable.
"""
from __future__ import annotations
import math

from .lru import LRUCache
from .labels import Label
from .velocity import VelocityWindow
from .undo_stack import UndoStack

_NEG = object()   # cached "no data for this key" sentinel (avoids re-querying gaps)


class MemoryManager:
    def __init__(self, ch=None):
        self.ch = ch
        self.static = LRUCache(capacity=8192)     # LRU-STATIC
        self.slow = LRUCache(capacity=16384)      # LRU-SLOW
        self.velocity = VelocityWindow()          # DEQUE
        self.undo = UndoStack()                   # STACK
        self._prev_booked: dict = {}              # trip_id -> last seats_booked
        self.db_queries = 0                       # family DB queries actually issued

    # ── LRU-STATIC: history (per service, miss-batched) ──────────────────────
    def history(self, service_numbers) -> dict:
        return self._per_service(service_numbers, "history",
                                 lambda miss: self.ch.history_signals(miss))

    # ── LRU-STATIC: demand (per service, miss-batched) ───────────────────────
    def demand(self, service_numbers) -> dict:
        return self._per_service(service_numbers, "demand",
                                 lambda miss: self.ch.ly_demand_scores(miss))

    def _per_service(self, service_numbers, entity, fetch) -> dict:
        out, misses = {}, []
        for sn in {s for s in service_numbers if s}:
            v = self.static.get((entity, sn))
            if v is None:
                misses.append(sn)
            elif v is not _NEG:
                out[sn] = v
        if misses and self.ch is not None:
            self.db_queries += 1
            fresh = fetch(misses)
            for sn in misses:
                v = fresh.get(sn)
                self.static.put((entity, sn), v if v is not None else _NEG,
                                Label.of(entity, "static"))
                if v is not None:
                    out[sn] = v
        return out

    # ── LRU-SLOW: competitor (full scan, sentinel-gated, per-cell) ───────────
    def competitor_index(self) -> dict:
        if self.ch is None:
            return {}
        from metrics import competitor as comp
        if self.slow.get(("comp", "@loaded")) is None:           # stale/absent → rescan
            self.slow.invalidate_by_label("competitor")
            self.db_queries += 1
            idx = comp.build_market_index(self.ch.competitor_market())
            for (pair, jd), stats in idx.items():
                self.slow.put(("comp", pair, jd), stats, Label.of("competitor", "slow"))
            self.slow.put(("comp", "@loaded"), True, Label.of("competitor", "slow"))
            return idx
        return {(k[1], k[2]): v for k, v in self.slow.entries_by_label("competitor")
                if len(k) == 3}

    # ── LRU-SLOW: LTB funnel (full scan, sentinel-gated, per-cell) ───────────
    def ltb_index(self, service_ids) -> dict:
        if self.ch is None:
            return {}
        if self.slow.get(("ltb", "@loaded")) is None:
            self.slow.invalidate_by_label("ltb")
            self.db_queries += 1
            idx = self.ch.ltb_signals(service_ids)
            for (sid, jd), v in idx.items():
                self.slow.put(("ltb", sid, jd), v, Label.of("ltb", "slow"))
            self.slow.put(("ltb", "@loaded"), True, Label.of("ltb", "slow"))
            return idx
        return {(k[1], k[2]): v for k, v in self.slow.entries_by_label("ltb")
                if len(k) == 3}

    # ── DEQUE: velocity from booked-count deltas across cycles ───────────────
    def observe_bookings(self, trip_id, booked_now: int, now: float | None = None) -> None:
        prev = self._prev_booked.get(trip_id)
        self._prev_booked[trip_id] = booked_now
        if prev is not None and booked_now > prev:
            for _ in range(booked_now - prev):
                self.velocity.add(trip_id, now)

    def velocity_percentile(self, trip_id, now: float | None = None):
        v = self.velocity.count(trip_id, now)
        if v <= 0:
            return None
        return max(0.0, min(100.0, 100.0 * (1.0 - math.exp(-v / 8.0))))

    # ── STACK: undo ──────────────────────────────────────────────────────────
    def record_action(self, action) -> None:
        self.undo.push(action)

    # ── observability ────────────────────────────────────────────────────────
    def stats(self) -> dict:
        return {
            "static": self.static.stats(),
            "slow": self.slow.stats(),
            "static_by_entity": {e: self.static.size_by_label(e)
                                 for e in ("route", "demand", "history")},
            "slow_by_entity": {e: self.slow.size_by_label(e)
                               for e in ("rules", "competitor", "ltb", "srp")},
            "velocity_keys": len(self.velocity._events),
            "undo_depth": self.undo.depth(),
            "db_queries": self.db_queries,
        }
