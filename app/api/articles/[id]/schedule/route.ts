import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { getArticleById } from "@/lib/articles";
import { createScheduledPost, getScheduledPostsForArticle } from "@/lib/scheduledPosts";
import { VALID_PLATFORMS } from "@/lib/social";
import { JSON_LIMIT_DEFAULT, asRecord, readJsonBody } from "@/lib/json-body";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const scheduled = await getScheduledPostsForArticle(id);
  return NextResponse.json({ scheduled });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const article = await getArticleById(id);

  if (!article) {
    return NextResponse.json({ error: "Article not found." }, { status: 404 });
  }
  if (article.status !== "published") {
    return NextResponse.json(
      { error: "Only published articles can be scheduled — publish it first." },
      { status: 400 }
    );
  }
  if (!article.share_approved) {
    return NextResponse.json(
      { error: "Approve social sharing for this article before scheduling." },
      { status: 403 }
    );
  }

  const parsed = await readJsonBody(req, JSON_LIMIT_DEFAULT);
  if (!parsed.ok) return parsed.response;
  const body = asRecord(parsed.value);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const platform = body.platform;
  const scheduledFor = body.scheduledFor;

  if (typeof platform !== "string" || !VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json(
      { error: `platform must be one of: ${VALID_PLATFORMS.join(", ")}` },
      { status: 400 }
    );
  }

  const scheduledDate = new Date(typeof scheduledFor === "string" ? scheduledFor : "");
  if (!scheduledFor || isNaN(scheduledDate.getTime())) {
    return NextResponse.json({ error: "scheduledFor must be a valid date/time." }, { status: 400 });
  }
  if (scheduledDate.getTime() <= Date.now()) {
    return NextResponse.json({ error: "scheduledFor must be in the future." }, { status: 400 });
  }

  try {
    const scheduled = await createScheduledPost(id, platform, scheduledDate);
    return NextResponse.json({ success: true, scheduled }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to schedule post.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
