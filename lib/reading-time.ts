import type { ArticleRow } from "./prompts";

const WPM = 220;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function articleWordCount(article: Pick<
  ArticleRow,
  "title" | "headline" | "why_it_matters" | "plain_explanation" | "caveats"
>): number {
  const body = [
    article.title,
    article.headline,
    ...(article.why_it_matters || []),
    article.plain_explanation,
    article.caveats,
  ]
    .filter(Boolean)
    .join(" ");
  return wordCount(body);
}

export function readingMinutes(article: Pick<
  ArticleRow,
  "title" | "headline" | "why_it_matters" | "plain_explanation" | "caveats"
>): number {
  return Math.max(1, Math.round(articleWordCount(article) / WPM));
}

export function readingTimeLabel(minutes: number): string {
  return minutes === 1 ? "1 min read" : `${minutes} min read`;
}
