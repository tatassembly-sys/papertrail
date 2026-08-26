import { NextResponse } from "next/server";
import { SESSION_COOKIE, adminSessionCookieOptions } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  // Mirror login cookie attributes so browsers clear the same cookie jar entry.
  response.cookies.set(SESSION_COOKIE, "", {
    ...adminSessionCookieOptions(0),
    maxAge: 0,
  });
  return response;
}
