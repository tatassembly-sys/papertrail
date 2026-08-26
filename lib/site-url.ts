/**
 * Canonical public origin for sitemap, RSS, OG metadata, and share links.
 *
 * Resolution order:
 * 1. NEXT_PUBLIC_SITE_URL (explicit, preferred)
 * 2. RAILWAY_PUBLIC_DOMAIN (auto on Railway after a domain is assigned)
 * 3. RAILWAY_STATIC_URL (some Railway setups)
 * 4. localhost (local dev only)
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return stripTrailingSlash(explicit);

  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railwayDomain) {
    const host = railwayDomain.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    return `https://${host}`;
  }

  const railwayStatic = process.env.RAILWAY_STATIC_URL?.trim();
  if (railwayStatic) return stripTrailingSlash(railwayStatic);

  return "http://localhost:3000";
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}
