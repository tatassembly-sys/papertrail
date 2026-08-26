import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { getArticleById, markShared } from "@/lib/articles";
import { POSTERS } from "@/lib/social";
import { JSON_LIMIT_DEFAULT, asRecord, readJsonBody } from "@/lib/json-body";

export const runtime = "nodejs";
export const maxDuration = 30;

interface RouteParams {
  params: Promise<{ id: string }>;
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
      { error: "Only published articles can be shared — publish it first." },
      { status: 400 }
    );
  }

  if (!article.share_approved) {
    return NextResponse.json(
      {
        error:
          "Social sharing is not approved for this article yet. Approve sharing in admin first.",
      },
      { status: 403 }
    );
  }

  const parsed = await readJsonBody(req, JSON_LIMIT_DEFAULT);
  if (!parsed.ok) return parsed.response;
  const body = asRecord(parsed.value);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const platforms = Array.isArray(body.platforms)
    ? body.platforms.filter((p): p is string => typeof p === "string")
    : [];
  const validPlatforms = platforms.filter((p) => p in POSTERS);

  if (validPlatforms.length === 0) {
    return NextResponse.json(
      {
        error:
          "Provide at least one valid platform: facebook, instagram, reddit, x.",
      },
      { status: 400 }
    );
  }

  const results = await Promise.all(
    validPlatforms.map(async (platform) => {
      const result = await POSTERS[platform](article);
      if (result.success) await markShared(id, platform);
      return result;
    })
  );

  return NextResponse.json({ results });
}
