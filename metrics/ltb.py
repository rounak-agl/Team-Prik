"""Look-to-Book funnel inputs (LIVE tier) → demand_heat + LTB-08 flag.

Source: ClickHouse `looks_to_books` — the live demand funnel per
(service_id, journey_date): looks → block (seat selected) → books. Verified
2026-06-17: fresh for today..+14d, covers 144/144 of our active service_ids.
Keyed by service_id (= our route_id) + journey_date.

NOTE on capacity: `TripSeats` is seat-SEGMENT grain (a row per seat × boarding
segment), so a trip's seat COUNT is inflated (~thousands) and is NOT bus
capacity. Occupancy is a ratio so it's unaffected, but we therefore DO NOT
normalise looks by seat count. visit_momentum uses absolute look VOLUME on a
log-saturating scale (capacity-independent), and the LTB-08 gate uses an
absolute look floor.

Two signals:
  - visit_momentum   (→ demand_heat): live interest volume, log-saturating.
                     Real-time signal that historical pace_percentile can't see.
  - high_interest_no_booking (LTB-08 flag): heavy looks, weak conversion, CLOSE
                     to departure, bus still unsold → value/price friction.
                     Lead-gated so early-funnel browsing is NOT flagged.
"""
from __future__ import annotations
import math

LOOK_FLOOR = 300        # absolute looks that count as "meaningful interest"
POOR_CONV = 0.015       # books/looks below this near departure = not converting


def _clamp(x, lo=0.0, hi=100.0):
    return max(lo, min(hi, x))


def visit_momentum(looks: int) -> float:
    """Absolute look volume → 0..100, log-saturating (50→9, 300→44, 3000→90)."""
    if looks <= 0:
        return 0.0
    return _clamp((math.log10(looks + 1) - 1.5) / 2.2 * 100.0)


def high_interest_no_booking(looks: int, books: int, lead_days: int,
                             occupancy_pct: float) -> bool:
    """Concerning only near departure: real interest, weak conversion, unsold."""
    if looks <= 0:
        return False
    conv = books / looks
    return bool(lead_days <= 3 and looks >= LOOK_FLOOR
                and occupancy_pct < 65.0 and conv < POOR_CONV)


def build_extras(funnel: dict | None, lead_days: int, occupancy_pct: float) -> dict:
    """funnel = {'looks':, 'block':, 'books':} for this (service, date) or None."""
    if not funnel:
        return {}
    looks = int(funnel.get("looks", 0))
    books = int(funnel.get("books", 0))
    if looks <= 0:
        return {}
    return {
        "visit_momentum": visit_momentum(looks),
        "high_interest_no_booking": high_interest_no_booking(
            looks, books, lead_days, occupancy_pct),
        "_ltb": {"looks": looks, "block": int(funnel.get("block", 0)), "books": books},
    }
