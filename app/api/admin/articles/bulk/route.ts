import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { readJsonBody } from "@/lib/json-body";
import { bulkReview, parseBulkBody } from "@/lib/bulk-review";
import { log } from "@/lib/log";

export const runtime = "nodejs";

/** Admin bulk approve (publish) or reject (delete) of drafts (M9.3). */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = await readJsonBody(req, 16_384);
  if (!parsed.ok) return parsed.response;
  const body = parseBulkBody(parsed.value);
  if (typeof body === "string") return NextResponse.json({ error: body }, { status: 400 });
  try {
    const results = await bulkReview(body.action, body.ids);
    return NextResponse.json({ success: true, results, done: results.filter((r) => r.ok).length });
  } catch (err) {
    log.error("bulk review", err, { route: "/api/admin/articles/bulk" });
    return NextResponse.json({ error: "Bulk update failed." }, { status: 500 });
  }
}
