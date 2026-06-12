import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ instructionId: string }> }
) {
  try {
    const { instructionId } = await params;

    const instruction = await prisma.pricingInstruction.update({
      where: { id: instructionId },
      data: { status: "disabled" },
    });

    return NextResponse.json({ instruction });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
