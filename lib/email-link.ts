import { tokenLookupValues } from "./token-hash";

/** Account and newsletter confirmation links. */
export const VERIFY_LINK_TTL_MS = 48 * 60 * 60 * 1000;

/** Unsubscribe links travel in the digest, then die. */
export const UNSUBSCRIBE_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface EmailLink {
  tokenHash: string | null;
  expiresAt: Date | null;
}

export type EmailLinkFailure = "missing" | "mismatch" | "expired";

export function emailLinkExpiry(now: Date, ttlMs: number): Date {
  return new Date(now.getTime() + ttlMs);
}

/**
 * A link is valid once. The caller stores `next`, which has no token,
 * so a second presentation fails.
 */
export function consumeEmailLink(
  link: EmailLink | null | undefined,
  rawToken: string,
  now: Date
):
  | { ok: true; next: { tokenHash: null; expiresAt: null } }
  | { ok: false; reason: EmailLinkFailure } {
  if (!link?.tokenHash || !(link.expiresAt instanceof Date) || Number.isNaN(link.expiresAt.getTime())) {
    return { ok: false, reason: "missing" };
  }
  const candidates = tokenLookupValues(rawToken);
  if (!candidates.includes(link.tokenHash)) return { ok: false, reason: "mismatch" };
  if (link.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  return { ok: true, next: { tokenHash: null, expiresAt: null } };
}
