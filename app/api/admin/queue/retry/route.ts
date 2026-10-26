import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { readJsonBody } from "@/lib/json-body";
import { retryFailedQueueItems } from "@/lib/queue";
import { log } from "@/lib/log";

export const runtime = "nodejs";

/** Admin: retry failed queue rows (all, or the given ids) (M9.3). */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = await readJsonBody(req, 16_384);
  if (!parsed.ok) return parsed.response;
  const raw = parsed.value as { ids?: unknown } | null;
  const ids = raw && Array.isArray(raw.ids) ? raw.ids.filter((x): x is string => typeof x === "string").slice(0, 500) : undefined;
  try {
    const retried = await retryFailedQueueItems(ids);
    return NextResponse.json({ success: true, retried });
  } catch (err) {
    log.error("queue retry", err, { route: "/api/admin/queue/retry" });
    return NextResponse.json({ error: "Retry failed." }, { status: 500 });
  }
}
