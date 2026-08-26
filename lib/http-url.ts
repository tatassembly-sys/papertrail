const MAX_URL_LENGTH = 500;

/** http(s) URLs only — rejects javascript:, data:, and credentialed URLs. */
export function sanitizeHttpUrl(
  value: string | null | undefined,
  maxLen = MAX_URL_LENGTH
): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLen) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function isSafeHttpUrl(value: string | null | undefined): boolean {
  return sanitizeHttpUrl(value) !== null;
}
