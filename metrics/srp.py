"""SRP / visibility input (LIVE tier) — SRP-01/04.

Search-result position drives sorted-conversion: ranking near the top (or on the
first page) reaches more demand than the absolute fare gap alone. Source:
Trips.srpPosition (comes with active_trips, no extra query).

STATUS (verified 2026-06-17): srpPosition is present but ALL ZERO across active
trips — ops hasn't populated it — so this signal is DORMANT live (returns {}; the
composites stay neutral). The mapper is ready to activate the moment real ranks
land, with zero further wiring.
"""
from __future__ import annotations


def srp_visibility(srp_position) -> dict:
    """Rank → visibility 0..100 (rank 1 = 100, decays ~12/rank) + first-page flag.
    Returns {} when position is missing or 0 (unpopulated)."""
    try:
        pos = int(srp_position)
    except (TypeError, ValueError):
        return {}
    if pos <= 0:
        return {}
    return {
        "srp_visibility": max(0.0, 100.0 - (pos - 1) * 12.0),
        "srp_first_page": pos <= 5,
    }
