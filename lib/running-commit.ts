/** Vercel sets these on GitHub-backed deploys. Railway is the legacy fallback. */
export function runningCommitSha(): string | null {
  const vercel = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (vercel) return vercel;
  const railway = process.env.RAILWAY_GIT_COMMIT_SHA?.trim();
  return railway ? railway : null;
}

/** `production`, `preview`, or `development` on Vercel. Null elsewhere. */
export function runningDeploymentEnv(): string | null {
  const env = process.env.VERCEL_ENV?.trim();
  return env ? env : null;
}
