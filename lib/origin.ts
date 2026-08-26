import { NextRequest, NextResponse } from "next/server";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Extra CSRF layer on cookie-authenticated APIs.
 * Bearer cron calls and same-origin browsers (no/matching Origin) pass.
 * Cross-site XHR that sends an Origin is rejected.
 */
export function assertSameOrigin(req: NextRequest): NextResponse | null {
  if (!MUTATING.has(req.method)) return null;

  const authorization = req.headers.get("authorization") || "";
  if (authorization.toLowerCase().startsWith("bearer ")) return null;

  const origin = req.headers.get("origin");
  if (!origin) return null;

  try {
    const host = req.headers.get("host") || "";
    if (host && new URL(origin).host === host) return null;
  } catch {
    /* invalid Origin */
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
