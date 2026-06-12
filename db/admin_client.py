"""Staging admin API client — applies the agent's two levers.

Auth: POST /auth/login {email,password} → Bearer token (env PORTAL_USER / PORTAL_PASS),
refresh via GET /auth/refresh-token.
Lever 1 (classification): PATCH /trips/{id}/updatePriceClassification
                          {pricingModel, fareClassification}
Lever 2 (adjustment %):   POST  /trips/fare_adjustment/{pct}  (integer % on base, >=0)

Used ONLY when fares are explicitly enabled (--apply-fares). Defaults to staging
via ADMIN_BASE_URL. Reuses the contract of the prior repo's api_client.
"""
from __future__ import annotations
import os
import config  # noqa: F401 — importing runs load_dotenv() so PORTAL_USER/.env are available

BASE_URL = os.environ.get("ADMIN_BASE_URL") or os.environ.get(
    "API_BASE_URL", "https://api-stage.freshbus.com/admin")
DEFAULT_MODEL = os.environ.get("PRICING_MODEL_NAME", "Automation_v4")


class AdminClient:
    def __init__(self):
        import requests
        self.session = requests.Session()
        self._token = None
        # Option A: a ready bearer token (e.g. Postman my_token) — no login needed.
        tok = os.environ.get("ADMIN_TOKEN", "").strip()
        if tok:
            self._token = tok
            self.session.headers.update({"Authorization": f"Bearer {tok}"})
        else:
            # Option B: email/password login (PORTAL_USER / PORTAL_PASS).
            self.login()

    def login(self) -> None:
        user = os.environ["PORTAL_USER"]      # raises if not configured
        pw = os.environ["PORTAL_PASS"]
        r = self.session.post(f"{BASE_URL}/auth/login",
                              json={"email": user, "password": pw, "deviceId": "team-prik-agent"},
                              timeout=30)
        r.raise_for_status()
        tok = None
        for c in self.session.cookies:
            if c.name == "access_token":
                tok = c.value
        if not tok:
            try: tok = (r.json() or {}).get("access_token") or (r.json() or {}).get("token")
            except Exception: tok = None
        if tok:
            self._token = tok
            self.session.headers.update({"Authorization": f"Bearer {tok}"})

    def _reauth(self):
        try:
            r = self.session.get(f"{BASE_URL}/auth/refresh-token", timeout=30)
            if r.status_code == 200:
                return
        except Exception:
            pass
        if os.environ.get("PORTAL_USER"):
            self.login()
        else:
            raise RuntimeError("staging token expired and no PORTAL_USER/PORTAL_PASS to re-login "
                               "— refresh ADMIN_TOKEN in .env")

    def _send(self, method: str, path: str, body=None):
        import requests
        fn = getattr(self.session, method)
        r = fn(f"{BASE_URL}{path}", json=body, timeout=30)
        if r.status_code == 401:
            self._reauth()
            r = fn(f"{BASE_URL}{path}", json=body, timeout=30)
        r.raise_for_status()
        return r

    # ── reads (single trip, no route params needed) ──────────────────────────
    def allowed_classifications(self, trip_id: int) -> list:
        r = self._send("get", f"/trips/{trip_id}/priceClassifications")
        return (r.json() or {}).get("fareClassifications", []) or []

    def get_fare_adjustment(self, trip_id: int) -> dict:
        return self._send("get", f"/trips/{trip_id}/fare_adjustment").json()

    # ── lever 1 ───────────────────────────────────────────────────────────────
    def set_classification(self, trip_id: int, fare_classification: str,
                           model: str = DEFAULT_MODEL) -> None:
        self._send("patch", f"/trips/{trip_id}/updatePriceClassification",
                   {"pricingModel": model, "fareClassification": fare_classification})

    # ── lever 2 ───────────────────────────────────────────────────────────────
    # reasonId: 1 = increase in occupancy, 2 = decrease (from the admin API reasons)
    SEAT_TYPES = ["sharedSleeper", "singleSleeper", "seater"]

    def set_fare_adjustment(self, trip_id: int, pct: int, reason_id: int | None = None) -> None:
        pct = max(-20, min(int(pct), 20))
        rid = reason_id if reason_id is not None else (1 if pct >= 0 else 2)  # 1=incr,2=decr occ
        self._send("post", f"/trips/fare_adjustment/{pct}",
                   {"tripIds": [trip_id], "seatType": self.SEAT_TYPES, "reasonId": rid})
