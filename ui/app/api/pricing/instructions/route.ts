import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const scope = searchParams.get("scope");
  const routeId = searchParams.get("routeId");

  const instructions = await prisma.pricingInstruction.findMany({
    where: {
      ...(status ? { status } : { status: { not: "expired" } }),
      ...(scope ? { scope } : {}),
      ...(routeId ? { routeId: { contains: routeId } } : {}),
    },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: { room: { select: { title: true, journeyDate: true } } },
  });

  return NextResponse.json({ instructions });
}
