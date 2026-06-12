import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SessionData, sessionOptions } from "@/lib/server/session";
import { fetchAdmin } from "@/lib/server/auth";

export async function POST(request: Request) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.adminToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { journeyDate, sourceId, destinationId } = body;

  if (!journeyDate || !sourceId || !destinationId) {
    return Response.json({ services: [] }, { status: 400 });
  }

  try {
    const { res } = await fetchAdmin("/services/details", session.adminToken, {
      method: "POST",
      body: JSON.stringify({
        fromDate: journeyDate,
        toDate: journeyDate,
        sourceId: Number(sourceId),
        destinationId: Number(destinationId),
      }),
    });

    if (!res.ok) {
      console.error("[services-by-date] admin API status:", res.status, await res.text().catch(() => ""));
      return Response.json({ services: [] });
    }

    const data = await res.json();
    const raw: any[] = data.data ?? [];

    const services = raw.map((svc: any) => {
      const dateEntry =
        (svc.dataByDate ?? []).find((d: any) => d.date === journeyDate) ??
        svc.dataByDate?.[0] ??
        {};

      const occ = dateEntry.totalRevenue?.occupancyAndMarketCompetition?.freshbusOccupancy;
      const occupancyPct = occ != null ? parseFloat(String(occ)) : null;
      const totalSeats = svc.totalSeats ? Number(svc.totalSeats) : null;
      const bookedSeats =
        occupancyPct != null && totalSeats != null
          ? Math.round((occupancyPct / 100) * totalSeats)
          : null;

      return {
        serviceId: svc.serviceId,
        serviceKey: svc.serviceKey,
        routeName: svc.routeName,
        departureTime: svc.primeBoardingTime ?? svc.firstBoardingTime ?? null,
        totalSeats,
        bookedSeats,
        availableSeats: totalSeats != null && bookedSeats != null ? totalSeats - bookedSeats : null,
        occupancyPct,
        asp: dateEntry.totalRevenue?.asp ?? null,
        epk: dateEntry.epk ?? null,
        tripId: dateEntry.tripId ?? null,
        isAutomation: dateEntry.isAutomation ?? false,
      };
    });

    return Response.json({ services });
  } catch (e) {
    console.error("[services-by-date]", e);
    return Response.json({ services: [] });
  }
}
