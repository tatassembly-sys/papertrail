import { NextRequest, NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { publishDailyFieldMix } from "@/lib/publish-mix";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily cron: one new published note per field, never the whole queue. */
export async function GET(req: NextRequest) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  try {
    const result = await publishDailyFieldMix();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("cron-publish-mix:", err);
    return NextResponse.json({ error: "Publish mix failed." }, { status: 500 });
  }
}
