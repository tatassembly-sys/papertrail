import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/origin";
import { MISSING_POST_HTML } from "@/lib/post-probe";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const missingPost = await missingPublishedPost(request);
  if (missingPost) return missingPost;

  if (pathname.startsWith("/api/")) {
    // One-click unsubscribe is a cross-site POST. The unguessable token is the capability.
    if (request.method === "POST" && pathname === "/api/newsletter/unsubscribe") {
      return NextResponse.next();
    }
    const denied = assertSameOrigin(request);
    if (denied) return denied;
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isValid = await verifySessionToken(token);

  if (!isValid) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

async function missingPublishedPost(request: NextRequest): Promise<NextResponse | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const match = request.nextUrl.pathname.match(/^\/posts\/([^/]+)$/);
  if (!match) return null;

  const probe = new URL("/api/posts/published", request.url);
  probe.searchParams.set("slug", match[1]);
  try {
    const res = await fetch(probe, { cache: "no-store" });
    if (res.status !== 404) return null;
  } catch {
    return null;
  }

  return new NextResponse(request.method === "HEAD" ? null : MISSING_POST_HTML, {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/:path*", "/posts/:slug"],
};
