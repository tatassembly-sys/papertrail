import { ObjectId } from "mongodb";
import { randomBytes } from "crypto";
import { getDb } from "./mongodb";
import { hashToken, tokenLookupValues, tokenLookupValuesAllowStored } from "./token-hash";
import {
  getAllPublishedArticles,
  getEditorPicks,
  getForYouArticles,
  getTrendingArticles,
} from "./articles";
import { findUserByEmail } from "./users";
import { getSiteUrl } from "./site-url";
import { sendEmail, isEmailConfigured } from "./mail";
import { openRouterChat } from "./openrouter";
import type { ArticleRow } from "./prompts";

export interface SubscriberDoc {
  _id: ObjectId;
  email: string;
  status: "pending" | "active" | "unsubscribed";
  verify_token?: string | null;
  unsubscribe_token: string;
  created_at: Date;
  verified_at?: Date | null;
  unsubscribed_at?: Date | null;
}

export interface WeeklyDigest {
  subject: string;
  html: string;
  text: string;
  articleCount: number;
  sections: {
    newest: ArticleRow[];
    trending: ArticleRow[];
    editorPicks: ArticleRow[];
    aiSummary: string;
  };
}

async function subs() {
  const db = await getDb();
  return db.collection<SubscriberDoc>("newsletter_subscribers");
}

