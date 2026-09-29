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
