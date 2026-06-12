import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "100");
  const actionType = searchParams.get("actionType");

  const messageTypes =
    actionType === "change"
      ? ["change_summary", "change_failure"]
      : actionType === "instruction"
      ? ["instruction"]
      : actionType === "approval"
      ? ["approval_request", "approval_response"]
      : ["change_summary", "change_failure", "instruction", "approval_request", "approval_response", "alert"];

  const [messages, instructions, changes] = await Promise.all([
    prisma.pricingChatMessage.findMany({
      where: { messageType: { in: messageTypes } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { room: { select: { title: true } } },
    }),
    prisma.pricingInstruction.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { room: { select: { title: true } } },
    }),
    prisma.pricingChangeItem.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { batch: { select: { routeId: true, journeyDate: true } } },
    }),
  ]);

  const events = [
    ...messages.map((m) => ({
      id: m.id,
      type: "message" as const,
      subtype: m.messageType,
      actor: m.senderType,
      text: m.messageText.slice(0, 120),
      room: m.room?.title,
      at: m.createdAt,
    })),
    ...instructions.map((i) => ({
      id: i.id,
      type: "instruction" as const,
      subtype: i.instructionType,
      actor: i.createdBy || "BA",
      text: i.instructionText.slice(0, 120),
      room: i.room?.title,
      at: i.createdAt,
    })),
    ...changes.map((c) => ({
      id: c.id,
      type: "change" as const,
      subtype: c.writerStatus || "logged",
      actor: c.changedBy || "agent",
      text: `${c.serviceNumber}: ${c.beforeClassification} → ${c.afterClassification} | ${c.reasonToChange?.slice(0, 80)}`,
      room: `${c.batch?.routeId} · ${c.batch?.journeyDate}`,
      at: c.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);

  return NextResponse.json({ events });
}
