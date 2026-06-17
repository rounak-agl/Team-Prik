"""CachedRepo — wraps any Repo with the memory layer's LRU tiers.

Caches the SLOW/STATIC repo reads per the MemoryPlan: `route` → LRU-STATIC,
`price_rules` → LRU-SLOW. LIVE reads (active_trips, seats, bookings,
current_price) and all writes pass straight through. Same interface as
MemoryRepo/PostgresRepo, so agents are unchanged.

Shares the MemoryManager's caches so the whole memory layer reports through one
place. If no manager is given it creates a private one (repo-level caching still
works standalone).
"""
from __future__ import annotations

from .labels import Label


class CachedRepo:
    def __init__(self, inner, mem=None):
        self.inner = inner
        if mem is None:
            from .manager import MemoryManager
            mem = MemoryManager(ch=None)
        self.mem = mem
        self.static = mem.static     # route (LRU-STATIC)
        self.slow = mem.slow         # price_rules (LRU-SLOW)

    # backward-compat alias: older code/tests read `.cache`
    @property
    def cache(self):
        return self.static

    # delegate everything not explicitly cached (seats/active_trips/bookings/writes/…)
    def __getattr__(self, name):
        return getattr(self.inner, name)

    # ── cached: slow (price_rules) ───────────────────────────────────────────
    def price_rules(self, key):
        ck = ("rules", key)
        v = self.slow.get(ck)
        if v is None:
            v = self.inner.price_rules(key)
            self.slow.put(ck, v, Label.of("rules", "slow"))
        return v

    # ── cached: static (route master) ────────────────────────────────────────
    def route(self, key):
        ck = ("route", key)
        v = self.static.get(ck)
        if v is None:
            v = self.inner.route(key)
            self.static.put(ck, v, Label.of("route", "static"))
        return v
