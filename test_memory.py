"""Unit tests for the memory layer (LRU dict+DLL, undo stack, velocity deque).
All deterministic — `now` is injected so no real clock is needed.

    python3 test_memory.py
"""
from __future__ import annotations
from datetime import date
from memory import LRUCache, Label, UndoStack, FareAction, VelocityWindow, MemoryManager


def test_lru_eviction_order():
    c = LRUCache(capacity=2)
    c.put("a", 1, Label.of("route"), now=0)
    c.put("b", 2, Label.of("route"), now=0)
    assert c.get("a", now=0) == 1          # touch a → b is now LRU
    c.put("c", 3, Label.of("route"), now=0)  # evicts b
    assert c.get("b", now=0) is None
    assert c.get("a", now=0) == 1 and c.get("c", now=0) == 3


def test_lru_ttl_expiry():
    c = LRUCache()
    c.put("k", 1, Label(entity="rules", ttl_sec=600), now=0)
    assert c.get("k", now=300) == 1        # within TTL
    assert c.get("k", now=601) is None     # expired → miss + dropped
    assert len(c) == 0


def test_lru_static_no_expiry():
    c = LRUCache()
    c.put("r", "BLR-HYD", Label(entity="route", ttl_sec=None), now=0)
    assert c.get("r", now=10**9) == "BLR-HYD"   # ttl None = never expires


def test_invalidate_by_label():
    c = LRUCache()
    c.put("c1", 1, Label.of("competitor"), now=0)
    c.put("c2", 2, Label.of("competitor"), now=0)
    c.put("r1", 3, Label.of("route"), now=0)
    assert c.invalidate_by_label("competitor") == 2
    assert c.get("c1", now=0) is None and c.get("r1", now=0) == 3


def test_lru_stats():
    c = LRUCache()
    c.put("a", 1, Label.of("route"), now=0)
    c.get("a", now=0); c.get("x", now=0)
    s = c.stats()
    assert s["hits"] == 1 and s["misses"] == 1 and s["hit_rate"] == 0.5


def test_undo_stack_lifo_and_bound():
    s = UndoStack(maxlen=2)
    s.push(FareAction(1, "Low", 0, "Medium", 10))
    s.push(FareAction(2, "Medium", 0, "High", 20))
    s.push(FareAction(3, "High", 0, "Super_High", 15))   # drops trip 1 (bound 2)
    assert s.depth() == 2
    top = s.pop()
    assert top.trip_id == 3 and top.new_class == "Super_High"   # LIFO
    assert s.pop().trip_id == 2 and s.pop() is None


def test_velocity_window():
    v = VelocityWindow(window_sec=86400)
    for t in (0, 1000, 5000):
        v.add("trip1", ts=t)
    assert v.count("trip1", now=5000) == 3
    assert v.count("trip1", now=90000) == 1      # only ts=5000 within last 24h
    v.add("trip1", ts=86000)
    v.add("trip1", ts=90000)
    assert v.count_recent("trip1", 6 * 3600, now=90000) == 2  # 86000 & 90000 within last 6h


# ── MemoryManager: tiered caching, query-avoidance, velocity, undo ───────────
class _FakeCH:
    """Counts DB calls + records which keys were asked for."""
    def __init__(self):
        self.history_calls = 0; self.demand_calls = 0
        self.comp_calls = 0; self.ltb_calls = 0
        self.history_asked = []
        self._jd = date(2026, 6, 20)
    def history_features(self, sns):
        self.history_calls += 1; self.history_asked.append(sorted(sns))
        return {sn: {"final_occ_median": 80, "journeys": 50, "elasticity": 50.0}
                for sn in sns if sn != "NODATA"}
    def ly_demand_scores(self, sns):
        self.demand_calls += 1
        return {sn: 60 for sn in sns}
    def competitor_market(self):
        self.comp_calls += 1
        return [("Tirupati - Bangalore", self._jd, 400, 300, 500, 6, 0.5)]
    def ltb_signals(self, sids):
        self.ltb_calls += 1
        return {(sid, self._jd): {"looks": 1000, "block": 20, "books": 10} for sid in sids}


def test_manager_history_miss_batched_and_negative_cached():
    ch = _FakeCH(); m = MemoryManager(ch=ch)
    out1 = m.history(["A", "B", "NODATA"])
    assert set(out1) == {"A", "B"} and ch.history_calls == 1
    # second cycle: all cached (incl. the negative NODATA) → NO new query
    out2 = m.history(["A", "B", "NODATA"])
    assert set(out2) == {"A", "B"} and ch.history_calls == 1
    # a new service only queries the miss
    m.history(["A", "B", "C"])
    assert ch.history_calls == 2 and ch.history_asked[-1] == ["C"]


def test_manager_competitor_and_ltb_sentinel_gated():
    ch = _FakeCH(); m = MemoryManager(ch=ch)
    i1 = m.competitor_index(); i2 = m.competitor_index()
    assert ch.comp_calls == 1 and i1 == i2 and len(i1) == 1     # one scan, rebuilt from cells
    l1 = m.ltb_index([3, 7]); l2 = m.ltb_index([3, 7])
    assert ch.ltb_calls == 1 and l1 == l2 and len(l1) == 2
    assert m.stats()["db_queries"] == 2                          # comp + ltb, one each


def test_manager_velocity_builds_over_cycles():
    m = MemoryManager(ch=None)
    assert m.velocity_percentile(99) is None                     # no bookings yet
    m.observe_bookings(99, 10, now=0)                            # first sighting (no delta)
    m.observe_bookings(99, 15, now=1)                            # +5 bookings
    m.observe_bookings(99, 18, now=2)                            # +3 bookings
    assert m.velocity.count(99, now=3) == 8
    vp = m.velocity_percentile(99, now=3)
    assert vp is not None and 0 < vp <= 100


def test_manager_undo_records():
    m = MemoryManager(ch=None)
    m.record_action(FareAction(5, "Low", 0, "Medium", 10))
    assert m.undo.depth() == 1 and m.stats()["undo_depth"] == 1


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn(); print(f"PASS {fn.__name__}")
    print(f"\nAll {len(fns)} memory tests passed.")
