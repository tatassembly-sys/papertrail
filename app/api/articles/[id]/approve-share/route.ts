import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { setShareApproved, getArticleById } from "@/lib/articles";
import { JSON_LIMIT_DEFAULT, asRecord, readJsonBody } from "@/lib/json-body";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Admin toggles share_approved — only then can social APIs post. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const parsed = await readJsonBody(req, JSON_LIMIT_DEFAULT);
  if (!parsed.ok) return parsed.response;
  const body = asRecord(parsed.value) || {};
  const approved = body.approved !== false;

  const article = await getArticleById(id);
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (article.status !== "published") {
    return NextResponse.json(
      { error: "Publish the article before approving social sharing." },
      { status: 400 }
    );
  }

  await setShareApproved(id, approved);
  return NextResponse.json({ success: true, share_approved: approved });
}
