"""Discount-depth input (LIVE / DERIVED tier) — DSC-01.

The discount already offered on the UNSOLD seats (what a prospective buyer sees
right now), as a % of listed fare. Computed straight from the seat rows the
Collector already pulls — no extra query, no cache.

Why it matters: discount is the downward lever already partly pulled. A bus
that's deeply discounted and still empty has little room to cut further (the
margin floor is near), so a heavy `discount_depth` DAMPENS further negative
price_action in the composites. Source: TripSeats.discount (live, populated).
"""
from __future__ import annotations


def _clamp(x, lo=0.0, hi=100.0):
    return max(lo, min(hi, x))


def discount_depth(seats) -> dict:
    """% of listed fare currently discounted on unsold seats, or {} if none/unknown."""
    fare_sum = disc_sum = 0.0
    for s in seats:
        if s.get("is_booked"):
            continue                       # price the UNSOLD inventory
        fare = s.get("price")
        disc = s.get("discount") or 0.0
        if fare is None or fare <= 0:
            continue
        fare_sum += float(fare)
        disc_sum += float(disc)
    if fare_sum <= 0:
        return {}
    return {"discount_depth": _clamp(disc_sum / fare_sum * 100.0)}
