import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const routeId = searchParams.get("routeId");
  const date = searchParams.get("date");
  const status = searchParams.get("status");

  const batches = await prisma.pricingChangeBatch.findMany({
    where: {
      ...(routeId ? { routeId: { contains: routeId } } : {}),
      ...(date ? { journeyDate: date } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      room: { select: { title: true, source: true, destination: true } },
      items: {
        select: {
          serviceNumber: true, beforeClassification: true, afterClassification: true,
          beforeBusAdjPct: true, afterBusAdjPct: true, beforeEffectiveFare: true,
          afterEffectiveFare: true, reasonToChange: true, writerStatus: true,
        },
        take: 3,
      },
    },
  });

  return NextResponse.json({ batches });
}
