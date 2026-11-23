import { connection } from "next/server";

/**
 * Data loads for ISR pages (revalidate > 0).
 *
 * `next build` often runs without a database (CI, preview builds). A failed
 * load there must not fail the build, but its empty fallback must not be
 * cached either: Next would serve "No authors indexed yet" as a fresh page for
 * the whole revalidate window. So at build time a failed load opts the route
 * out of prerendering (`connection()`), and the page renders on request.
 *
 * At runtime a failed load throws, so Next keeps serving the last good ISR
 * page and retries on the next request instead of caching an empty one.
 */
export const BUILD_PHASE = "phase-production-build";

export async function loadForIsr<T>(
  load: () => Promise<T>,
  {
    phase = process.env.NEXT_PHASE,
    optOutOfPrerender = connection,
  }: { phase?: string; optOutOfPrerender?: () => Promise<void> } = {}
): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (phase === BUILD_PHASE) await optOutOfPrerender();
    throw error;
  }
}
