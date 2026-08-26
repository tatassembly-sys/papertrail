import { NextRequest, NextResponse } from "next/server";
import { confirmSubscription } from "@/lib/newsletter";
import { getSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const ok = await confirmSubscription(token);
  const base = getSiteUrl();
  return NextResponse.redirect(
    `${base}/newsletter?${ok ? "confirmed=1" : "confirmed=0"}`
  );
}