function token(): string {
  return randomBytes(24).toString("hex");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function subscribeEmail(
  email: string
): Promise<
  | { ok: true; verifyToken: string; verifyUrl: string; emailSent: boolean }
  | { ok: false; error: string }
> {
  const normalized = email.trim().toLowerCase();
  if (!isValidEmail(normalized)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const col = await subs();
  const existing = await col.findOne({ email: normalized });
  if (existing?.status === "active") {
    // Same shape as a new signup so this endpoint cannot be used to probe who is on the list.
    return { ok: true, verifyToken: "", verifyUrl: "", emailSent: true };
  }

  const verifyToken = token();
  const rawUnsubscribe = token();
  const unsubscribeToken = hashToken(rawUnsubscribe);
  const emailReady = isEmailConfigured();
  if (!emailReady && process.env.NODE_ENV === "production") {
    return { ok: false, error: "Email delivery is not configured. Try again later." };
  }
  const status: SubscriberDoc["status"] = emailReady ? "pending" : "active";

  if (existing) {
    await col.updateOne(
      { _id: existing._id },
      {
        $set: {
          status,
          verify_token: emailReady ? hashToken(verifyToken) : null,
          unsubscribe_token: unsubscribeToken,
          verified_at: emailReady ? existing.verified_at || null : new Date(),
          unsubscribed_at: null,
        },
      }
    );
  } else {
    await col.insertOne({
      email: normalized,
      status,
      verify_token: emailReady ? hashToken(verifyToken) : null,
      unsubscribe_token: unsubscribeToken,
      created_at: new Date(),
      verified_at: emailReady ? null : new Date(),
      unsubscribed_at: null,
    } as SubscriberDoc);
  }

  const site = getSiteUrl();
  const verifyUrl = `${site}/newsletter/confirm?token=${verifyToken}`;
  const unsubUrl = `${site}/newsletter/unsubscribe?token=${rawUnsubscribe}`;
  const oneClickUrl = `${site}/api/newsletter/unsubscribe?token=${rawUnsubscribe}`;

  if (!emailReady) {
    return {
      ok: true,
      verifyToken: "",
      verifyUrl: "",
      emailSent: false,
    };
  }

  const mail = await sendEmail({
    to: normalized,
    subject: "Confirm your Paper Trail newsletter subscription",
    html: verificationEmailHtml(verifyUrl, unsubUrl),
    text: `Confirm your Paper Trail subscription:\n${verifyUrl}\n\nUnsubscribe: ${unsubUrl}\n\nIf you didn't request this, ignore this email.`,
    listUnsubscribe: oneClickUrl,
  });

  return {
    ok: true,
    verifyToken,
    verifyUrl,
    emailSent: mail.ok && mail.mode === "resend",
  };
}

export async function confirmSubscription(verifyToken: string): Promise<boolean> {
  const candidates = tokenLookupValues(verifyToken);
  if (candidates.length === 0) return false;
  const col = await subs();
  const result = await col.updateOne(
    { verify_token: { $in: candidates } },
    {
      $set: {
        status: "active",
        verify_token: null,
        verified_at: new Date(),
        unsubscribed_at: null,
      },
    }
  );
  return result.modifiedCount > 0;
}

export async function unsubscribeByEmail(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  const col = await subs();
  await col.updateOne(
    { email: normalized, status: { $ne: "unsubscribed" } },
    {
      $set: {
        status: "unsubscribed",
        unsubscribed_at: new Date(),
        verify_token: null,
      },
    }
  );
}

export async function unsubscribeByToken(tokenStr: string): Promise<boolean> {
  const candidates = tokenLookupValuesAllowStored(tokenStr);
  if (candidates.length === 0) return false;
  const col = await subs();
  const result = await col.updateOne(
    { unsubscribe_token: { $in: candidates } },
    {
      $set: {
        status: "unsubscribed",
        unsubscribed_at: new Date(),
      },
    }
  );
  return result.modifiedCount > 0;
}

export async function listActiveSubscribers(limit = 500): Promise<SubscriberDoc[]> {
  const col = await subs();
  const cap = Math.min(500, Math.max(1, limit));
  return col.find({ status: "active" }).sort({ created_at: -1 }).limit(cap).toArray();
}

async function generateAiWeeklySummary(articles: ArticleRow[]): Promise<string> {
  if (articles.length === 0) {
    return "No new translations this week — check back soon for fresh research notes.";
  }

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const fallback = `This week on Paper Trail: ${articles.length} plain-language research note${articles.length === 1 ? "" : "s"}. Highlights include “${articles[0].title}”.`;

  if (!apiKey) return fallback;

  const bulletList = articles
    .slice(0, 8)
    .map((a, i) => `${i + 1}. ${a.title} — ${a.headline}`)
    .join("\n");

  try {
    const { content: text } = await openRouterChat({
      title: "Paper Trail Newsletter",
      temperature: 0.4,
      maxTokens: 350,
      maxAttempts: 4,
      messages: [
        {
          role: "system",
          content:
            "You write a short weekly research newsletter intro (2–4 sentences) for curious non-specialists. Be warm, accurate, non-hype. No bullet lists. No markdown.",
        },
        {
          role: "user",
          content: `Write this week's Paper Trail intro summarizing these published notes:\n\n${bulletList}`,
        },
      ],
    });
    return text && text.length > 40 ? text : fallback;
  } catch (err) {
    console.warn("[newsletter] AI summary error", err);
    return fallback;
  }
}

/** Builds weekly digest: newest, trending, editor picks, AI summary. */
export async function buildWeeklyDigest(): Promise<WeeklyDigest> {
  const site = getSiteUrl();
  const [newest, trending, picks] = await Promise.all([
    getAllPublishedArticles(5),
    getTrendingArticles(3),
    getEditorPicks(3),
  ]);

  const aiSummary = await generateAiWeeklySummary(newest);

  const listHtml = (
    title: string,
    items: ArticleRow[]
  ) => {
    if (!items.length) {
      return `<h2 style="font-size:16px;margin:24px 0 8px;color:#16213D">${title}</h2><p style="color:#4A5568">None this week.</p>`;
    }
    const rows = items
      .map((a) => {
        const href = `${site}/posts/${a.slug}`;
        return `<tr>
          <td style="padding:12px 0;border-bottom:1px solid #C7CCD1">
            <a href="${href}" style="color:#16213D;font-weight:600;text-decoration:none;font-size:16px">${escapeHtml(a.title)}</a>
            <div style="color:#4A5568;font-size:14px;margin-top:4px;line-height:1.45">${escapeHtml(a.headline)}</div>
          </td>
        </tr>`;
      })
      .join("");
    return `<h2 style="font-size:16px;margin:28px 0 4px;color:#16213D;font-family:Georgia,serif">${title}</h2>
      <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#EEF0F2;font-family:system-ui,-apple-system,sans-serif;color:#16213D">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#EEF0F2;padding:24px 12px">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border:1px solid #C7CCD1;padding:28px 24px">
        <tr><td>
          <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#5B6B73;font-family:ui-monospace,monospace">Paper Trail · Weekly</div>
          <h1 style="font-family:Georgia,serif;font-weight:500;font-size:28px;margin:8px 0 16px;color:#16213D">This week in research, translated</h1>
          <p style="font-size:16px;line-height:1.55;color:#16213D;margin:0 0 8px">${escapeHtml(aiSummary)}</p>
          ${listHtml("Newest papers", newest)}
          {{FORYOU}}
          ${listHtml("Trending", trending)}
          ${listHtml("Editor picks", picks)}
          <p style="font-size:12px;color:#5B6B73;margin-top:32px;line-height:1.5">
            You’re receiving this because you subscribed at
            <a href="${site}" style="color:#C63D2F">${escapeHtml(site)}</a>.
            {{UNSUBSCRIBE}}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    "Paper Trail Weekly",
    "",
    aiSummary,
    "",
    "Newest papers:",
    ...newest.map((a) => `- ${a.title}: ${site}/posts/${a.slug}`),
    "",
    "Trending:",
    ...trending.map((a) => `- ${a.title}: ${site}/posts/${a.slug}`),
    "",
    "Editor picks:",
    ...picks.map((a) => `- ${a.title}: ${site}/posts/${a.slug}`),
  ].join("\n");

  return {
    subject: `Paper Trail Weekly · ${newest.length} new note${newest.length === 1 ? "" : "s"}`,
    html,
    text,
    articleCount: newest.length,
    sections: { newest, trending, editorPicks: picks, aiSummary },
  };
}

export async function sendWeeklyDigest(): Promise<{
  subscribers: number;
  sent: number;
  failed: number;
  logged: number;
  mode: "log" | "resend";
  articleCount: number;
}> {
  const digest = await buildWeeklyDigest();
  const subscribers = await listActiveSubscribers(500);
  const site = getSiteUrl();
  const col = await subs();
  let sent = 0;
  let failed = 0;
  let logged = 0;
  let mode: "log" | "resend" = isEmailConfigured() ? "resend" : "log";

  const forYouCache = new Map<string, Awaited<ReturnType<typeof getForYouArticles>>>();

  for (const sub of subscribers) {
    const rawUnsub = token();
    const unsubUrl = `${site}/newsletter/unsubscribe?token=${rawUnsub}`;
    let extraHtml = "";
    let extraText = "";
    try {
      const account = await findUserByEmail(sub.email);
      const topics = account?.followed_topics || [];
      if (topics.length) {
        const cacheKey = topics.map((t) => t.toLowerCase()).sort().join("|");
        let forYou = forYouCache.get(cacheKey);
        if (!forYou) {
          forYou = await getForYouArticles(topics, 4);
          forYouCache.set(cacheKey, forYou);
        }
        const newestSlugs = new Set(digest.sections.newest.map((a) => a.slug));
        const unique = forYou.filter((a) => !newestSlugs.has(a.slug));
        if (unique.length) {
          extraHtml = `<h2 style="font-size:16px;margin:28px 0 4px;color:#16213D;font-family:Georgia,serif">For you</h2>
            <table width="100%" cellpadding="0" cellspacing="0">${unique
              .map((a) => {
                const href = `${site}/posts/${a.slug}`;
                return `<tr><td style="padding:12px 0;border-bottom:1px solid #C7CCD1">
                  <a href="${href}" style="color:#16213D;font-weight:600;text-decoration:none;font-size:16px">${escapeHtml(a.title)}</a>
                  <div style="color:#4A5568;font-size:14px;margin-top:4px;line-height:1.45">${escapeHtml(a.headline)}</div>
                </td></tr>`;
              })
              .join("")}</table>`;
          extraText =
            "\n\nFor you:\n" + unique.map((a) => `- ${a.title}: ${site}/posts/${a.slug}`).join("\n");
        }
      }
    } catch (err) {
      console.warn("[newsletter] for-you lookup failed", err);
    }

    const html = digest.html
      .replace("{{FORYOU}}", extraHtml)
      .replace(
        "{{UNSUBSCRIBE}}",
        `<a href="${unsubUrl}" style="color:#C63D2F">Unsubscribe</a>`
      );
    const text =
      digest.text + extraText + `\n\nUnsubscribe: ${unsubUrl}`;

    const result = await sendEmail({
      to: sub.email,
      subject: digest.subject,
      html,
      text,
      listUnsubscribe: `${site}/api/newsletter/unsubscribe?token=${rawUnsub}`,
    });

    if (result.ok && result.mode === "resend") {
      await col.updateOne(
        { _id: sub._id },
        { $set: { unsubscribe_token: hashToken(rawUnsub) } }
      );
    }
    if (result.mode === "log") {
      mode = "log";
      if (result.ok) logged++;
      else failed++;
      continue;
    }
    if (result.ok) sent++;
    else failed++;
  }

  // No active subscribers: still record a dry-run digest for ops
  if (subscribers.length === 0) {
    console.log("[newsletter] digest built with 0 active subscribers", {
      subject: digest.subject,
      articleCount: digest.articleCount,
      aiSummary: digest.sections.aiSummary.slice(0, 120),
    });
  }

  const db = await getDb();
  await db.collection("newsletter_runs").insertOne({
    at: new Date(),
    mode,
    subscribers: subscribers.length,
    sent,
    failed,
    logged,
    subject: digest.subject,
    articleCount: digest.articleCount,
    aiSummary: digest.sections.aiSummary,
  });

  return {
    subscribers: subscribers.length,
    sent,
    failed,
    logged,
    mode,
    articleCount: digest.articleCount,
  };
}

function verificationEmailHtml(verifyUrl: string, unsubUrl: string): string {
  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;color:#16213D;padding:24px;background:#EEF0F2">
  <table width="100%" style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #C7CCD1;padding:24px">
    <tr><td>
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#5B6B73">Paper Trail</div>
      <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:500">Confirm your subscription</h1>
      <p style="line-height:1.5">Thanks for signing up for the weekly research digest. Click below to verify your email:</p>
      <p style="margin:24px 0"><a href="${verifyUrl}" style="background:#16213D;color:#EEF0F2;padding:12px 18px;text-decoration:none;border-radius:2px;display:inline-block">Confirm email</a></p>
      <p style="font-size:12px;color:#5B6B73;line-height:1.4">Or paste this link into your browser:<br/>${escapeHtml(verifyUrl)}</p>
      <p style="font-size:12px;color:#5B6B73">If you didn’t request this, you can ignore this message.</p>
      <p style="font-size:12px;color:#5B6B73">Paper Trail is an independent editorial project. <a href="${escapeHtml(unsubUrl)}" style="color:#C63D2F">Unsubscribe</a>.</p>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
