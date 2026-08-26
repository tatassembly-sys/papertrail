/**
 * Production smoke simulation against a live base URL.
 * Usage: node scripts/sim-smoke.mjs [baseUrl]
 */
const base = (process.argv[2] || process.env.SIM_BASE_URL || "https://papertrail-production-71d6.up.railway.app").replace(
  /\/$/,
  ""
);

const results = [];

async function test(name, method, path, { body, headers, expect } = {}) {
  const url = path.startsWith("http") ? path : `${base}${path}`;
  const init = { method, headers: { ...(headers || {}) } };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  let status = 0;
  let text = "";
  try {
    const res = await fetch(url, init);
    status = res.status;
    text = await res.text();
  } catch (err) {
    results.push({ name, status: 0, pass: false, note: String(err) });
    console.log(`FAIL ${name} network ${err}`);
    return;
  }
  const pass =
    typeof expect === "function"
      ? expect(status, text)
      : Array.isArray(expect)
        ? expect.includes(status)
        : status === (expect ?? 200);
  results.push({
    name,
    status,
    pass,
    note: text.slice(0, 140).replace(/\s+/g, " "),
  });
  console.log(`${pass ? "OK  " : "FAIL"} ${name} ${status}`);
}

const uid = Math.random().toString(16).slice(2, 10);

await test("health", "GET", "/api/health", {
  expect: (s, t) => s === 200 && t.includes('"db":"connected"'),
});
await test("home", "GET", "/");
await test("search", "GET", "/?q=neuron");
await test("login_page", "GET", "/login");
await test("feed", "GET", "/feed.xml");
await test("sitemap", "GET", "/sitemap.xml");
await test("missing_post", "GET", "/posts/does-not-exist-xyz-999", {
  expect: (s) => s === 404 || s === 200, // log actual; prefer 404
});
await test("admin_unauth", "GET", "/admin", {
  expect: (s) => s === 307 || s === 302 || s === 200,
});
await test("admin_login_bad", "POST", "/api/auth/login", {
  body: { email: "bad@example.com", password: "wrong" },
  expect: [401],
});
await test("register", "POST", "/api/auth/register", {
  body: {
    email: `sim+${uid}@example.com`,
    password: "testpass123",
    name: "Sim",
  },
  expect: [200],
});
await test("newsletter_bad", "POST", "/api/newsletter/subscribe", {
  body: { email: "nope" },
  expect: [400],
});
await test("newsletter_ok", "POST", "/api/newsletter/subscribe", {
  body: { email: `news+${uid}@example.com` },
  expect: [200],
});
await test("submit_ok", "POST", "/api/submissions", {
  body: { url: "https://arxiv.org/abs/2401.12345", note: "sim" },
  expect: [201, 200],
});
await test("cron_unauth", "GET", "/api/cron-fetch", { expect: [401, 503] });
await test("me_anon", "GET", "/api/me", {
  expect: (s, t) => s === 200 && t.includes('"user":null'),
});

const failed = results.filter((r) => !r.pass);
console.log("\n=== SUMMARY ===");
console.log(`base=${base} total=${results.length} fail=${failed.length}`);
if (failed.length) {
  for (const f of failed) console.log(` - ${f.name}: ${f.status} ${f.note}`);
  process.exitCode = 1;
}
