/** Short shared-cache window for the probe: a newly published post shows within a minute. */
export const PROBE_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

/** 204 when a published note exists, 404 when it does not. */
export function postProbeStatus(found: boolean): 204 | 404 {
  return found ? 204 : 404;
}

export const MISSING_POST_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="robots" content="noindex" />
  <title>Not on file — Paper Trail</title>
</head>
<body>
  <p>404 · not on file</p>
  <h1>This entry doesn't exist.</h1>
  <p>The paper you're looking for was never filed, or the link is out of date.</p>
  <p><a href="/">Back to all entries</a></p>
</body>
</html>
`;
