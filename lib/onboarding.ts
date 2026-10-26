/** M9.2 onboarding helpers (pure, unit-tested). */
export const READ_KEY = "pt-read-slugs";
export const CTA_DISMISS_KEY = "pt-newsletter-cta-dismissed";
export const CTA_AFTER_ARTICLES = 2;

/** Add a slug to the read list (distinct, newest last, capped). */
export function rememberRead(prev: string[], slug: string, cap = 50): string[] {
  const next = prev.filter((s) => s !== slug);
  next.push(slug);
  return next.slice(-cap);
}

/** Show the newsletter prompt from the 2nd distinct article on, unless dismissed or subscribed. */
export function shouldShowNewsletterCta(readSlugs: string[], dismissed: boolean): boolean {
  return !dismissed && new Set(readSlugs).size >= CTA_AFTER_ARTICLES;
}

/** Parse a stored JSON string array safely. */
export function parseSlugList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string").slice(-50) : [];
  } catch {
    return [];
  }
}

/** Put mix items on followed topics first (stable), and mark them. */
export function personaliseMix<T extends { category?: string | null; tags?: string[]; keywords?: string[] }>(
  items: T[],
  followed: string[]
): { item: T; forYou: boolean }[] {
  const topics = followed.map((t) => t.trim().toLowerCase()).filter(Boolean);
  const marked = items.map((item) => {
    const hay = [item.category || "", ...(item.tags || []), ...(item.keywords || [])].map((x) => x.toLowerCase());
    return { item, forYou: topics.length > 0 && topics.some((t) => hay.some((h) => h.includes(t))) };
  });
  return [...marked.filter((m) => m.forYou), ...marked.filter((m) => !m.forYou)];
}
