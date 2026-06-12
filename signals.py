"""Pricing signals — pure computation from raw trip/seat/booking/demand data."""
from __future__ import annotations
from dataclasses import dataclass
from datetime import date, datetime, timedelta


@dataclass
class Signals:
    trip_id: int
    occupancy_pct: float
    lead_days: int
    demand_score: int
    is_festival: bool
    velocity_per_day: float
    seats_total: int
    seats_booked: int
    seats_unsold: int
    pace_ratio: float          # actual occ / expected occ at this lead (1.0 = on pace)
    day_type: str              # operational: absolute | low | pseudo


def _expected_occ_at_lead(lead_days: int) -> float:
    """Cheap target booking curve: expected occupancy by lead time (fraction)."""
    if lead_days >= 15: return 0.20
    if lead_days >= 7:  return 0.40
    if lead_days >= 3:  return 0.60
    if lead_days >= 1:  return 0.75
    return 0.85


def classify_day(demand_score: int, is_festival: bool) -> str:
    if is_festival or demand_score >= 70:
        return "absolute"      # demand day — hold fare while occupancy moves
    if demand_score < 45:
        return "low"           # build occupancy first
    return "pseudo"            # unclear — react per service


def compute(trip: dict, seats: list, bookings: list, demand: dict | None,
            today: date | None = None) -> Signals:
    today = today or date.today()
    total = len(seats)
    booked = sum(1 for s in seats if s.get("is_booked"))
    occ = (booked / total * 100.0) if total else 0.0

    dep = trip["departure_date"]
    if isinstance(dep, datetime): dep = dep.date()
    elif isinstance(dep, str):    dep = date.fromisoformat(dep)
    lead = (dep - today).days

    score = int(demand["demand_score"]) if demand and demand.get("demand_score") is not None else 50
    festival = bool(demand.get("is_festival")) if demand else False

    cutoff = datetime.now() - timedelta(hours=24)
    vel = 0
    for b in bookings:
        ts = b.get("created_at")
        if isinstance(ts, str):
            try: ts = datetime.fromisoformat(ts)
            except ValueError: ts = None
        if isinstance(ts, datetime) and ts >= cutoff:
            vel += 1

    expected = _expected_occ_at_lead(lead) * 100.0
    pace = round((occ / expected), 2) if expected else 1.0

    return Signals(
        trip_id=trip["id"], occupancy_pct=round(occ, 1), lead_days=lead,
        demand_score=score, is_festival=festival, velocity_per_day=float(vel),
        seats_total=total, seats_booked=booked, seats_unsold=total - booked,
        pace_ratio=pace, day_type=classify_day(score, festival),
    )
