import { NextResponse } from "next/server";
import {
  USER_SESSION_COOKIE,
  getCurrentUserSession,
  userSessionCookieOptions,
} from "@/lib/user-auth";
import { bumpTokenVersion } from "@/lib/users";

export async function POST() {
  const session = await getCurrentUserSession();
  if (session) {
    await bumpTokenVersion(session.userId);
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set(USER_SESSION_COOKIE, "", { ...userSessionCookieOptions(0), maxAge: 0 });
  return res;
}
