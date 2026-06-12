import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions } from "@/lib/server/session";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  session.destroy();
  return response;
}
