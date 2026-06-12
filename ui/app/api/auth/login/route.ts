import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { z } from "zod";
import { loginToAdminAPI } from "@/lib/server/auth";
import { SessionData, sessionOptions } from "@/lib/server/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const adminToken = await loginToAdminAPI(email, password);

    const response = NextResponse.json({ success: true, user: { email } });
    const session = await getIronSession<SessionData>(request, response, sessionOptions);

    session.user = { email };
    session.adminToken = adminToken;
    session.isLoggedIn = true;
    await session.save();

    return response;
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
}
