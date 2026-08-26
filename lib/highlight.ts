/**
 * Escape HTML then wrap case-insensitive matches of query tokens in <mark>.
 * Safe for React via dangerouslySetInnerHTML only after this function.
 */
export function highlightMatches(text: string, query: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const tokens = query
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .filter((t) => t.length > 1);

  if (tokens.length === 0) return escaped;

  const re = new RegExp(`(${tokens.join("|")})`, "gi");
  return escaped.replace(re, "<mark class=\"bg-redpen-soft text-ink px-0.5 rounded-sm\">$1</mark>");
}
