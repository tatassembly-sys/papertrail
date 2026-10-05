import { createHash, timingSafeEqual } from "crypto";

/** SHA-256 hex of a secret token so DB copies are not reusable as-is. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Lookup values for hashed token columns. The stored SHA-256 is not a valid
 * bearer — submitting it hashes again and misses.
 */
export function tokenLookupValues(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  return [hashToken(trimmed)];
}

/**
 * Digest emails used to carry the stored hash. Accept that hash as well as
 * sha256(raw) until those links age out.
 */
export function tokenLookupValuesAllowStored(raw: string): string[] {
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
