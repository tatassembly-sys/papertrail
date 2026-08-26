import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getCurrentUserSession } from "@/lib/user-auth";
import { getUserPublic, updateUserProfile, toggleSavedSlug } from "@/lib/users";
import { JSON_LIMIT_DEFAULT, asRecord, readJsonBody } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [session, store] = await Promise.all([getCurrentUserSession(), cookies()]);
  const [user, admin] = await Promise.all([
    session ? getUserPublic(session.userId) : Promise.resolve(null),
    verifySessionToken(store.get(SESSION_COOKIE)?.value),
  ]);
  return NextResponse.json(
    { user, admin },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(req: NextRequest) {
  const session = await getCurrentUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await readJsonBody(req, JSON_LIMIT_DEFAULT);
  if (!parsed.ok) return parsed.response;
  const body = asRecord(parsed.value);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.slug === "string" && (body.action === "save" || body.action === "bookmark")) {
    const slug = body.slug.trim().slice(0, 120);
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) {
      return NextResponse.json({ error: "Invalid slug." }, { status: 400 });
    }
    const field = body.action === "save" ? "saved_slugs" : "bookmarks";
    const user = await toggleSavedSlug(session.userId, slug, field);
    return NextResponse.json({ user });
  }

  const topics = Array.isArray(body.followed_topics)
    ? body.followed_topics
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().slice(0, 60))
        .filter(Boolean)
        .slice(0, 40)
    : undefined;

  const user = await updateUserProfile(session.userId, {
    name:
      typeof body.name === "string" ? body.name.trim().slice(0, 80) : undefined,
    followed_topics: topics,
  });
  return NextResponse.json({ user });
}
