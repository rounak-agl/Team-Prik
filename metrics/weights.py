"""Default composite weights — EDIT THESE to tune the agent.

The 6 CMP composites (the only metrics that reach the LLM, alongside 3 guardrail
flags + LTB-08) are weighted rollups of underlying metrics. Each composite's
weights are normalized within itself (0..100 output) except PRICE_ACTION, which
is a signed net score in [-100, +100].

Inputs default to neutral (50) when their data family isn't wired yet, so adding
competitor / LTB / SRP / elasticity later enriches the composites with no formula
change.
"""

WEIGHTS = {
    # CMP-01 Demand Heat (0..100)
    "demand_heat": {
        "pace_percentile": 0.35,
        "velocity_percentile": 0.25,
        "visit_momentum": 0.15,
        "demand_score": 0.25,
    },
    # CMP-02 Competitive Pressure (0..100)
    "competitive_pressure": {
        "fare_gap_vs_median": 0.40,
        "price_rank": 0.25,
        "competitor_sellouts": 0.20,
        "share_trend": 0.15,
    },
    # CMP-03 Urgency (0..100)
    "urgency": {
        "lead_pressure": 0.40,
        "runrate_pressure": 0.35,
        "empty_risk": 0.25,
    },
    # CMP-04 Price Action (signed -100..+100): heat lifts, pressure damps,
    # urgency pushes in the direction occupancy implies (handled in code).
    "price_action": {
        "heat": 1.0,
        "pressure": -0.5,
        "urgency": 0.4,
    },
    # CMP-05 Confidence (0..100)
    "confidence": {
        "data_freshness": 0.40,
        "signal_agreement": 0.40,
        "history_depth": 0.20,
    },
    # CMP-06 Opportunity = demand_heat * unsold_fraction (ranked across the fleet)
}
