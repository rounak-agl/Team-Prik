"""Unit tests for the memory layer (LRU dict+DLL, undo stack, velocity deque).
All deterministic — `now` is injected so no real clock is needed.

    python3 test_memory.py
"""
from __future__ import annotations
from memory import LRUCache, Label, UndoStack, FareAction, VelocityWindow


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


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn(); print(f"PASS {fn.__name__}")
    print(f"\nAll {len(fns)} memory tests passed.")
