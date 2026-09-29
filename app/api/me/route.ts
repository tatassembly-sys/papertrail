import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import {
  getCurrentUserSession,
  USER_SESSION_COOKIE,
  userSessionCookieOptions,
} from "@/lib/user-auth";
import {
  getUserPublic,
  updateUserProfile,
  toggleSavedSlug,
  deleteUserAccount,
  findUserById,
} from "@/lib/users";
import { getPublishedArticlesBySlugs } from "@/lib/articles";
import { deleteThreadsForUser } from "@/lib/article-chat";
import { deleteCollectionsForUser } from "@/lib/collections";
import { deleteHighlightsForUser } from "@/lib/highlights";
import { JSON_LIMIT_DEFAULT, asRecord, readJsonBody } from "@/lib/json-body";
import {
  DAY_MS,
  FREE_CHAT_PER_DAY,
  billingPublicConfig,
  entitlementsFor,
} from "@/lib/entitlements";
import { getRateCount } from "@/lib/rate-limit";
import { cancelSubscriptionNow } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [session, store] = await Promise.all([getCurrentUserSession(), cookies()]);
  const [user, admin] = await Promise.all([
    session ? getUserPublic(session.userId) : Promise.resolve(null),
    verifySessionToken(store.get(SESSION_COOKIE)?.value),
  ]);

  const slugs = user
    ? [
        ...user.saved_slugs,
        ...user.bookmarks,
        ...user.reading_history.map((h) => h.slug),
      ]
    : [];
  const listed = slugs.length
    ? await getPublishedArticlesBySlugs(slugs, 50)
    : [];
  const titles: Record<string, string> = {};
  for (const article of listed) titles[article.slug] = article.title;

  const full = session ? await findUserById(session.userId) : null;
  const entitlements = entitlementsFor(full);
  const chatUsed = session
    ? await getRateCount("chat_day", `user:${session.userId}`, DAY_MS)
    : 0;

  return NextResponse.json(
    {
      user,
      admin,
      titles,
      billing: billingPublicConfig(),
      usage: user
        ? {
            chatToday: entitlements.chatPerDay == null ? chatUsed : Math.min(chatUsed, FREE_CHAT_PER_DAY),
            chatLimit: entitlements.chatPerDay,
            saves: user.saved_slugs.length,
            saveLimit: entitlements.saves,
            bookmarks: user.bookmarks.length,
            bookmarkLimit: entitlements.bookmarks,
          }
        : null,
    },
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
    const current = await findUserById(session.userId);
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const list = current[field] || [];
    const adding = !list.includes(slug);
    const cap = entitlementsFor(current)[field === "saved_slugs" ? "saves" : "bookmarks"];
    if (adding && cap != null && list.length >= cap) {
      return NextResponse.json(
        {
          error: `Free accounts can keep ${cap} ${
            field === "saved_slugs" ? "saved papers" : "bookmarks"
          }. Upgrade to Pro for an unlimited library.`,
          code: "upgrade_required",
          upgradeUrl: "/pricing",
        },
        { status: 402 }
      );
    }
    const user = await toggleSavedSlug(session.userId, slug, field);
    return NextResponse.json({ user });
  }

  const current = await findUserById(session.userId);
  const topicCap = entitlementsFor(current).topics ?? 40;
  const topics = Array.isArray(body.followed_topics)
    ? body.followed_topics
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().slice(0, 60))
        .filter(Boolean)
        .slice(0, topicCap)
    : undefined;

  const user = await updateUserProfile(session.userId, {
    name:
      typeof body.name === "string" ? body.name.trim().slice(0, 80) : undefined,
    followed_topics: topics,
  });
  return NextResponse.json({ user });
}

export async function DELETE() {
  const session = await getCurrentUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await findUserById(session.userId);
  if (existing?.stripe_subscription_id) {
    try {
      await cancelSubscriptionNow(existing.stripe_subscription_id);
    } catch (err) {
      console.error("cancel stripe on account delete:", err);
    }
  }

  await deleteThreadsForUser(session.userId);
  await deleteCollectionsForUser(session.userId);
  await deleteHighlightsForUser(session.userId);
  const ok = await deleteUserAccount(session.userId);
  if (!ok) {
    return NextResponse.json({ error: "Could not delete account." }, { status: 404 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(USER_SESSION_COOKIE, "", { ...userSessionCookieOptions(0), maxAge: 0 });
  return res;
}
