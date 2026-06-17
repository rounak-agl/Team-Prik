"""Metric engine. Phase 1 = the LLM-context layer: 6 composites (CMP) + 3
guardrail flags (GRD-07/08/09) + LTB-08. Underlying families feed these via
`extras`; missing ones default to neutral. Weights live in weights.py."""
from .composites import compute as compute_composites, derive_inputs
from .weights import WEIGHTS

__all__ = ["compute_composites", "derive_inputs", "WEIGHTS"]
