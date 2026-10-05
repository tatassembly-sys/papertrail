import type { NextRequest } from "next/server";
import { createHash } from "crypto";

function looksLikeIp(value: string): boolean {
  if (!value || value.length > 64) return false;
  if (/[\s,;]/.test(value)) return false;
  return /^[0-9a-fA-F.:%]+$/.test(value);
}

/**
 * Client IP behind a reverse proxy.
 *
 * X-Real-IP and CF-Connecting-IP are client-settable unless the edge
 * overwrites them. Railway (and most proxies) append the observed address as
 * the last X-Forwarded-For hop; the first hop is attacker-controlled.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && looksLikeIp(last)) return last;
  }

  return "unknown";
}

/** One-way IP fingerprint for rate limiting without storing raw addresses. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip || "unknown").digest("hex");
}
