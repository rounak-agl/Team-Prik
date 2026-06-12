import { SessionOptions } from "iron-session";

export interface SessionData {
  user?: {
    email: string;
    name?: string;
    role?: string;
  };
  adminToken?: string;
  isLoggedIn: boolean;
}

export const sessionOptions: SessionOptions = {
  password: process.env.PRICING_COPILOT_JWT_SECRET as string,
  cookieName: "freshbus-pricing-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  },
};
