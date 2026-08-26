import { NextRequest, NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/users";
import { getSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const ok = await verifyEmailToken(token);
  const base = getSiteUrl();
  if (ok) {
    return NextResponse.redirect(`${base}/account?verified=1`);
  }
  return NextResponse.redirect(`${base}/account?verified=0`);
}
