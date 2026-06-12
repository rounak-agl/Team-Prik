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
        ...(route ? { routeId: route } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ rooms });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
