import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, adminSessionCookieOptions } from "@/lib/auth";
import { tooManyPublicWrites } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limited = await tooManyPublicWrites(req, "admin_logout", 30, 60 * 60 * 1000);
  if (limited) return limited;
  const response = NextResponse.json({ success: true });
  // Mirror login cookie attributes so browsers clear the same cookie jar entry.
  response.cookies.set(SESSION_COOKIE, "", {
    ...adminSessionCookieOptions(0),
    maxAge: 0,
  });
  return response;
}
