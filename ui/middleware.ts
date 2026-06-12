import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions } from "@/lib/server/session";

export async function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith("/pricing") &&
    !request.nextUrl.pathname.startsWith("/pricing/login")
  ) {
    const response = NextResponse.next();
    const session = await getIronSession<SessionData>(request, response, sessionOptions);
    if (!session.isLoggedIn) {
      return NextResponse.redirect(new URL("/pricing/login", request.url));
    }
    return response;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/pricing/:path*"],
};
