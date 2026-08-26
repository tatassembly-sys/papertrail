import { NextRequest, NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/newsletter";
import { getSiteUrl } from "@/lib/site-url";
import { JSON_LIMIT_AUTH, asRecord, readJsonBody } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const ok = await unsubscribeByToken(token);
  const base = getSiteUrl();
  return NextResponse.redirect(
    `${base}/newsletter?${ok ? "unsubscribed=1" : "unsubscribed=0"}`
  );
}

/** POST supports form-style unsubscribe from the page. */
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
      token = typeof t === "string" ? t : "";
    }
    const ok = await unsubscribeByToken(token);
    if (!ok) {
      return NextResponse.json({ error: "Invalid unsubscribe link." }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("newsletter unsubscribe:", err);
    return NextResponse.json({ error: "Unsubscribe failed." }, { status: 500 });
  }
}
