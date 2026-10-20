/**
 * JSON-LD inside <script> must not contain a literal `</script>`.
 * JSON.stringify does not escape `<`, so user-controlled names (public lists)
 * could close the tag. `\u003c` is valid JSON and inert in HTML.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export interface PostJsonLdInput {
  siteUrl: string;
  title: string;
  headline: string;
  canonical: string;
  datePublished: string | Date | null;
  authors: string[];
  keywords: string[];
  sourceUrl?: string | null;
  licence?: string | null;
  topic?: { name: string; path: string } | null;
}

function iso(value: string | Date | null): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

/** ScholarlyArticle plus a BreadcrumbList for one published note. */
export function postStructuredData(input: PostJsonLdInput) {
  const site = input.siteUrl.replace(/\/$/, "");
  const crumbs: { name: string; item: string }[] = [
    { name: "Home", item: `${site}/` },
  ];
  if (input.topic?.name && input.topic.path) {
    crumbs.push({ name: input.topic.name, item: `${site}${input.topic.path}` });
  }
  crumbs.push({ name: input.title, item: input.canonical });

  const licence =
    input.licence && /^https?:\/\//i.test(input.licence) ? input.licence : undefined;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ScholarlyArticle",
        headline: input.title,
        description: input.headline,
        url: input.canonical,
        datePublished: iso(input.datePublished),
        author: input.authors.map((name) => ({ "@type": "Person", name })),
        keywords: input.keywords.join(", "),
        isBasedOn: input.sourceUrl || undefined,
        license: licence,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((crumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.name,
          item: crumb.item,
        })),
      },
    ],
  };
}
