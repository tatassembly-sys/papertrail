import type { ArticleRow } from "@/lib/prompts";
import { getSiteUrl as resolveSiteUrl } from "@/lib/site-url";

export interface SocialPostResult {
  platform: string;
  success: boolean;
  error?: string;
  postUrl?: string;
}

export type Platform = "facebook" | "instagram" | "reddit" | "x";

/** Builds a consistent caption/body across platforms. */
export function buildCaption(article: ArticleRow, siteUrl: string): string {
  const link = `${siteUrl}/posts/${article.slug}`;
  return `${article.headline}\n\n${link}`;
}

/** @see lib/site-url.ts — Railway-aware public origin resolution. */
export function getSiteUrl(): string {
  return resolveSiteUrl();
}
