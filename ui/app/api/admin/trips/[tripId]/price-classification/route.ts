import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updatePriceClassification } from "@/lib/server/admin-api";

const bodySchema = z.object({
  fareClassification: z.string().min(1),
  pricingModel: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { fareClassification, pricingModel } = parsed.data;
    const data = await updatePriceClassification(tripId, fareClassification, pricingModel);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
