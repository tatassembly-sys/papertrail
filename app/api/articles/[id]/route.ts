import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { deleteArticle, getArticleById, updateArticle } from "@/lib/articles";
import { JSON_LIMIT_ARTICLE, asRecord, readJsonBody } from "@/lib/json-body";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const parsed = await readJsonBody(req, JSON_LIMIT_ARTICLE);
  if (!parsed.ok) return parsed.response;
  const body = asRecord(parsed.value);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Every published article must link back to its source — check both the
  // incoming update and, if source_url isn't part of this request, the
  // existing row (covers publishing a draft that was saved without one).
  if (body.status === "published") {
    let sourceUrl: string | null | undefined =
      typeof body.source_url === "string" || body.source_url === null
        ? (body.source_url as string | null)
        : undefined;
    if (sourceUrl === undefined) {
      const existing = await getArticleById(id);
      sourceUrl = existing?.source_url;
    }
    if (!sourceUrl || !String(sourceUrl).trim()) {
      return NextResponse.json(
        { error: "A source URL is required before publishing." },
        { status: 400 }
      );
    }
  }

  const updated = await updateArticle(id, body);

  if (!updated) {
    return NextResponse.json({ error: "Article not found or no valid fields to update." }, { status: 404 });
  }

  return NextResponse.json({ success: true, article: updated });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deleteArticle(id);

  if (!deleted) {
    return NextResponse.json({ error: "Article not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
