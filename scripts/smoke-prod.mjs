/**
 * Read-only HTTP checks. No bearer token, no writes.
 *
 *   node scripts/smoke-prod.mjs http://127.0.0.1:3000
 *   npm run smoke:prod -- https://<project>.vercel.app
 */

export function parseBase(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  return url.origin;
}

async function readBody(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function runSmoke(baseUrl, fetchImpl = fetch) {
  const base = parseBase(baseUrl);
  if (!base) {
    return { ok: false, results: [{ name: "base", status: 0, pass: false, detail: "bad-url" }] };
  }

  const checks = [
    { name: "home", path: "/", acceptStatus: [200] },
    { name: "health", path: "/api/health", acceptStatus: [200], healthOk: true },
    { name: "missing-post", path: "/posts/not-a-real-article-m0", acceptStatus: [404] },
    { name: "unsigned-queue", path: "/api/process-queue", acceptStatus: [401] },
    { name: "sitemap", path: "/sitemap.xml", acceptStatus: [200] },
    { name: "robots", path: "/robots.txt", acceptStatus: [200] },
  ];

  const results = [];
  for (const check of checks) {
    try {
      const response = await fetchImpl(`${base}${check.path}`, { redirect: "manual" });
      let pass = check.acceptStatus.includes(response.status);
      if (pass && check.healthOk) {
        const body = await readBody(response);
        pass = Boolean(body && body.status === "ok");
      }
      results.push({ name: check.name, status: response.status, pass });
    } catch {
      results.push({ name: check.name, status: 0, pass: false });
    }
  }

  return { ok: results.every((result) => result.pass), results };
}

function invokedDirectly() {
  const entry = process.argv[1]?.replace(/\\/g, "/") ?? "";
  return entry.endsWith("scripts/smoke-prod.mjs");
}

if (invokedDirectly()) {
  const outcome = await runSmoke(process.argv[2]);
  for (const result of outcome.results) {
    const status = result.status || result.detail || "error";
    console.log(`${result.pass ? "OK  " : "FAIL"} ${result.name} ${status}`);
  }
  if (!outcome.ok) process.exit(1);
}
