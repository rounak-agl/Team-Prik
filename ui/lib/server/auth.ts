/**
 * Server-side only — never import from client components.
 */
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SessionData, sessionOptions } from "@/lib/server/session";

export function getAdminBaseUrl(): string {
  const url = process.env.ADMIN_BASE_URL ?? "https://api-stage.freshbus.com/admin";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export async function loginToAdminAPI(
  email: string,
  password: string
): Promise<string> {
  const baseUrl = getAdminBaseUrl();
  const deviceId = `pricing-copilot-${Date.now()}`;

  const res = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, deviceId }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Admin API login failed: ${res.status}`);
  }

  const setCookie = res.headers.get("set-cookie") ?? "";
  const cookieMatch = setCookie.match(/access_token=([^;]+)/);
  if (cookieMatch) return cookieMatch[1];

  const data = await res.json();
  const token: string | undefined =
    data?.access_token ?? data?.token ?? data?.data?.access_token ?? data?.data?.token;

  if (!token) throw new Error("Admin API login response did not contain a token");
  return token;
}

/** Re-login with stored credentials to get a fresh token, update the session. */
async function reloginAndRefreshSession(): Promise<string | null> {
  try {
    const email = process.env.PORTAL_USER;
    const password = process.env.PORTAL_PASS;
    if (!email || !password) return null;

    const newToken = await loginToAdminAPI(email, password);
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    session.adminToken = newToken;
    await session.save();
    return newToken;
  } catch {
    return null;
  }
}

/** Fetch an admin API endpoint, auto-refreshing the token on 401.
 *  Sends the token as both Bearer and Cookie for endpoint compatibility.
 */
export async function fetchAdmin(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<{ res: Response; token: string }> {
  const url = `${getAdminBaseUrl()}${path}`;

  const doFetch = (t: string) =>
    fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
        // Send both forms — the backend accepts either (Bearer is proven to
        // work for /trips/*; Cookie for /services/* /stations/*).
        Authorization: `Bearer ${t}`,
        Cookie: `access_token=${t}`,
      },
      cache: "no-store",
    });

  let res = await doFetch(token);

  if (res.status === 401) {
    const newToken = await reloginAndRefreshSession();
    if (newToken) {
      res = await doFetch(newToken);
      return { res, token: newToken };
    }
  }

  return { res, token };
}

export async function refreshAdminToken(
  currentToken: string
): Promise<string | null> {
  try {
    const res = await fetch(`${getAdminBaseUrl()}/auth/refresh-token`, {
      method: "GET",
      headers: { Authorization: `Bearer ${currentToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.access_token ?? data?.token ?? data?.data?.access_token ?? data?.data?.token ?? null;
  } catch {
    return null;
  }
}
