import { NextRequest, NextResponse } from "next/server";
import { getFareAdjustmentReasons } from "@/lib/server/admin-api";

export async function GET(_request: NextRequest) {
  try {
    const data = await getFareAdjustmentReasons();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
