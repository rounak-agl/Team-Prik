import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  status: z.string().optional(),
  approvedBy: z.string().optional(),
  expiresAt: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ instructionId: string }> }
) {
  try {
    const { instructionId } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { status, approvedBy, expiresAt } = parsed.data;

    const instruction = await prisma.pricingInstruction.update({
      where: { id: instructionId },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(approvedBy !== undefined ? { approvedBy } : {}),
        ...(expiresAt !== undefined ? { expiresAt: new Date(expiresAt) } : {}),
      },
    });

    return NextResponse.json({ instruction });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
