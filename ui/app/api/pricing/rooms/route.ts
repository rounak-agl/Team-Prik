import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const route = searchParams.get("route");

    const rooms = await prisma.pricingChatRoom.findMany({
      where: {
        ...(date ? { journeyDate: date } : {}),
        ...(route ? { routeId: { contains: route } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { _count: { select: { messages: true } } },
    });

    return NextResponse.json({ rooms: rooms.map(r => ({ ...r, messageCount: r._count.messages })) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
