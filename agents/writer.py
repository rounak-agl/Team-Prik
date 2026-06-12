"""WriterAgent — applies validated prices to UNSOLD seats only and logs every
change to price history. Side-effecting; runs after the Validator. Never touches
booked seats."""
from __future__ import annotations
from .base import Agent


class WriterAgent(Agent):
    name = "Writer"

    def __init__(self, repo, apply: bool = True):
        self.repo = repo
        self.apply = apply

    def run(self, bb) -> None:
        wrote = 0
        for ts in bb.targets():
            d = ts.decision
            if not d.changed:
                continue
            if self.apply:
                n = self.repo.update_unsold_seat_prices(d.trip_id, d.final_price)
                self.repo.log_price_change(d.trip_id, d.old_price, d.final_price,
                                           d.reason or "")
                ts.written = True
                wrote += 1
        bb.log(self.name, f"wrote {wrote} price changes (unsold seats only) + logged")
