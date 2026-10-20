import { NextRequest, NextResponse } from "next/server";
import { tooManyPublicWrites } from "@/lib/rate-limit";
import {
  USER_SESSION_COOKIE,
  getCurrentUserSession,
  userSessionCookieOptions,
} from "@/lib/user-auth";
import { bumpTokenVersion } from "@/lib/users";

export async function POST(req: NextRequest) {
  const limited = await tooManyPublicWrites(req, "user_logout", 30, 60 * 60 * 1000);
  if (limited) return limited;
  const session = await getCurrentUserSession();
  if (session) {
    await bumpTokenVersion(session.userId);
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set(USER_SESSION_COOKIE, "", { ...userSessionCookieOptions(0), maxAge: 0 });
  return res;
}
