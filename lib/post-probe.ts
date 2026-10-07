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
