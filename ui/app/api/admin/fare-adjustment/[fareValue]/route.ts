import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { applyFareAdjustment } from "@/lib/server/admin-api";

const bodySchema = z.object({
  tripIds: z.array(z.number().int()),
  reasonId: z.number().int(),
  seatType: z.array(z.string()).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fareValue: string }> }
) {
  try {
    const { fareValue: fareValueStr } = await params;
    const fareValue = Number(fareValueStr);

    if (isNaN(fareValue)) {
      return NextResponse.json({ error: "Invalid fareValue" }, { status: 400 });
    }

    if (fareValue < 0) {
      return NextResponse.json(
        {
          error:
            "Negative bus fare adjustment is not confirmed by admin API. Downward actions require backend confirmation before execution.",
          negativeWarning: true,
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { tripIds, reasonId, seatType } = parsed.data;
    const data = await applyFareAdjustment(fareValue, tripIds, reasonId, seatType);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
