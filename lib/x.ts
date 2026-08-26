import { TwitterApi } from "twitter-api-v2";
import type { ArticleRow } from "@/lib/prompts";
import { buildCaption, getSiteUrl, type SocialPostResult } from "@/types/types";

/**
 * Uses the official X API v2 (OAuth 1.0a user context) to post directly.
 * As of the Feb 2026 pricing change, X has no free tier — posts cost
 * roughly $0.015–0.02 each, plus $0.20 extra for any post containing a
 * link (which every article post does). This path is only used if
 * ENABLE_X_API_POSTING=true is explicitly set; otherwise use the free
 * share-intent link instead (see share-links.ts).
 */
export async function postToX(article: ArticleRow): Promise<SocialPostResult> {
  if (process.env.ENABLE_X_API_POSTING !== "true") {
    return {
      platform: "x",
      success: false,
      error:
        "X API posting is disabled (costs ~$0.20/post with a link as of 2026 pricing). Use the free share-intent button instead, or set ENABLE_X_API_POSTING=true to enable this.",
    };
  }

  const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;

  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
    return { platform: "x", success: false, error: "X API credentials not configured." };
  }

  const siteUrl = getSiteUrl();
  const text = buildCaption(article, siteUrl).slice(0, 280);

  try {
    const client = new TwitterApi({
      appKey: X_API_KEY,
      appSecret: X_API_SECRET,
      accessToken: X_ACCESS_TOKEN,
      accessSecret: X_ACCESS_SECRET,
    });

    const { data } = await client.v2.tweet(text);

    return {
      platform: "x",
      success: true,
      postUrl: `https://x.com/i/web/status/${data.id}`,
    };
  } catch (err) {
    return {
      platform: "x",
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
