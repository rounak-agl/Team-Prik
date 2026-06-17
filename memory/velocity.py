"""Booking-velocity sliding windows (DEQUE tier in the MemoryPlan).

Per-trip deque of booking timestamps over a 24h window; O(1) append, O(1) prune
from the left. Used in the live loop to track velocity/momentum across cycles
without re-counting from the DB. `now` is injectable for testing.
"""
from __future__ import annotations
import time
from collections import deque, defaultdict


class VelocityWindow:
    def __init__(self, window_sec: float = 86400.0):
        self.window_sec = window_sec
        self._events: dict = defaultdict(deque)   # key -> deque[float timestamps]

    def add(self, key, ts: float | None = None) -> None:
        self._events[key].append(time.monotonic() if ts is None else ts)

    def _prune(self, key, now: float) -> None:
        dq = self._events[key]
        cutoff = now - self.window_sec
        while dq and dq[0] < cutoff:
            dq.popleft()

    def count(self, key, now: float | None = None) -> int:
        """Events within the window (e.g. bookings in the last 24h)."""
        now = time.monotonic() if now is None else now
        self._prune(key, now)
        return len(self._events[key])

    def count_recent(self, key, seconds: float, now: float | None = None) -> int:
        """Events within the last `seconds` (e.g. 6h velocity for acceleration)."""
        now = time.monotonic() if now is None else now
        cutoff = now - seconds
        return sum(1 for t in self._events[key] if t >= cutoff)

    def acceleration(self, key, now: float | None = None) -> float:
        """vel_6h*4 - vel_24h — positive = demand accelerating (VEL-03)."""
        now = time.monotonic() if now is None else now
        v6 = self.count_recent(key, 6 * 3600, now)
        v24 = self.count(key, now)
        return v6 * 4 - v24
