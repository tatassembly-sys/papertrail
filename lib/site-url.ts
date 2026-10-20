/**
 * Canonical public origin for sitemap, RSS, OG metadata, and share links.
 *
 * Resolution order:
 * 1. NEXT_PUBLIC_SITE_URL (explicit, preferred)
 * 2. VERCEL_PROJECT_PRODUCTION_URL
 * 3. VERCEL_URL (this deployment)
 * 4. RAILWAY_PUBLIC_DOMAIN (legacy, last resort)
 * 5. RAILWAY_STATIC_URL (legacy, last resort)
 * 6. localhost (local dev only)
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return stripTrailingSlash(explicit);

  const vercelProduction = httpsOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercelProduction) return vercelProduction;

  const vercelUrl = httpsOrigin(process.env.VERCEL_URL);
  if (vercelUrl) return vercelUrl;

  const railwayDomain = httpsOrigin(process.env.RAILWAY_PUBLIC_DOMAIN);
  if (railwayDomain) return railwayDomain;

  const railwayStatic = httpsOrigin(process.env.RAILWAY_STATIC_URL);
  if (railwayStatic) return railwayStatic;

  return "http://localhost:3000";
}

function httpsOrigin(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return stripTrailingSlash(raw);
  return `https://${raw.replace(/\/$/, "")}`;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}
