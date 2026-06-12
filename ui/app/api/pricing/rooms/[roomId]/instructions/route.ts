import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const createInstructionSchema = z.object({
  instructionText: z.string().min(1),
  scope: z.string().optional(),
  instructionType: z.string().optional(),
  serviceId: z.string().optional(),
  serviceNumber: z.string().optional(),
  timeBand: z.string().optional(),
  expiresAt: z.string().optional(),
  priority: z.number().int().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;

    const instructions = await prisma.pricingInstruction.findMany({
      where: {
        roomId,
        status: { notIn: ["disabled", "expired"] },
      },
      orderBy: { priority: "asc" },
    });

    return NextResponse.json({ instructions });
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
    const parsed = createInstructionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      instructionText,
      scope,
      instructionType,
      serviceId,
      serviceNumber,
      timeBand,
      expiresAt,
      priority,
    } = parsed.data;

    // Basic JSON parsing: wrap text for now; full LLM parsing is a future task
    const instructionJson = JSON.stringify({ text: instructionText });

    const instruction = await prisma.pricingInstruction.create({
      data: {
        roomId,
        instructionText,
        instructionJson,
        scope: scope ?? "route",
        instructionType: instructionType ?? "general",
        serviceId,
        serviceNumber,
        timeBand,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        priority: priority ?? 100,
      },
    });

    return NextResponse.json({ instruction });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
