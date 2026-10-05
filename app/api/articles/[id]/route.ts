import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { deleteArticle, getArticleById, updateArticle } from "@/lib/articles";
import { JSON_LIMIT_ARTICLE, asRecord, readJsonBody } from "@/lib/json-body";
import { PublishGateError, publishBlocker } from "@/lib/publish-gate";

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

  const existing = await getArticleById(id);
  const nextStatus =
    body.status === "draft" || body.status === "published"
      ? body.status
      : existing?.status;
  if (nextStatus === "published") {
    if (!existing) {
      return NextResponse.json({ error: "Article not found or no valid fields to update." }, { status: 404 });
    }
    const sourceUrl =
      typeof body.source_url === "string" || body.source_url === null
        ? (body.source_url as string | null)
        : existing.source_url;
    const caveats = typeof body.caveats === "string" ? body.caveats : existing.caveats;
    const blocked = publishBlocker({ sourceUrl, caveats });
    if (blocked) {
      return NextResponse.json({ error: blocked }, { status: 400 });
    }
  }

  let updated;
  try {
    updated = await updateArticle(id, body);
  } catch (err) {
    if (err instanceof PublishGateError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

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
