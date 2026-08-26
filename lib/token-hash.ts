import { createHash, timingSafeEqual } from "crypto";

/** SHA-256 hex of a secret token so DB copies are not reusable as-is. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Values to match against a token column during the plaintext → hash migration.
 * New writes store only the hash; old rows may still hold the raw token.
 */
export function tokenLookupValues(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  return [hashToken(trimmed), trimmed];
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}
