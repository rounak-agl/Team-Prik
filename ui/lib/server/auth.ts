/**
 * Server-side only — never import from client components.
 */

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

  // Try to extract token from Set-Cookie header first, then JSON body
  const setCookie = res.headers.get("set-cookie") ?? "";
  const cookieMatch = setCookie.match(/access_token=([^;]+)/);
  if (cookieMatch) {
    return cookieMatch[1];
  }

  const data = await res.json();
  const token: string | undefined =
    data?.access_token ?? data?.token ?? data?.data?.access_token ?? data?.data?.token;

  if (!token) {
    throw new Error("Admin API login response did not contain a token");
  }

  return token;
}

export async function refreshAdminToken(
  currentToken: string
): Promise<string | null> {
  try {
    const baseUrl = getAdminBaseUrl();

    const res = await fetch(`${baseUrl}/auth/refresh-token`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${currentToken}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const token: string | undefined =
      data?.access_token ?? data?.token ?? data?.data?.access_token ?? data?.data?.token;

    return token ?? null;
  } catch {
    return null;
  }
}
