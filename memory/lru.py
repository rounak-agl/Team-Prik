"""LRU cache = hashmap + doubly-linked list.

O(1) get (move-to-front), O(1) put, O(1) tail eviction. The DLL is what makes
arbitrary-node removal O(1) — a singly-linked list would be O(n). Entries carry
a Label (entity + TTL); expired entries miss and are dropped. `invalidate_by_label`
purges one entity class (e.g. all competitor data) without flushing the cache.

`now` is injectable on get/put for deterministic testing.
"""
from __future__ import annotations
import time
from typing import Any

from .labels import Label


class _Node:
    __slots__ = ("key", "value", "label", "prev", "next")

    def __init__(self, key, value, label):
        self.key = key
        self.value = value
        self.label: Label | None = label
        self.prev: "_Node | None" = None
        self.next: "_Node | None" = None


class LRUCache:
    def __init__(self, capacity: int = 512):
        self.capacity = capacity
        self._map: dict[Any, _Node] = {}
        self._head = _Node(None, None, None)   # MRU sentinel
        self._tail = _Node(None, None, None)   # LRU sentinel
        self._head.next = self._tail
        self._tail.prev = self._head
        self.hits = 0
        self.misses = 0
        self.evictions = 0

    # ── DLL ops ───────────────────────────────────────────────────────────────
    def _remove(self, node: _Node) -> None:
        node.prev.next = node.next
        node.next.prev = node.prev

    def _push_front(self, node: _Node) -> None:
        node.prev = self._head
        node.next = self._head.next
        self._head.next.prev = node
        self._head.next = node

    def _drop(self, node: _Node) -> None:
        self._remove(node)
        self._map.pop(node.key, None)

    # ── API ─────────────────────────────────────────────────────────────────--
    def get(self, key, now: float | None = None):
        node = self._map.get(key)
        if node is None:
            self.misses += 1
            return None
        if node.label and node.label.expired(now):
            self._drop(node)
            self.misses += 1
            return None
        self._remove(node)
        self._push_front(node)
        self.hits += 1
        return node.value

    def put(self, key, value, label: Label | None = None, now: float | None = None) -> None:
        label = label or Label()
        label.fetched_at = time.monotonic() if now is None else now
        node = self._map.get(key)
        if node is not None:
            node.value, node.label = value, label
            self._remove(node)
            self._push_front(node)
            return
        node = _Node(key, value, label)
        self._map[key] = node
        self._push_front(node)
        if len(self._map) > self.capacity:
            lru = self._tail.prev
            if lru is not self._head:
                self._drop(lru)
                self.evictions += 1

    def invalidate(self, key) -> bool:
        node = self._map.get(key)
        if node is None:
            return False
        self._drop(node)
        return True

    def invalidate_by_label(self, entity: str) -> int:
        victims = [n for n in self._map.values() if n.label and n.label.entity == entity]
        for n in victims:
            self._drop(n)
        return len(victims)

    def entries_by_label(self, entity: str, now: float | None = None) -> list:
        """Live (key, value) pairs for one entity class — used to rebuild a family
        index from cached cells without re-querying. Skips expired entries."""
        return [(n.key, n.value) for n in list(self._map.values())
                if n.label and n.label.entity == entity
                and not n.label.expired(now) and n.value is not None]

    def size_by_label(self, entity: str) -> int:
        return sum(1 for n in self._map.values() if n.label and n.label.entity == entity)

    def __len__(self) -> int:
        return len(self._map)

    def stats(self) -> dict:
        total = self.hits + self.misses
        return {
            "size": len(self._map),
            "hits": self.hits,
            "misses": self.misses,
            "evictions": self.evictions,
            "hit_rate": round(self.hits / total, 3) if total else 0.0,
        }
