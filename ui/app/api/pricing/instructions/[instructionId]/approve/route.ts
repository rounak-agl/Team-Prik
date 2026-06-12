import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SessionData, sessionOptions } from "@/lib/server/session";
import { prisma } from "@/lib/db";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ instructionId: string }> }
) {
  try {
    const { instructionId } = await params;

    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    const approvedBy = session.user?.email ?? "unknown";

    const instruction = await prisma.pricingInstruction.update({
      where: { id: instructionId },
      data: {
        status: "active",
        approvedBy,
        approvedAt: new Date(),
      },
    });

    return NextResponse.json({ instruction });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
