import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const recentBatches = await prisma.pricingChangeBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      room: { select: { title: true, source: true, destination: true, journeyDate: true } },
      _count: { select: { items: true } },
      items: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          serviceNumber: true, serviceId: true, beforeClassification: true,
          afterClassification: true, beforeBusAdjPct: true, afterBusAdjPct: true,
          reasonToChange: true, agentConfidence: true, riskLevel: true, writerStatus: true,
          beforeEffectiveFare: true, afterEffectiveFare: true,
        },
      },
    },
  });

  const totalItems = await prisma.pricingChangeItem.count();
  const appliedItems = await prisma.pricingChangeItem.count({ where: { writerStatus: "applied" } });
  const failedItems = await prisma.pricingChangeItem.count({ where: { writerStatus: "failed" } });

  return NextResponse.json({
    stats: { totalItems, appliedItems, failedItems, batches: recentBatches.length },
    batches: recentBatches,
  });
}
