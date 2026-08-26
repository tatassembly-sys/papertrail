/** Same-origin relative paths only. Blocks `//host`, `/\host`, and schemes. */
export function safeRelativePath(
  value: string | null | undefined,
  fallback: string
): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.includes("\\") || value.includes("://")) return fallback;
  if (!/^\/[A-Za-z0-9/_-]*$/.test(value)) return fallback;
  return value;
}
