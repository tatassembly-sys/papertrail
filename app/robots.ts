import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

// Resolve origin at request time so Railway domain / env changes apply.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/login",
        "/user-login",
        "/register",
        "/account",
        "/library",
        "/welcome",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
        "/api",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
