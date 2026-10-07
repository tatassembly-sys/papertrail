import type { Metadata } from "next";

type PostMetaSource = {
  slug: string;
  title: string;
  headline: string;
};

/** Metadata for a published note. A missing note must not call notFound() here. */
export function postPageMetadata(article: PostMetaSource | null, siteUrl: string): Metadata {
  if (!article) {
    return {
      title: "Not on file",
      robots: { index: false, follow: false },
    };
  }

  const url = `${siteUrl.replace(/\/$/, "")}/posts/${article.slug}`;
  return {
    title: article.title,
    description: article.headline,
    alternates: { canonical: url },
    openGraph: {
      title: article.title,
      description: article.headline,
      type: "article",
      url,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.headline,
    },
  };
}
