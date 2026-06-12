import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  routeId: z.string().min(1),
  routeDirection: z.string().min(1),
  source: z.string().optional(),
  destination: z.string().optional(),
  journeyDate: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { routeId, routeDirection, source, destination, journeyDate } = parsed.data;

    // Format date for display
    const dateDisplay = new Date(journeyDate).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const title = `${source || routeId} → ${destination || routeDirection} · ${dateDisplay}`;

    // Upsert: findFirst by unique combo, create if not found
    let room = await prisma.pricingChatRoom.findFirst({
      where: { routeId, routeDirection, journeyDate },
    });

    if (!room) {
      room = await prisma.pricingChatRoom.create({
        data: {
          routeId,
          routeDirection,
          source,
          destination,
          journeyDate,
          title,
        },
      });
    }

    return NextResponse.json({ room });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
