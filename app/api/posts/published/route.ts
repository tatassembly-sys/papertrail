import { NextRequest, NextResponse } from "next/server";
import { publishedSlugExists } from "@/lib/articles";
import { postProbeStatus, PROBE_CACHE_CONTROL } from "@/lib/post-probe";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Used by middleware to choose a real HTTP 404 before the page shell streams. */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.trim() || "";
  if (!slug || slug.length > 200 || slug.includes("/")) {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": PROBE_CACHE_CONTROL } });
  }
  try {
    const exists = await publishedSlugExists(slug);
    return new NextResponse(null, {
      status: postProbeStatus(exists),
      headers: { "Cache-Control": PROBE_CACHE_CONTROL },
    });
  } catch (error) {
    log.error("post probe failed", error, { route: "/api/posts/published" });
    return new NextResponse(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
