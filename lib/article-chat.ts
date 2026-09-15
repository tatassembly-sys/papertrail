import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { ARTICLE_CHAT_SYSTEM, type ArticleRow } from "./prompts";
import { openRouterChat } from "./openrouter";
import { isXaiConfigured, xaiChat } from "./xai";
import { answerFromArticle } from "./extract-draft";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  at: Date;
}

export interface ChatThreadDoc {
  _id: ObjectId;
  article_id: string;
  article_slug: string;
  user_id?: string | null;
  session_key: string;
  messages: ChatMessage[];
  updated_at: Date;
  created_at: Date;
}

async function threads() {
  const db = await getDb();
  return db.collection<ChatThreadDoc>("article_chats");
}

export async function getOrCreateThread(
  article: ArticleRow,
  sessionKey: string,
  userId?: string | null
): Promise<ChatThreadDoc> {
  const col = await threads();
  const existing = await col.findOne({
    article_slug: article.slug,
    session_key: sessionKey,
  });
  if (existing) return existing;

  const doc: Omit<ChatThreadDoc, "_id"> = {
    article_id: article.id || "",
    article_slug: article.slug,
    user_id: userId || null,
    session_key: sessionKey,
    messages: [],
    created_at: new Date(),
    updated_at: new Date(),
  };
  try {
    const result = await col.insertOne(doc as ChatThreadDoc);
    return { ...doc, _id: result.insertedId } as ChatThreadDoc;
  } catch (err) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code: number }).code
        : 0;
    if (code !== 11000) throw err;
    const raced = await col.findOne({
      article_slug: article.slug,
      session_key: sessionKey,
    });
    if (raced) return raced;
    throw err;
  }
}

export async function getThreadMessages(
  articleSlug: string,
  sessionKey: string
): Promise<ChatMessage[]> {
  const col = await threads();
  const t = await col.findOne({ article_slug: articleSlug, session_key: sessionKey });
  return t?.messages || [];
}

function buildContext(article: ArticleRow): string {
  return [
    `Title: ${article.title}`,
    `Headline: ${article.headline}`,
    `Why it matters: ${(article.why_it_matters || []).join("; ")}`,
    `Explanation: ${article.plain_explanation}`,
    `Caveats / limitations: ${article.caveats}`,
    article.source_url ? `Source: ${article.source_url}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function askArticleAssistant(
  article: ArticleRow,
  sessionKey: string,
  userMessage: string,
  userId?: string | null
): Promise<{ reply: string; messages: ChatMessage[] }> {
  const col = await threads();
  const thread = await getOrCreateThread(article, sessionKey, userId);
  const history = thread.messages.slice(-12);

  const messages = [
    { role: "system" as const, content: ARTICLE_CHAT_SYSTEM },
    {
      role: "system" as const,
      content: `Article context:\n\n${buildContext(article)}`,
    },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: userMessage.slice(0, 2000) },
  ];

  const maxTokens = Number(process.env.OPENROUTER_CHAT_MAX_TOKENS || 800);

  // OpenRouter free models → xAI if configured → source-text extract
  let reply: string;
  try {
    const result = await openRouterChat({
      title: "Paper Trail Chat",
      temperature: 0.3,
      maxTokens,
      maxAttempts: 5,
      messages,
    });
    reply = result.content;
  } catch (err) {
    console.warn("[chat] OpenRouter failed, trying fallbacks", err);
    try {
      if (isXaiConfigured()) {
        reply = await xaiChat({ messages, temperature: 0.3, maxTokens });
      } else {
        throw err;
      }
    } catch {
      reply = answerFromArticle(article, userMessage);
    }
  }

  const now = new Date();
  const userMsg: ChatMessage = { role: "user", content: userMessage, at: now };
  const assistantMsg: ChatMessage = { role: "assistant", content: reply, at: now };

  await col.updateOne(
    { _id: thread._id },
    {
      $push: { messages: { $each: [userMsg, assistantMsg] } },
      $set: { updated_at: now, user_id: userId || thread.user_id || null },
    }
  );

  const updated = await col.findOne({ _id: thread._id });
  return { reply, messages: updated?.messages || [...history, userMsg, assistantMsg] };
}
