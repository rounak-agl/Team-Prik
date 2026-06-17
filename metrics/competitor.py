"""Competitor-derived composite inputs (LRU-SLOW tier) → competitive_pressure.

Source: ClickHouse `aprstc_scraping_data` — APSRTC fares are scraped LIVE
(verified 2026-06-17: captures today, ~500k rows for future journeys). The other
scrape tables (redbus_data, abhibus_data) are stale (~2025-07) and are NOT used.

CAVEAT (documented on purpose): APSRTC is a government RTC operator — a budget,
mostly non-AC segment. Our premium AC fares sit structurally above it, so a raw
fare gap would almost always read "overpriced". We therefore SOFTEN + BAND the
fare-gap input and treat APSRTC primarily as the route's budget price-floor and a
demand/scarcity gauge (sellouts), not as a like-for-like price. competitive_pressure
is one of several signals the validator/LLM weigh; it never moves price alone.

Coverage is partial by nature: APSRTC runs AP/Telangana corridors, so trips on
routes it doesn't serve simply get no competitor extras (neutral pressure).
"""
from __future__ import annotations
import re

# city aliases → canonical token (both our names and APSRTC names normalise here)
ALIAS = {
    "bengaluru": "bangalore", "blr": "bangalore", "bnglr": "bangalore",
    "tirupathi": "tirupati", "tpty": "tirupati",
    "vizag": "visakhapatnam", "vskp": "visakhapatnam", "vizianagaram": "vizinagaram",
    "coimbattore": "coimbatore", "cbe": "coimbatore",
    "puducherry": "pondicherry", "pondy": "pondicherry",
    "bza": "vijayawada", "vja": "vijayawada",
    "gnt": "guntur", "hyd": "hyderabad",
}


def _clamp(x, lo=0.0, hi=100.0):
    return max(lo, min(hi, x))


def norm_city(c: str) -> str:
    c = re.sub(r"[^a-zA-Z ]", "", c or "").strip().lower()
    c = re.sub(r"\s+", " ", c)
    return ALIAS.get(c, c)


def parse_our_pair(service_name: str):
    """'Guntur To Visakhapatnam 12:00' -> ('guntur','visakhapatnam')."""
    if not service_name:
        return None
    parts = re.split(r"\s+[Tt]o\s+", service_name)
    if len(parts) != 2:
        return None
    src = norm_city(parts[0])
    dst = norm_city(re.sub(r"\d.*$", "", parts[1]))   # strip trailing time
    return (src, dst) if src and dst else None


def parse_apsrtc_pair(route: str):
    """'Tirupathi - Bangalore' -> frozenset({'tirupati','bangalore'})."""
    parts = re.split(r"\s*-\s*", route or "")
    if len(parts) != 2:
        return None
    a, b = norm_city(parts[0]), norm_city(parts[1])
    return frozenset((a, b)) if a and b else None


def build_market_index(rows) -> dict:
    """rows = (route, journey_date, med, minp, maxp, n_services, sellout_frac).
    Returns {(frozenset(pair), journey_date): stats}. Merges both directions of a
    route onto the same unordered key (keeps the larger sample)."""
    idx: dict = {}
    for route, jd, med, minp, maxp, n, sold in rows:
        pair = parse_apsrtc_pair(route)
        if not pair:
            continue
        key = (pair, jd)
        stats = {"median": float(med or 0), "min": float(minp or 0),
                 "max": float(maxp or 0), "n": int(n or 0),
                 "sellout_frac": float(sold or 0.0)}
        prev = idx.get(key)
        if prev is None or stats["n"] > prev["n"]:
            idx[key] = stats
    return idx


# ── input mappers (HIGH = more downward pressure, except sellouts) ───────────
def fare_gap_score(our_fare: float, comp_median: float) -> float:
    """Softened + banded: 60% of the % gap, clamped to ±40 around parity, so a
    cross-segment mismatch can't scream 'cut 50%'."""
    if not our_fare or not comp_median:
        return 50.0
    gap = (our_fare - comp_median) / comp_median
    return _clamp(50.0 + _clamp(gap * 60.0, -40.0, 40.0))


def price_rank_score(our_fare: float, minp: float, med: float, maxp: float) -> float:
    if not our_fare or maxp <= minp:
        return 50.0
    if our_fare <= minp:
        return 0.0
    if our_fare >= maxp:
        return 100.0
    if our_fare <= med:
        return 50.0 * (our_fare - minp) / (med - minp) if med > minp else 50.0
    return 50.0 + 50.0 * (our_fare - med) / (maxp - med) if maxp > med else 50.0


def build_extras(pair, journey_date, our_fare: float, index: dict) -> dict:
    """Competitor extras for ONE trip, or {} when the route/date isn't covered."""
    if not pair:
        return {}
    stats = index.get((frozenset(pair), journey_date))
    if not stats or stats["n"] <= 0:
        return {}
    return {
        "fare_gap_vs_median": fare_gap_score(our_fare, stats["median"]),
        "price_rank": price_rank_score(our_fare, stats["min"], stats["median"], stats["max"]),
        "competitor_sellouts": _clamp(stats["sellout_frac"] * 100.0),
        "_competitor": {"median": stats["median"], "n": stats["n"],
                        "sellout_pct": round(stats["sellout_frac"] * 100, 1)},  # for logging
    }
