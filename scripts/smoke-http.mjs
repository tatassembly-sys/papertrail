/**
 * HTTP smoke for local routes only.
 * Skips unless BASE_URL is an http(s) localhost origin. Does not start a server.
 * Usage: BASE_URL=http://127.0.0.1:3000 node scripts/smoke-http.mjs
 */

const FIXED_ROUTES = [
  { name: "home", path: "/", accept: [200] },
  { name: "pricing", path: "/pricing", accept: [200] },
  { name: "login", path: "/login", accept: [200] },
  { name: "missing-article", path: "/posts/not-a-real-article-mr3", accept: [404] },
];

export function localOrigin(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (host !== "localhost" && host !== "127.0.0.1" && host !== "::1") return null;
  return url.origin;
}

export function articlePathFromHtml(html) {
  if (typeof html !== "string") return null;
  const match = html.match(/href="(\/posts\/[A-Za-z0-9][^"#?\s]*)"/);
  if (!match) return null;
  if (match[1].includes("not-a-real-article-mr3")) return null;
  return match[1];
}

export function planSmoke(baseUrl, homeHtml) {
  const base = localOrigin(baseUrl);
  if (!base) {
    const reason = typeof baseUrl === "string" && baseUrl.trim() ? "not-local" : "unset";
    return { run: false, reason, checks: [] };
  }
  const checks = FIXED_ROUTES.map((route) => ({
    name: route.name,
    path: route.path,
    accept: route.accept,
    url: `${base}${route.path}`,
  }));
  const articlePath = articlePathFromHtml(homeHtml);
  if (articlePath) {
    checks.push({
      name: "article",
      path: articlePath,
      accept: [200],
      url: `${base}${articlePath}`,
    });
  }
  return { run: true, reason: null, checks };
}

async function fetchStatus(url) {
  const res = await fetch(url, { redirect: "manual" });
  const text = await res.text();
  return { status: res.status, text };
}

export async function runSmoke(baseUrl) {
  const planned = planSmoke(baseUrl, "");
  if (!planned.run) return { skipped: true, reason: planned.reason, results: [] };

  const results = [];
  let homeHtml = "";
  for (const check of planned.checks) {
    try {
      const res = await fetchStatus(check.url);
      if (check.name === "home") homeHtml = res.text;
      results.push({
        name: check.name,
        status: res.status,
        pass: check.accept.includes(res.status),
      });
    } catch {
      results.push({ name: check.name, status: 0, pass: false });
    }
  }

  const article = planSmoke(baseUrl, homeHtml).checks.find((check) => check.name === "article");
  if (!article) {
    results.push({ name: "article", status: 0, pass: true, skipped: true });
  } else {
    try {
      const res = await fetchStatus(article.url);
      results.push({
        name: "article",
        status: res.status,
        pass: article.accept.includes(res.status),
      });
    } catch {
      results.push({ name: "article", status: 0, pass: false });
    }
  }

  return { skipped: false, reason: null, results };
}

function invokedDirectly() {
  const entry = process.argv[1]?.replace(/\\/g, "/") ?? "";
  return entry.endsWith("scripts/smoke-http.mjs");
}

if (invokedDirectly()) {
  const outcome = await runSmoke(process.env.BASE_URL);
  if (outcome.skipped) {
    const why =
      outcome.reason === "not-local"
        ? "BASE_URL is not localhost; smoke-http checks local routes only."
        : "BASE_URL is unset; smoke-http skipped.";
    console.log(why);
    process.exit(0);
  }
  for (const result of outcome.results) {
    if (result.skipped) console.log(`SKIP ${result.name}`);
    else console.log(`${result.pass ? "OK  " : "FAIL"} ${result.name} ${result.status}`);
  }
  const failed = outcome.results.filter((result) => !result.pass);
  if (failed.length) process.exit(1);
}
