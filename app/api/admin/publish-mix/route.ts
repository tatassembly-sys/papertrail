import { NextRequest, NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { requireAdmin } from "@/lib/auth-server";
import { publishDailyFieldMix } from "@/lib/publish-mix";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const cronDenied = assertCronAuthorized(req);
  if (cronDenied && !(await requireAdmin())) {
    return cronDenied;
  }

  try {
    const force = req.nextUrl.searchParams.get("force") === "1";
    const result = await publishDailyFieldMix({ force });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    log.error("publish-mix", err, { route: "/api/admin/publish-mix" });
    return NextResponse.json({ error: "Publish mix failed." }, { status: 500 });
  }
}
