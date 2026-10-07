import { NextRequest, NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { runCronJob } from "@/lib/cron-run";
import { buildWeeklyDigest, sendWeeklyDigest } from "@/lib/newsletter";
import { requireAdmin } from "@/lib/auth-server";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** Cron / admin: build + send weekly digest to active subscribers. */
export async function GET(req: NextRequest) {
  const isPreview = req.nextUrl.searchParams.get("preview") === "1";

  // Preview for admins only (no send)
  if (isPreview) {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      const digest = await buildWeeklyDigest();
      return NextResponse.json({
        success: true,
        preview: true,
        subject: digest.subject,
        articleCount: digest.articleCount,
        aiSummary: digest.sections.aiSummary,
        newest: digest.sections.newest.map((a) => ({
          title: a.title,
          slug: a.slug,
        })),
        trending: digest.sections.trending.map((a) => ({
          title: a.title,
          slug: a.slug,
        })),
        editorPicks: digest.sections.editorPicks.map((a) => ({
          title: a.title,
          slug: a.slug,
        })),
      });
    } catch (err) {
      console.error("digest preview error:", err);
      return NextResponse.json({ error: "Preview failed." }, { status: 500 });
    }
  }

  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  return runCronJob("newsletter-digest", async () => {
  try {
    const result = await sendWeeklyDigest();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("digest error:", err);
    return NextResponse.json({ error: "Digest failed." }, { status: 500 });
  }
  });
}

/** Admin can also POST to force-send. */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runCronJob("newsletter-digest", async () => {
  try {
    const result = await sendWeeklyDigest();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("digest POST error:", err);
    return NextResponse.json({ error: "Digest failed." }, { status: 500 });
  }
  });
}
