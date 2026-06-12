import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const createMessageSchema = z.object({
  messageText: z.string().min(1),
  messageType: z.string().optional(),
  senderType: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;

    const messages = await prisma.pricingChatMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: "asc" },
    });

    const parsed = messages.map((msg) => ({
      ...msg,
      metadata: (() => {
        try {
          return JSON.parse(msg.metadata);
        } catch {
          return {};
        }
      })(),
    }));

    return NextResponse.json({ messages: parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const parsed = createMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { messageText, messageType, senderType, metadata } = parsed.data;

    const message = await prisma.pricingChatMessage.create({
      data: {
        roomId,
        messageText,
        messageType: messageType ?? "text",
        senderType: senderType ?? "ba",
        metadata: JSON.stringify(metadata ?? {}),
      },
    });

    return NextResponse.json({
      message: {
        ...message,
        metadata: (() => {
          try {
            return JSON.parse(message.metadata);
          } catch {
            return {};
          }
        })(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
