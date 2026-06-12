import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ decisionId: string }> }
) {
  const { decisionId } = await params;
  // Mock: real implementation calls Python agent
  return NextResponse.json({
    success: true,
    message: "Recommendation rejected (mock)",
    decisionId,
  });
}
