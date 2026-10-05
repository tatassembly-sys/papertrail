import { NextRequest, NextResponse } from "next/server";
import { confirmSubscription } from "@/lib/newsletter";
import { getSiteUrl } from "@/lib/site-url";
import { JSON_LIMIT_AUTH, asRecord, readJsonBody } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET never confirms. Mail scanners prefetch links and would auto-subscribe.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const dest = new URL("/newsletter/confirm", getSiteUrl());
  if (token) dest.searchParams.set("token", token.slice(0, 128));
  return NextResponse.redirect(dest);
}

export async function POST(req: NextRequest) {
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
    const ok = await confirmSubscription(token);
    if (!ok) {
      return NextResponse.json({ error: "Invalid or expired confirmation link." }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("newsletter verify:", err);
    return NextResponse.json({ error: "Confirmation failed." }, { status: 500 });
  }
}
