import type { ArticleRow } from "@/lib/prompts";
import { buildCaption, getSiteUrl, type SocialPostResult } from "@/types/types";

const GRAPH_API_VERSION = "v21.0"; // check developers.facebook.com/docs/graph-api/changelog for the current version

export async function postToFacebook(article: ArticleRow): Promise<SocialPostResult> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    return {
      platform: "facebook",
      success: false,
      error: "FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN not configured.",
    };
  }

  const siteUrl = getSiteUrl();
  const link = `${siteUrl}/posts/${article.slug}`;
  const message = buildCaption(article, siteUrl);

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/feed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          link,
          access_token: accessToken,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return {
        platform: "facebook",
        success: false,
        error: data?.error?.message || `Facebook API error (${res.status})`,
      };
    }

    return {
      platform: "facebook",
      success: true,
      postUrl: data?.id ? `https://www.facebook.com/${data.id}` : undefined,
    };
  } catch (err) {
    return {
      platform: "facebook",
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
