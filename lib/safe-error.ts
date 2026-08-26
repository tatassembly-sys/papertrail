/**
 * User-facing API errors should not leak internal exception text in production
 * (connection strings fragments, stack-adjacent messages, missing-secret names).
 */
export function publicErrorMessage(err: unknown, fallback: string): string {
  if (process.env.NODE_ENV === "production") return fallback;
  return err instanceof Error ? err.message : fallback;
}
