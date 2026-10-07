import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { getAdminOpsStatus } from "@/lib/admin-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin ops snapshot: queue (counts plus last stored error), articles, newsletter, mail mode. */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await getAdminOpsStatus();
    return NextResponse.json({ success: true, ...status });
  } catch (err) {
    console.error("admin status:", err);
    return NextResponse.json({ error: "Status unavailable." }, { status: 500 });
  }
}
