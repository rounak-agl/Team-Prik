# FreshBus Admin API — Pricing Endpoints (from Postman collection)

Base: `{{base_url}}` = `ADMIN_BASE_URL` (staging `https://api-stage.freshbus.com/admin`).
External pricing engine: `{{pricingUrl}}` (Sciative). 648 endpoints total; the
pricing-relevant ones the agent uses or could use are below.

## Auth (admin)
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/login` | `{email, password, deviceId}` | **Admin login** — token in cookie/body → Bearer. Env: `PORTAL_USER`(email) / `PORTAL_PASS`. |
| GET | `/auth/refresh-token` | — | Refresh access token. |

> `sendotp`/`verifyotp` are the **mobile/customer** auth flow — not used by the agent.

## The two levers (what the agent writes)
| Method | Path | Body | Purpose |
|---|---|---|---|
| PATCH | `/trips/{id}/updatePriceClassification` | `{"fareClassification":"High","pricingModel":"Automation_v4"}` | **Lever 1** — set classification. |
| POST | `/trips/fare_adjustment/{pct}` | `{"tripIds":[id],"seatType":["sharedSleeper","singleSleeper","seater"],"reasonId":1}` | **Lever 2** — % adjustment on base (≥0). reasonId 1=incr occ, 2=decr. |
| GET | `/trips/{id}/fare_adjustment` | — | Read current adjustment %. |
| GET | `/trips/{id}/priceClassifications` | — | Read available/current classifications. |

Seat types in this system: **`seater` / `singleSleeper` / `sharedSleeper`**.

## Reads the agent uses (or should)
| Method | Path | Params/Body | Purpose |
|---|---|---|---|
| GET | `/trips/operations` | — | List active/upcoming trips. |
| GET | `/trips/pricing-seat-layout` | `?serviceId=&journeyDate=` | **Sales-dashboard seat layout** — live seat fares + occupancy (the model's current state). |
| GET | `/trips/{id}/trip-seats-details` | `?sourceId=&destinationId=` | Trip seat summary. |
| GET | `/trips/trip-revenue-data` | `?serviceId=&journeyDate=` | Trip revenue. |
| POST | `/trips/competitor-prices` | `{journeyDate, serviceId}` | **Competitor prices** for the trip (real comp data via API). |
| POST | `/trips/competitor-prices-seat-range` | `{journeyDate, serviceId}` | Competitor seat-price range. |
| POST | `/trips/seat-fare-history` | — | Seat fare history. |

## External pricing engine (Sciative) — `{{pricingUrl}}`
| Method | Path | Body | Purpose |
|---|---|---|---|
| POST | `/sciative/getAvailability` | `{BusOperatorID,RouteID,ChartDate,FromCityID,ToCityID}` | Seat availability. |
| POST | `/sciative/updatePricing` | `{fareDetails:[{fromCityId,toCityId,seatPrices:[{seatNumber,basicPrice}]}],RouteID,ChartDate,BusOperatorID}` | Push per-seat prices. |
| POST | `/sciative/updatePricingModel` | `{serviceId:[…],startJourneyDate}` | Switch pricing model. |

## Discounts
| Method | Path | Purpose |
|---|---|---|
| GET | `/services/discounts-list` | List discount strategies. |
| POST | `/services/create-discounts` | Create discount. |
| PATCH | `/services/update-discounts` | Edit discount. |

## Agent mapping
- **Write:** `db/admin_client.py` → `updatePriceClassification` (lever 1) + `fare_adjustment/{pct}` (lever 2). ✅ payloads matched to the collection.
- **Read (current):** PostgresRepo reads `Trips`/`TripSeats` directly. The
  `pricing-seat-layout` + `competitor-prices` endpoints are the API alternatives
  / the source for competitor data (next enhancement).
