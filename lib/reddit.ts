import type { ArticleRow } from "@/lib/prompts";
import { getSiteUrl, type SocialPostResult } from "@/types/types";

async function getRedditAccessToken(): Promise<string> {
  const clientId = process.env.REDDIT_CLIENT_ID!;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET!;
  const username = process.env.REDDIT_USERNAME!;
  const password = process.env.REDDIT_PASSWORD!;
  const userAgent = process.env.REDDIT_USER_AGENT || "paper-trail/1.0";

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
    },
    body: new URLSearchParams({
      grant_type: "password",
      username,
      password,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data?.error || `Reddit auth failed (${res.status})`);
  }
  return data.access_token;
}

export async function postToReddit(article: ArticleRow): Promise<SocialPostResult> {
  const subreddit = process.env.REDDIT_SUBREDDIT;
  const userAgent = process.env.REDDIT_USER_AGENT || "paper-trail/1.0";

  if (
    !process.env.REDDIT_CLIENT_ID ||
    !process.env.REDDIT_CLIENT_SECRET ||
    !process.env.REDDIT_USERNAME ||
    !process.env.REDDIT_PASSWORD ||
    !subreddit
  ) {
    return {
      platform: "reddit",
      success: false,
      error: "Reddit env vars not fully configured (see SETUP.md).",
    };
  }

  const siteUrl = getSiteUrl();
  const link = `${siteUrl}/posts/${article.slug}`;

  try {
    const accessToken = await getRedditAccessToken();

    const res = await fetch("https://oauth.reddit.com/api/submit", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": userAgent,
      },
      body: new URLSearchParams({
        sr: subreddit,
        kind: "link",
        title: article.title,
        url: link,
        api_type: "json",
      }),
    });

    const data = await res.json();
    const errors = data?.json?.errors;

    if (!res.ok || (errors && errors.length > 0)) {
      return {
        platform: "reddit",
        success: false,
        error: errors?.[0]?.[1] || `Reddit submit failed (${res.status})`,
      };
    }

    return {
      platform: "reddit",
      success: true,
      postUrl: data?.json?.data?.url,
    };
  } catch (err) {
    return {
      platform: "reddit",
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
