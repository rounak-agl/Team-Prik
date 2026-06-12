/**
 * Server-side wrapper for the FreshBus admin API.
 * Never import from client components.
 */
import { getAdminBaseUrl, refreshAdminToken } from "./auth";
import { sessionOptions, SessionData } from "./session";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

async function getToken(): Promise<string> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.adminToken) {
    throw new Error("Not authenticated");
  }
  return session.adminToken;
}

async function adminFetch(
  path: string,
  options: RequestInit = {},
  retried = false
): Promise<Response> {
  const token = await getToken();
  const baseUrl = getAdminBaseUrl();
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> | undefined),
    },
    cache: "no-store",
  });

  if (res.status === 401 && !retried) {
    // Attempt token refresh
    const newToken = await refreshAdminToken(token);
    if (newToken) {
      const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
      session.adminToken = newToken;
      await session.save();
    }
    return adminFetch(path, options, true);
  }

  return res;
}

export async function getTrip(tripId: string | number) {
  const res = await adminFetch(`/trips/${tripId}`);
  if (!res.ok) throw new Error(`Failed to get trip: ${res.status}`);
  return res.json();
}

export async function getPriceClassifications(tripId: string | number) {
  const res = await adminFetch(`/trips/${tripId}/priceClassifications`);
  if (!res.ok) throw new Error(`Failed to get price classifications: ${res.status}`);
  return res.json();
}

export async function updatePriceClassification(
  tripId: string | number,
  fareClassification: string,
  pricingModel: string = "Automation_v4"
) {
  const res = await adminFetch(`/trips/${tripId}/updatePriceClassification`, {
    method: "PATCH",
    body: JSON.stringify({ fareClassification, pricingModel }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string })?.message || `Failed to update classification: ${res.status}`);
  }
  return res.json().catch(() => ({ success: true }));
}

export async function getFareAdjustment(tripId: string | number) {
  const res = await adminFetch(`/trips/${tripId}/fare_adjustment`);
  if (!res.ok) throw new Error(`Failed to get fare adjustment: ${res.status}`);
  return res.json();
}

export async function applyFareAdjustment(
  fareValue: number,
  tripIds: number[],
  reasonId: number,
  seatType: string[] = ["seater", "singleSleeper", "sharedSleeper"]
) {
  // IMPORTANT: Current admin API only supports non-negative fareValue (pct = max(0, pct))
  // Negative bus fare adjustment is NOT confirmed by the API.
  // UI should warn users before calling with negative values.
  const res = await adminFetch(`/trips/fare_adjustment/${fareValue}`, {
    method: "POST",
    body: JSON.stringify({ tripIds, reasonId, seatType }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string })?.message || `Failed to apply fare adjustment: ${res.status}`);
  }
  return res.json().catch(() => ({ success: true }));
}

export async function getFareAdjustmentReasons(type: string = "Bus Fare Adjustment") {
  const res = await adminFetch(`/trips/fare_adjustment_reasons/${encodeURIComponent(type)}`);
  if (!res.ok) throw new Error(`Failed to get reasons: ${res.status}`);
  return res.json();
}
