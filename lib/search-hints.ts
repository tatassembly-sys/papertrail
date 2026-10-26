/** Shown when a typed search has no suggestions (M9.5). */
export const SEARCH_HINTS = ["tech", "space", "health", "math", "climate", "biology"] as const;

/** Up to `max` hint queries that differ from what was typed. */
export function emptyStateHints(query: string, max = 4): string[] {
  const q = query.trim().toLowerCase();
  return SEARCH_HINTS.filter((h) => h !== q && !h.startsWith(q)).slice(0, max);
}
