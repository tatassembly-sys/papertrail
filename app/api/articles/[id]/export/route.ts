import { NextRequest, NextResponse } from "next/server";
import { getArticleById, getArticleBySlug } from "@/lib/articles";
import { getCurrentUserSession } from "@/lib/user-auth";
import { findUserById } from "@/lib/users";
import { isProUser } from "@/lib/entitlements";
import { articleToMarkdown, markdownFilename } from "@/lib/export-note";
import { getSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const article = (await getArticleById(id)) || (await getArticleBySlug(id, true));
  if (!article || article.status !== "published") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await getCurrentUserSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sign in to export notes.", login: "/user-login?next=/pricing" },
      { status: 401 }
    );
  }

  const user = await findUserById(session.userId);
  if (!isProUser(user)) {
    return NextResponse.json(
      {
        error: "Markdown export is included with Paper Trail Pro.",
        code: "upgrade_required",
        upgradeUrl: "/pricing",
      },
      { status: 402 }
    );
  }

  const markdown = articleToMarkdown(article, getSiteUrl());
  const filename = markdownFilename(article.slug);
  return new NextResponse(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
