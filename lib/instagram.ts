import type { ArticleRow } from "@/lib/prompts";
import { buildCaption, getSiteUrl, type SocialPostResult } from "@/types/types";

const GRAPH_API_VERSION = "v21.0"; // check developers.facebook.com/docs/graph-api/changelog for the current version

async function waitForContainerReady(containerId: string, accessToken: string): Promise<void> {
  // Container processing is usually near-instant for a single image, but
  // Meta recommends checking status_code before publishing rather than
  // assuming it's ready immediately.
  for (let i = 0; i < 5; i++) {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const data = await res.json();
    if (data?.status_code === "FINISHED") return;
    if (data?.status_code === "ERROR") {
      throw new Error("Instagram media container failed to process.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

export async function postToInstagram(article: ArticleRow): Promise<SocialPostResult> {
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!igUserId || !accessToken) {
    return {
      platform: "instagram",
      success: false,
      error: "INSTAGRAM_BUSINESS_ACCOUNT_ID / INSTAGRAM_ACCESS_TOKEN not configured.",
    };
  }

  const siteUrl = getSiteUrl();
  // Instagram captions can't contain a clickable link, but we still include
  // the URL as text — common practice is "link in bio", but showing it here
  // costs nothing and helps anyone who copies it manually.
  const caption = buildCaption(article, siteUrl);
  const imageUrl = `${siteUrl}/posts/${article.slug}/opengraph-image`;

  try {
    const containerRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${igUserId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          caption,
          access_token: accessToken,
        }),
      }
    );

    const containerData = await containerRes.json();

    if (!containerRes.ok || !containerData?.id) {
      return {
        platform: "instagram",
        success: false,
        error: containerData?.error?.message || `Instagram container creation failed (${containerRes.status})`,
      };
    }

    await waitForContainerReady(containerData.id, accessToken);

    const publishRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${igUserId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: accessToken,
        }),
      }
    );

    const publishData = await publishRes.json();

    if (!publishRes.ok) {
      return {
        platform: "instagram",
        success: false,
        error: publishData?.error?.message || `Instagram publish failed (${publishRes.status})`,
      };
    }

    return { platform: "instagram", success: true, postUrl: undefined };
  } catch (err) {
    return {
      platform: "instagram",
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
