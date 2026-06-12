import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { refreshAdminToken } from "@/lib/server/auth";
import { SessionData, sessionOptions } from "@/lib/server/session";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  if (!session.isLoggedIn || !session.adminToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const newToken = await refreshAdminToken(session.adminToken);
  if (!newToken) {
    return NextResponse.json({ error: "Token refresh failed" }, { status: 401 });
  }

  session.adminToken = newToken;
  await session.save();

  return response;
}
