"""Memory tiers + cache-entry labels — per the Excel MemoryPlan sheet.

Tiers:
  LIVE        — direct DB read, never cached (current occupancy, fares, lead time)
  LRU-SLOW    — dict+DLL, TTL 5–15m (competitor, demand_calendar, price_rules, SRP)
  LRU-STATIC  — dict+DLL, TTL 6–24h (route master, day-type taxonomy, curves, seat mix)
  DEQUE       — per-trip 24h window (velocity/momentum)
  STACK       — LIFO undo stack (rollback)
  DURABLE     — Postgres/ClickHouse aggregates, LRU in front (elasticity, LY curves)
  DERIVED     — in-process per cycle, never stored (pace/gap/ratio/risk)
"""
from __future__ import annotations
import time
from dataclasses import dataclass
from enum import Enum


class Tier(str, Enum):
    LIVE = "LIVE"
    LRU_SLOW = "LRU-SLOW"
    LRU_STATIC = "LRU-STATIC"
    DEQUE = "DEQUE"
    STACK = "STACK"
    DURABLE = "DURABLE"
    DERIVED = "DERIVED"


# Default TTLs (seconds) by cache-label entity, from the MemoryPlan sheet.
# None = no expiry; entities not listed default to LRU-SLOW (10 min).
DEFAULT_TTL = {
    "live": None,         # never cached (handled by caller; not stored)
    "competitor": 600,    # LRU-SLOW  5–15m
    "rules": 600,         # LRU-SLOW
    "srp": 600,           # LRU-SLOW
    "route": 21600,       # LRU-STATIC 6h
    "history": 21600,     # DURABLE + LRU-STATIC 6–24h
    "velocity": 86400,    # DEQUE 24h
    "undo": None,         # STACK
}


def ttl_for(entity: str) -> float | None:
    return DEFAULT_TTL.get(entity, 600)


@dataclass
class Label:
    """Metadata attached to every cache entry."""
    entity: str = "-"           # competitor | rules | srp | route | history | velocity | undo | live
    freshness: str = "slow"     # live | slow | static | daily | weekly
    ttl_sec: float | None = 600.0
    fetched_at: float = 0.0     # set by the cache on put (time.monotonic)
    dirty: bool = False

    def expired(self, now: float | None = None) -> bool:
        if self.ttl_sec is None or self.ttl_sec <= 0:
            return False
        now = time.monotonic() if now is None else now
        return (now - self.fetched_at) > self.ttl_sec

    @classmethod
    def of(cls, entity: str, freshness: str = "slow") -> "Label":
        return cls(entity=entity, freshness=freshness, ttl_sec=ttl_for(entity))
