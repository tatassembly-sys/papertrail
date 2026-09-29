import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/user-auth";
import { findUserById } from "@/lib/users";
import { createHighlight, listHighlights } from "@/lib/highlights";
import { JSON_LIMIT_DEFAULT, asRecord, readJsonBody } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getCurrentUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || undefined;
  const highlights = await listHighlights(session.userId, slug || undefined);
  return NextResponse.json(
    { highlights },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  const session = await getCurrentUserSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sign in to save highlights.", login: "/user-login?next=/library" },
      { status: 401 }
    );
  }
  const parsed = await readJsonBody(req, JSON_LIMIT_DEFAULT);
  if (!parsed.ok) return parsed.response;
  const body = asRecord(parsed.value);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  const user = await findUserById(session.userId);
  const result = await createHighlight(session.userId, user, {
    slug: typeof body.slug === "string" ? body.slug : "",
    quote: typeof body.quote === "string" ? body.quote : "",
    note: typeof body.note === "string" ? body.note : "",
  });
  if ("error" in result) {
    return NextResponse.json(result, {
      status: result.code === "upgrade_required" ? 402 : 400,
    });
  }
  return NextResponse.json({ highlight: result }, { status: 201 });
}
