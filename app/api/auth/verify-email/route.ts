import { NextRequest, NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/users";
import { getSiteUrl } from "@/lib/site-url";
import { JSON_LIMIT_AUTH, asRecord, readJsonBody } from "@/lib/json-body";
import { tooManyPublicWrites } from "@/lib/rate-limit";
import { log } from "@/lib/log";

export const runtime = "nodejs";

/**
 * GET never verifies. Mail scanners prefetch links and would auto-confirm.
 * Send the user to a page that POSTs the token.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const dest = new URL("/verify-email", getSiteUrl());
  if (token) dest.searchParams.set("token", token.slice(0, 128));
  return NextResponse.redirect(dest);
}

export async function POST(req: NextRequest) {
  const limited = await tooManyPublicWrites(req, "verify_email", 20, 60 * 60 * 1000);
  if (limited) return limited;
  try {
    const contentType = req.headers.get("content-type") || "";
    let token = "";
    if (contentType.includes("application/json")) {
      const parsed = await readJsonBody(req, JSON_LIMIT_AUTH);
      if (!parsed.ok) return parsed.response;
      const body = asRecord(parsed.value);
      token = typeof body?.token === "string" ? body.token.slice(0, 128) : "";
    } else {
      const form = await req.formData();
      const t = form.get("token");
      token = typeof t === "string" ? t.slice(0, 128) : "";
    }
    const ok = await verifyEmailToken(token);
    if (!ok) {
      return NextResponse.json({ error: "Invalid or expired verification link." }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error("verify-email", err, { route: "/api/auth/verify-email" });
    return NextResponse.json({ error: "Verification failed." }, { status: 500 });
  }
}
