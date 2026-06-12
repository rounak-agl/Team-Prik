import { NextRequest, NextResponse } from "next/server";
import { getFareAdjustment } from "@/lib/server/admin-api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;
    const data = await getFareAdjustment(tripId);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
