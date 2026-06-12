import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/server/session";
import { fetchAdmin } from "@/lib/server/auth";

export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.adminToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { res } = await fetchAdmin("/stations/pairs?main=true", session.adminToken);

    if (!res.ok) return Response.json({ pairs: [] });
    const data = await res.json();

    const raw: any[] = data.payload ?? data ?? [];

    const pairs = raw
      .filter((r) => r && (r.source || r.sourceStation))
      .map((r) => {
        const src = r.source ?? r.sourceStation ?? {};
        const dst = r.destination ?? r.destinationStation ?? {};
        return {
          id: r.id ?? `${src.id}_${dst.id}`,
          sourceId: src.id ?? r.sourceId ?? r.sourceid,
          sourceName: src.name ?? r.sourceName ?? r.source_name ?? "",
          destinationId: dst.id ?? r.destinationId ?? r.destinationid,
          destinationName: dst.name ?? r.destinationName ?? r.destination_name ?? "",
        };
      })
      .filter((p) => p.sourceName && p.destinationName);

    return Response.json({ pairs });
  } catch {
    return Response.json({ pairs: [] });
  }
}
