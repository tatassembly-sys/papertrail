import { NextRequest, NextResponse } from "next/server";
import { getArticleBySlug } from "@/lib/articles";
import { postProbeStatus } from "@/lib/post-probe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Used by middleware to choose a real HTTP 404 before the page shell streams. */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.trim() || "";
  if (!slug || slug.length > 200 || slug.includes("/")) {
    return new NextResponse(null, { status: 404 });
  }
  try {
    const article = await getArticleBySlug(slug);
    return new NextResponse(null, { status: postProbeStatus(Boolean(article)) });
  } catch (error) {
    console.error("post probe failed:", error);
    return new NextResponse(null, { status: 503 });
  }
}
