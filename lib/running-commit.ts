/** Railway sets this on GitHub-backed deploys. Absent in local and CI runs. */
export function runningCommitSha(): string | null {
  const sha = process.env.RAILWAY_GIT_COMMIT_SHA?.trim();
  return sha ? sha : null;
}
