import { NextRequest, NextResponse } from "next/server";
import { getArticleById, getArticleBySlug } from "@/lib/articles";
import { askArticleAssistant, getThreadMessages } from "@/lib/article-chat";
import { getCurrentUserSession } from "@/lib/user-auth";
import { getClientIp, hashIp } from "@/lib/request-ip";
import { hitRateLimit } from "@/lib/rate-limit";
import { JSON_LIMIT_DEFAULT, asRecord, readJsonBody } from "@/lib/json-body";
import { randomBytes } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ id: string }>;
}

const CHAT_KEY_RE = /^[a-f0-9]{32}$/i;

function newChatKey(): string {
  return randomBytes(16).toString("hex");
}

function cookieChatKey(req: NextRequest): { key: string; fresh: boolean } {
  const existing = req.cookies.get("pt_chat")?.value;
  if (existing && CHAT_KEY_RE.test(existing)) {
    return { key: existing.toLowerCase(), fresh: false };
  }
  return { key: newChatKey(), fresh: true };
}

function threadKey(userId: string | undefined, cookieKey: string): string {
  return userId ? `user:${userId}` : cookieKey;
}

function setChatCookie(res: NextResponse, key: string, fresh: boolean) {
  if (!fresh) return;
  res.cookies.set("pt_chat", key, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
}

async function publishedArticle(id: string) {
  const article = (await getArticleById(id)) || (await getArticleBySlug(id, true));
  if (!article || article.status !== "published") return null;
  return article;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const article = await publishedArticle(id);
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await getCurrentUserSession();
  const cookie = cookieChatKey(req);
  const key = threadKey(session?.userId, cookie.key);
  const messages = await getThreadMessages(article.slug, key);
  const res = NextResponse.json({
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      at: m.at instanceof Date ? m.at.toISOString() : m.at,
    })),
  });
  if (!session) setChatCookie(res, cookie.key, cookie.fresh);
  return res;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const article = await publishedArticle(id);
  if (!article) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = await readJsonBody(req, JSON_LIMIT_DEFAULT);
  if (!parsed.ok) return parsed.response;
  const body = asRecord(parsed.value);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 2000) {
    return NextResponse.json({ error: "Message required (max 2000 chars)." }, { status: 400 });
  }

  const ipKey = hashIp(getClientIp(req));
  if (await hitRateLimit("chat", ipKey, 30, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Chat rate limit reached. Try again later." },
      { status: 429 }
    );
  }

  const session = await getCurrentUserSession();
  const cookie = cookieChatKey(req);
  const key = threadKey(session?.userId, cookie.key);

  try {
    const { reply, messages } = await askArticleAssistant(
      article,
      key,
      message,
      session?.userId
    );
    const res = NextResponse.json({
      reply,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        at: m.at instanceof Date ? m.at.toISOString() : m.at,
      })),
    });
    if (!session) setChatCookie(res, cookie.key, cookie.fresh);
    return res;
  } catch (err) {
    console.error("chat error:", err);
    const msg = err instanceof Error ? err.message : "";
    if (/OPENROUTER_API_KEY|rejected the API key|401/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "AI assistant is not configured (OpenRouter API key invalid). Free models are ready once OPENROUTER_API_KEY is updated.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Assistant unavailable. Try again shortly." },
      { status: 502 }
    );
  }
}
