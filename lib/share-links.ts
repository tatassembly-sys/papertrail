import type { ArticleRow } from "@/lib/prompts";

/**
 * Pre-filled "share" URLs — opening these lets the person post with one
 * more click, at zero cost and zero setup. This is the recommended path
 * for X given the 2026 API pricing; it's also a good fallback for
 * Facebook/Reddit if you'd rather not wire up API credentials at all.
 */
export function buildShareLinks(article: ArticleRow, siteUrl: string) {
  const link = `${siteUrl}/posts/${article.slug}`;
  const text = article.headline;

  return {
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
    reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(link)}&title=${encodeURIComponent(article.title)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`,
    hackernews: `https://news.ycombinator.com/submitlink?u=${encodeURIComponent(link)}&t=${encodeURIComponent(article.title)}`,
  };
}
