import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getRecentAgentDecisions, type AgentDecision } from "@/lib/server/clickhouse";

export async function GET() {
  // 1) Live agent decisions logged by the Python multi-agent (ClickHouse).
  let agentDecisions: AgentDecision[] = [];
  try {
    agentDecisions = await getRecentAgentDecisions(50);
  } catch (e) {
    console.warn("[pricing/decisions] ClickHouse agent log unavailable:", e);
  }
  const agentStats = {
    total: agentDecisions.length,
    increases: agentDecisions.filter((d) => Number(d.adjustment_pct) > 0).length,
    decreases: agentDecisions.filter((d) => Number(d.adjustment_pct) < 0).length,
    reclassifications: agentDecisions.filter((d) => Number(d.tier_step) !== 0).length,
  };

  // 2) Human/approved change batches (Prisma) — separate workflow, may be empty.
  let recentBatches: unknown[] = [];
  let itemStats = { totalItems: 0, appliedItems: 0, failedItems: 0 };
  try {
    recentBatches = await prisma.pricingChangeBatch.findMany({
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
    itemStats = {
      totalItems: await prisma.pricingChangeItem.count(),
      appliedItems: await prisma.pricingChangeItem.count({ where: { writerStatus: "applied" } }),
      failedItems: await prisma.pricingChangeItem.count({ where: { writerStatus: "failed" } }),
    };
  } catch (e) {
    console.warn("[pricing/decisions] Prisma batches unavailable:", e);
  }

  return NextResponse.json({
    agentStats,
    agentDecisions,
    stats: { ...itemStats, batches: recentBatches.length },
    batches: recentBatches,
  });
}
