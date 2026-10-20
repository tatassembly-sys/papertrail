/** URL slugs for author names and topic labels. */

export function slugifyLabel(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "item";
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Turn `jane-smith` into a name-ish regex: jane[separators]smith */
export function slugToLooseRegex(slug: string): RegExp {
  const parts = slug
    .split("-")
    .map((p) => p.trim())
    .filter(Boolean)
    .map(escapeRegex);
  const source = parts.join("[\\s.,\\-'’]+");
  return new RegExp(source, "i");
}

export function labelMatchesSlug(label: string, slug: string): boolean {
  return slugifyLabel(label) === slug;
}

/** Decode a route param. Rejects empty, over-long, and path-like values. */
export function decodePublicSlug(slug: string): string | null {
  if (!slug || typeof slug !== "string") return null;
  const trimmed = slug.trim();
  if (!trimmed || trimmed.length > 200 || trimmed.includes("/") || trimmed.includes("\\")) {
    return null;
  }
  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return null;
  }
  decoded = decoded.trim();
  if (!decoded || decoded.length > 200 || decoded.includes("/") || decoded.includes("\\")) {
    return null;
  }
  return decoded;
}

/**
 * Whole-label regex for a public slug. `sleep` does not match `sleeping`,
 * and `machine-learning` matches `Machine Learning`.
 */
export function anchoredSlugRegex(slug: string): RegExp | null {
  const decoded = decodePublicSlug(slug);
  if (!decoded) return null;
  const parts = decoded
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(escapeRegex);
  if (parts.length === 0) return null;
  return new RegExp(`^${parts.join("[\\s.,\\-'’]+")}$`, "i");
}

/** The published label for this slug, or null when nothing on file matches. */
export function matchPublishedLabel(slug: string, labels: readonly string[]): string | null {
  const decoded = decodePublicSlug(slug);
  if (!decoded) return null;
  for (const label of labels) {
    if (typeof label !== "string") continue;
    const trimmed = label.trim();
    if (!trimmed) continue;
    if (trimmed === decoded || labelMatchesSlug(trimmed, decoded)) return trimmed;
  }
  return null;
}
