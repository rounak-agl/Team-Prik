import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/server/session";
import { getAdminBaseUrl } from "@/lib/server/auth";

export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.adminToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = `${getAdminBaseUrl()}/stations/pairs`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.adminToken}` },
      cache: "no-store",
    });

    if (!res.ok) return Response.json({ pairs: [] });
    const data = await res.json();
    return Response.json({ pairs: data.payload ?? data });
  } catch {
    return Response.json({ pairs: [] });
  }
}
