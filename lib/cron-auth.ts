import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqualString } from "./token-hash";

/**
 * Guards cron HTTP endpoints.
 * - Development: open if CRON_SECRET is unset (local testing).
 * - Production: CRON_SECRET is required; Bearer token must match.
 * Returns a 401/503 response when unauthorized, or null when allowed.
 */
export function assertCronAuthorized(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  const authHeader = (req.headers.get("authorization") || "").trim();

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "CRON_SECRET is not set; rejecting cron request in production. " +
          "Set CRON_SECRET in Railway and pass Authorization: Bearer <secret>."
      );
      return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
    }
    return null;
  }

  const expected = `Bearer ${secret}`;
  if (!timingSafeEqualString(authHeader, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
