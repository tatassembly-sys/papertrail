import type { NextRequest } from "next/server";
import { createHash } from "crypto";

function looksLikeIp(value: string): boolean {
  if (!value || value.length > 64) return false;
  if (/[\s,;]/.test(value)) return false;
  return /^[0-9a-fA-F.:%]+$/.test(value);
}

/**
 * Client IP behind Railway / reverse proxies.
 *
 * The first X-Forwarded-For hop is attacker-controlled (the client can send
 * the header; the proxy appends). Prefer x-real-ip / cf-connecting-ip, then
 * the *last* XFF hop — the address the reverse proxy actually observed.
 */
export function getClientIp(req: NextRequest): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real && looksLikeIp(real)) return real;

  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf && looksLikeIp(cf)) return cf;

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
