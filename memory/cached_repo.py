"""CachedRepo — wraps any Repo with the LRU cache (Phase 2 of the memory layer).

Caches the SLOW/STATIC reads (price_rules, route) per the MemoryPlan; passes
LIVE reads (active_trips, seats, bookings, current_price) and all writes straight
through to the inner repo. Same interface as MemoryRepo/PostgresRepo, so agents
are unchanged. Exposes `.cache.stats()` for observability.
"""
from __future__ import annotations

from .lru import LRUCache
from .labels import Label


class CachedRepo:
    def __init__(self, inner, capacity: int = 4096):
        self.inner = inner
        self.cache = LRUCache(capacity)

    # delegate everything not explicitly cached (seats/active_trips/bookings/writes/…)
    def __getattr__(self, name):
        return getattr(self.inner, name)

    # ── cached: slow (price_rules) ───────────────────────────────────────────
    def price_rules(self, key):
        ck = ("rules", key)
        v = self.cache.get(ck)
        if v is None:
            v = self.inner.price_rules(key)
            self.cache.put(ck, v, Label.of("rules"))
        return v

    # ── cached: static (route master) ────────────────────────────────────────
    def route(self, key):
        ck = ("route", key)
        v = self.cache.get(ck)
        if v is None:
            v = self.inner.route(key)
            self.cache.put(ck, v, Label.of("route"))
        return v
