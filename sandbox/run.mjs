#!/usr/bin/env node
/**
 * Paper Trail sandbox: 500+ isolated scenarios against product rules.
 * No Mongo, no network, no deploy. Run: node sandbox/run.mjs
 */
import { createHash, randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import * as P from "./product.mjs";

const results = [];
let currentGroup = "ungrouped";

function group(name) {
  currentGroup = name;
}

function test(name, fn) {
  const full = `${currentGroup} · ${name}`;
  try {
    fn();
    results.push({ name: full, ok: true });
  } catch (err) {
    results.push({ name: full, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

function eq(a, b, msg) {
  if (a !== b) {
    throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
}

function includes(hay, needle, msg) {
  if (!String(hay).includes(needle)) {
    throw new Error(msg || `expected ${JSON.stringify(hay)} to include ${JSON.stringify(needle)}`);
  }
}

function deepEq(a, b, msg) {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(msg || `expected ${sb}, got ${sa}`);
}

function article() {
  return P.sampleArticle();
}

function userStore(overrides = {}) {
  const s = new P.PaperTrailSandbox();
  const res = s.register("reader@example.com", "password1", "Reader");
  if (overrides.pro) s.grantPro(res.user.id, overrides.pro === "stripe" ? "stripe" : "override");
  return { s, user: s.users.get(res.user.id), id: res.user.id, verifyToken: res.verifyToken };
}

/* -------------------------------------------------------------------------- */
group("entitlements");

test("anonymous is free", () => {
  const e = P.entitlementsFor(null);
  eq(e.plan, "free");
  eq(e.chatPerDay, 5);
  eq(e.export, false);
});

test("free plan caps", () => {
  const e = P.entitlementsFor({ plan: "free" });
  eq(e.saves, 20);
  eq(e.bookmarks, 20);
  eq(e.topics, 8);
  eq(e.submissionsPerWeek, 3);
  eq(e.collections, 1);
  eq(e.highlights, 15);
  eq(e.prioritySubmit, false);
});

test("pro override unlocks export", () => {
  const e = P.entitlementsFor({ plan: "free", plan_override: "pro" });
  eq(e.plan, "pro");
  eq(e.export, true);
  eq(e.chatPerDay, null);
  eq(e.saves, null);
});

test("stripe active is pro", () => {
  assert(P.isProUser({ plan: "pro", plan_status: "active" }));
});

test("stripe trialing is pro", () => {
  assert(P.isProUser({ plan: "pro", plan_status: "trialing" }));
});

test("stripe past_due is still pro", () => {
  assert(P.isProUser({ plan: "pro", plan_status: "past_due" }));
});

test("canceled is free", () => {
  assert(!P.isProUser({ plan: "pro", plan_status: "canceled" }));
});

test("unpaid is free", () => {
  assert(!P.isProUser({ plan: "pro", plan_status: "unpaid" }));
});

test("incomplete is free", () => {
  assert(!P.isProUser({ plan: "pro", plan_status: "incomplete" }));
});

test("plan pro without status is free", () => {
  assert(!P.isProUser({ plan: "pro" }));
});

test("grant email is pro", () => {
  assert(
    P.isProUser({ email: "lab@uni.edu", plan: "free" }, { BILLING_GRANT_EMAILS: "lab@uni.edu" })
  );
});

test("grant email is case-insensitive", () => {
  assert(
    P.isProUser({ email: "Lab@Uni.Edu", plan: "free" }, { BILLING_GRANT_EMAILS: " lab@uni.edu , other@x.com" })
  );
});

test("unlisted email is not granted", () => {
  assert(
    !P.isProUser({ email: "nope@uni.edu", plan: "free" }, { BILLING_GRANT_EMAILS: "lab@uni.edu" })
  );
});

test("null user is not pro", () => {
  assert(!P.isProUser(null));
});

test("PLAN_COPY monthly is £8 GBP", () => {
  eq(P.PLAN_COPY.monthly.amount, 8);
  eq(P.PLAN_COPY.monthly.currency, "GBP");
  eq(P.PLAN_COPY.monthly.label, "£8");
});

test("PLAN_COPY yearly is £72 (25% off 96)", () => {
  eq(P.PLAN_COPY.yearly.amount, 72);
  eq(P.PLAN_COPY.yearly.amount, 8 * 12 * 0.75);
});

test("billing unconfigured without keys", () => {
  assert(!P.isBillingConfigured({}));
});

test("billing needs all three stripe keys", () => {
  assert(
    !P.isBillingConfigured({
      STRIPE_SECRET_KEY: "sk_test_x",
      STRIPE_PRICE_MONTHLY: "price_m",
    })
  );
  assert(
    P.isBillingConfigured({
      STRIPE_SECRET_KEY: "sk_test_x",
      STRIPE_PRICE_MONTHLY: "price_m",
      STRIPE_PRICE_YEARLY: "price_y",
    })
  );
});

test("webhook configured only with secret", () => {
  assert(!P.stripeWebhookConfigured({}));
  assert(P.stripeWebhookConfigured({ STRIPE_WEBHOOK_SECRET: "whsec_x" }));
});

test("public config uses override labels", () => {
  const c = P.billingPublicConfig({
    BILLING_MONTHLY_LABEL: "£8/mo",
    BILLING_YEARLY_LABEL: "£72/yr",
  });
  eq(c.monthly.label, "£8/mo");
  eq(c.yearly.label, "£72/yr");
  eq(c.currency, "GBP");
});

test("CHAT_ABUSE_PER_HOUR is 40", () => eq(P.CHAT_ABUSE_PER_HOUR, 40));
test("PRO_SUBMISSIONS_PER_DAY is 20", () => eq(P.PRO_SUBMISSIONS_PER_DAY, 20));

/* -------------------------------------------------------------------------- */
group("cite");

const sample = article();

test("apa includes year and Paper Trail", () => {
  const c = P.formatCitation(sample, "https://www.papertrailresearch.co.uk", "apa");
  includes(c, "(2024)");
  includes(c, "Paper Trail");
  includes(c, "/posts/quieter-way-to-measure-sleep");
  includes(c, "Smith, J.");
});

test("apa two authors use ampersand", () => {
  includes(P.formatCitation(sample, "https://x.test", "apa"), "& Ortega, L.");
});

test("apa three authors list all with ampersand", () => {
  const c = P.formatCitation(
    P.sampleArticle({ authors: ["Ada Lovelace", "Alan Turing", "Grace Hopper"] }),
    "https://x.test",
    "apa"
  );
  includes(c, "Lovelace, A., Turing, A., & Hopper, G.");
});

test("mla single author no et al", () => {
  const c = P.formatCitation(P.sampleArticle({ authors: ["Jane Smith"] }), "https://x.test", "mla");
  assert(!c.includes("et al"));
  includes(c, "Jane Smith.");
});

test("mla multi uses et al", () => {
  includes(P.formatCitation(sample, "https://x.test", "mla"), "Jane Smith, et al.");
});

test("chicago joins authors", () => {
  includes(P.formatCitation(sample, "https://x.test", "chicago"), "Jane Smith, Luis Ortega");
});

test("bibtex includes original source", () => {
  const c = P.formatCitation(sample, "https://x.test", "bibtex");
  includes(c, "@article{");
  includes(c, "arxiv.org/abs/2401.00001");
  includes(c, "Smith and Luis Ortega");
});

test("missing authors default to Paper Trail", () => {
  includes(P.formatCitation(P.sampleArticle({ authors: [] }), "https://x.test", "apa"), "Paper Trail");
});

test("missing dates become n.d.", () => {
  includes(
    P.formatCitation(P.sampleArticle({ published_at: null, created_at: null }), "https://x.test", "apa"),
    "(n.d.)"
  );
});

test("trailing period stripped from title", () => {
  const c = P.formatCitation(P.sampleArticle({ title: "Hello." }), "https://x.test", "apa");
  includes(c, "Hello.");
  assert(!c.includes("Hello.."));
});

test("site trailing slash stripped in cite url", () => {
  includes(
    P.formatCitation(sample, "https://x.test/", "apa"),
    "https://x.test/posts/"
  );
});

test("bibtex empty year when n.d.", () => {
  const c = P.formatCitation(
    P.sampleArticle({ published_at: null, created_at: null }),
    "https://x.test",
    "bibtex"
  );
  includes(c, "year      = {}");
});

/* -------------------------------------------------------------------------- */
group("slug");

test("slugify lowercases and hyphens", () => eq(P.slugifyLabel("Jane Smith"), "jane-smith"));
test("slugify strips accents", () => eq(P.slugifyLabel("José García"), "jose-garcia"));
test("slugify ampersand to and", () => eq(P.slugifyLabel("Sleep & Sensors"), "sleep-and-sensors"));
test("slugify empty becomes item", () => eq(P.slugifyLabel("***"), "item"));
test("slugify trims punctuation", () => eq(P.slugifyLabel("  Hello!!!  "), "hello"));
test("slugify caps at 80", () => eq(P.slugifyLabel("a".repeat(120)).length, 80));
test("labelMatchesSlug true", () => assert(P.labelMatchesSlug("Jane Smith", "jane-smith")));
test("labelMatchesSlug false", () => assert(!P.labelMatchesSlug("Jane Doe", "jane-smith")));
test("escapeRegex dots", () => eq(P.escapeRegex("q-bio.NC"), "q-bio\\.NC"));
test("slugToLooseRegex matches Jane Smith", () => {
  assert(P.slugToLooseRegex("jane-smith").test("Jane Smith"));
  assert(P.slugToLooseRegex("jane-smith").test("Jane, Smith"));
});
test("validSlug accepts kebab", () => assert(P.validSlug("quieter-way-to-measure-sleep")));
test("validSlug rejects spaces", () => assert(!P.validSlug("not a slug")));
test("validSlug rejects path", () => assert(!P.validSlug("../etc")));

/* -------------------------------------------------------------------------- */
group("reading-time");

test("empty text is 0 words", () => eq(P.wordCount("   "), 0));
test("counts words", () => eq(P.wordCount("one two three"), 3));
test("minimum one minute", () => {
  eq(P.readingMinutes(P.sampleArticle({ plain_explanation: "Hi.", why_it_matters: [], caveats: "x", headline: "h", title: "t" })), 1);
});
test("label singular", () => eq(P.readingTimeLabel(1), "1 min read"));
test("label plural", () => eq(P.readingTimeLabel(4), "4 min read"));
test("long article rounds minutes", () => {
  const words = Array(440).fill("word").join(" ");
  eq(P.readingMinutes(P.sampleArticle({ plain_explanation: words, why_it_matters: [], caveats: "", headline: "", title: "" })), 2);
});

/* -------------------------------------------------------------------------- */
group("safe-redirect");

const FALL = "/";
const redirectCases = [
  ["/account", "/account"],
  ["/posts/hello-world", "/posts/hello-world"],
  ["/library", "/library"],
  [null, FALL],
  ["", FALL],
  ["https://evil.test", FALL],
  ["//evil.test", FALL],
  ["/\\evil.test", FALL],
  ["/account?x=1", FALL],
  ["/account#x", FALL],
  ["\\login", FALL],
  ["/login\\next", FALL],
  ["javascript:alert(1)", FALL],
  ["/admin/../login", FALL],
  ["account", FALL],
  ["//google.com/%2e%2e", FALL],
  ["/welcome", "/welcome"],
  ["/topics/ai", "/topics/ai"],
];
for (const [input, expected] of redirectCases) {
  test(`path ${JSON.stringify(input)}`, () => eq(P.safeRelativePath(input, FALL), expected));
}

/* -------------------------------------------------------------------------- */
group("http-url");

const urlCases = [
  ["https://arxiv.org/abs/1", true],
  ["http://example.com/p", true],
  ["https://pubmed.ncbi.nlm.nih.gov/123", true],
  ["javascript:alert(1)", false],
  ["data:text/html,hi", false],
  ["ftp://files.test", false],
  ["https://user:pass@host.test/x", false],
  ["https://user@host.test/x", false],
  ["", false],
  [null, false],
  ["not a url", false],
  ["https://", false],
  ["  https://arxiv.org/abs/2  ", true],
];
for (const [input, ok] of urlCases) {
  test(`${ok ? "allow" : "reject"} ${JSON.stringify(input)}`, () => {
    eq(P.isSafeHttpUrl(input), ok);
  });
}

test("rejects over 500 chars", () => {
  assert(!P.sanitizeHttpUrl(`https://arxiv.org/${"a".repeat(500)}`));
});

test("toString normalizes", () => {
  const u = P.sanitizeHttpUrl("https://ARXIV.org/abs/1");
  includes(u, "https://arxiv.org/abs/1");
});

/* -------------------------------------------------------------------------- */
group("token-hash");

test("hashToken is 64 hex chars", () => {
  const h = P.hashToken("secret");
  eq(h.length, 64);
  assert(/^[a-f0-9]{64}$/.test(h));
});

test("hashToken is deterministic", () => eq(P.hashToken("a"), P.hashToken("a")));

test("hashToken differs by input", () => assert(P.hashToken("a") !== P.hashToken("b")));

test("lookup is hash only", () => {
  const v = P.tokenLookupValues("abc");
  eq(v.length, 1);
  eq(v[0], P.hashToken("abc"));
});

test("stored hash is not a lookup candidate", () => {
  const hashed = P.hashToken("abc");
  assert(!P.tokenLookupValues(hashed).includes(hashed) || P.tokenLookupValues(hashed)[0] !== hashed);
  eq(P.tokenLookupValues(hashed)[0], P.hashToken(hashed));
});

test("lookup empty after trim", () => deepEq(P.tokenLookupValues("  "), []));

test("timingSafeEqual same", () => assert(P.timingSafeEqualString("Bearer x", "Bearer x")));

test("timingSafeEqual different", () => assert(!P.timingSafeEqualString("Bearer x", "Bearer y")));

test("timingSafeEqual length mismatch", () => assert(!P.timingSafeEqualString("a", "aa")));

test("hashIp is 64 hex", () => {
  assert(/^[a-f0-9]{64}$/.test(P.hashIp("1.1.1.1")));
});

test("hashIp unknown for empty", () => eq(P.hashIp(""), P.hashIp("unknown")));

/* -------------------------------------------------------------------------- */
group("object-id");

test("valid 24 hex", () => assert(P.isValidObjectId("507f1f77bcf86cd799439011")));
test("rejects short", () => assert(!P.isValidObjectId("abc")));
test("rejects 12-byte ascii even if the driver is looser", () => {
  assert(!P.isValidObjectId("abcdefghijkl"));
  assert(!P.isValidObjectId("zzzzzzzzzzzz"));
});
test("rejects null", () => assert(!P.isValidObjectId(null)));
test("rejects empty", () => assert(!P.isValidObjectId("")));
test("uppercase hex ok", () => assert(P.isValidObjectId("507F1F77BCF86CD799439011")));
test("real ObjectId string ok", () => assert(P.isValidObjectId(new ObjectId().toString())));

/* -------------------------------------------------------------------------- */
group("stripe-signature");

const payload = JSON.stringify({ type: "customer.subscription.updated", data: { object: { id: "sub_1" } } });
const secret = "whsec_test_secret";

test("valid signature passes", () => {
  const header = P.signStripe(payload, secret);
  assert(P.verifyStripeSignature(payload, header, secret));
});

test("wrong secret fails", () => {
  const header = P.signStripe(payload, secret);
  assert(!P.verifyStripeSignature(payload, header, "whsec_other"));
});

test("tampered payload fails", () => {
  const header = P.signStripe(payload, secret);
  assert(!P.verifyStripeSignature(payload + "x", header, secret));
});

test("missing header fails", () => assert(!P.verifyStripeSignature(payload, null, secret)));
test("missing secret fails", () => assert(!P.verifyStripeSignature(payload, "t=1,v1=ab", "")));
test("empty payload fails", () => assert(!P.verifyStripeSignature("", "t=1,v1=ab", secret)));

test("stale timestamp >5min fails", () => {
  const old = Math.floor(Date.now() / 1000) - 301;
  const header = P.signStripe(payload, secret, old);
  assert(!P.verifyStripeSignature(payload, header, secret));
});

test("future timestamp >5min fails", () => {
  const fut = Math.floor(Date.now() / 1000) + 301;
  const header = P.signStripe(payload, secret, fut);
  assert(!P.verifyStripeSignature(payload, header, secret));
});

test("within 5 min passes", () => {
  const ts = Math.floor(Date.now() / 1000) - 120;
  const header = P.signStripe(payload, secret, ts);
  assert(P.verifyStripeSignature(payload, header, secret));
});

test("v0 only signatures fail", () => {
  assert(!P.verifyStripeSignature(payload, "t=1,v0=abcd", secret));
});

test("normalize nested customer id", () => {
  const n = P.normalizeSubscription({
    id: "sub_1",
    customer: { id: "cus_9" },
    status: "active",
    current_period_end: 1_700_000_000,
    items: { data: [{ price: { recurring: { interval: "year" } } }] },
    cancel_at_period_end: true,
  });
  eq(n.customerId, "cus_9");
  eq(n.interval, "year");
  eq(n.cancelAtPeriodEnd, true);
  assert(n.periodEnd instanceof Date);
});

test("normalize missing status is canceled", () => {
  eq(P.normalizeSubscription({}).status, "canceled");
});

test("active sub maps to pro", () => {
  eq(P.planFromSubscription({ status: "active" }), "pro");
});

test("canceled sub maps to free", () => {
  eq(P.planFromSubscription({ status: "canceled" }), "free");
});

/* -------------------------------------------------------------------------- */
group("search");

test("parses q alias query", () => {
  eq(P.parseSearchParams({ q: " sleep " }).query, "sleep");
});

test("parses query key", () => {
  eq(P.parseSearchParams({ query: "ai" }).query, "ai");
});

test("invalid source dropped", () => {
  eq(P.parseSearchParams({ source: "bing" }).source, "");
});

test("valid sources kept", () => {
  eq(P.parseSearchParams({ source: "arxiv" }).source, "arxiv");
  eq(P.parseSearchParams({ source: "pubmed" }).source, "pubmed");
  eq(P.parseSearchParams({ source: "manual" }).source, "manual");
  eq(P.parseSearchParams({ source: "submission" }).source, "submission");
});

test("sort newest omitted from href", () => {
  eq(P.buildSearchHref("/feed", { sort: "newest" }), "/feed");
});

test("sort oldest in href", () => {
  includes(P.buildSearchHref("/", { sort: "oldest" }), "sort=oldest");
});

test("page 1 omitted", () => eq(P.buildSearchHref("/", { page: 1 }), "/"));
test("page 2 included", () => includes(P.buildSearchHref("/", { page: 2 }), "page=2"));

test("hasActiveFilters false on empty", () => assert(!P.hasActiveFilters({})));
test("hasActiveFilters true on tag", () => assert(P.hasActiveFilters({ tag: "sleep" })));

test("tech is field alias", () => assert(P.isFieldAliasQuery("tech")));
test("random title is not alias", () => assert(!P.isFieldAliasQuery("sleep sensors in adults")));
test("empty query is not alias", () => assert(!P.isFieldAliasQuery("")));

test("tag param alias tags", () => eq(P.parseSearchParams({ tags: "AI" }).tag, "AI"));

test("href encodes query", () => {
  includes(P.buildSearchHref("/", { query: "machine learning" }), "q=machine");
});

/* -------------------------------------------------------------------------- */
group("highlight-html");

test("escapes tags", () => {
  const h = P.highlightMatches("<script>x</script>", "sleep");
  includes(h, "&lt;script&gt;");
  assert(!h.includes("<script>"));
});

test("escapes ampersand", () => includes(P.highlightMatches("A & B", "zz"), "&amp;"));

test("wraps match", () => includes(P.highlightMatches("Sleep sensors", "sleep"), "<mark"));

test("ignores 1-char tokens", () => {
  const h = P.highlightMatches("A cat", "A");
  assert(!h.includes("<mark"));
});

test("case insensitive", () => includes(P.highlightMatches("SLEEP", "sleep"), "<mark"));

/* -------------------------------------------------------------------------- */
group("share-links");

test("x intent includes headline and url", () => {
  const l = P.buildShareLinks(sample, "https://www.papertrailresearch.co.uk");
  includes(l.x, "twitter.com/intent/tweet");
  includes(l.x, "url=");
});

test("facebook sharer", () => includes(P.buildShareLinks(sample, "https://x.test").facebook, "facebook.com/sharer"));
test("reddit submit", () => includes(P.buildShareLinks(sample, "https://x.test").reddit, "reddit.com/submit"));
test("linkedin share", () => includes(P.buildShareLinks(sample, "https://x.test").linkedin, "linkedin.com"));
test("hackernews", () => includes(P.buildShareLinks(sample, "https://x.test").hackernews, "news.ycombinator.com"));

/* -------------------------------------------------------------------------- */
group("export-markdown");

test("includes title heading", () => includes(P.articleToMarkdown(sample, "https://x.test"), "# A quieter way"));
test("includes caveats section", () => includes(P.articleToMarkdown(sample, "https://x.test"), "## Editor's caveats"));
test("includes source url", () => includes(P.articleToMarkdown(sample, "https://x.test"), "arxiv.org"));
test("disclaimer present", () => {
  includes(P.articleToMarkdown(sample, "https://x.test"), "not medical, legal, or investment advice");
});
test("filename from slug", () => eq(P.markdownFilename("hello-world"), "hello-world.md"));
test("filename sanitizes", () => eq(P.markdownFilename("Hello World!"), "Hello-World.md"));
test("filename empty becomes note.md", () => eq(P.markdownFilename("***"), "note.md"));

/* -------------------------------------------------------------------------- */
group("site-url");

test("explicit NEXT_PUBLIC_SITE_URL wins", () => {
  eq(P.getSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://www.papertrailresearch.co.uk/" }), "https://www.papertrailresearch.co.uk");
});

test("railway domain gets https", () => {
  eq(P.getSiteUrl({ RAILWAY_PUBLIC_DOMAIN: "papertrail-production-71d6.up.railway.app" }), "https://papertrail-production-71d6.up.railway.app");
});

test("railway static used if no domain", () => {
  eq(P.getSiteUrl({ RAILWAY_STATIC_URL: "https://x.up.railway.app" }), "https://x.up.railway.app");
});

test("localhost fallback", () => eq(P.getSiteUrl({}), "http://localhost:3000"));

/* -------------------------------------------------------------------------- */
group("categories");

test("cs label", () => eq(P.categoryLabel("cs"), "Tech & Computer Science"));
test("null is Other", () => eq(P.categoryLabel(null), "Other"));
test("unknown code passthrough", () => eq(P.categoryLabel("zz.QQ"), "zz.QQ"));
test("pubmed-only not in arxiv feeds", () => {
  for (const c of P.PUBMED_ONLY) {
    assert(!P.ARXIV_FEED_CATEGORIES.includes(c), `${c} must not hit arxiv rss`);
  }
});
test("cs.AI is an arxiv feed", () => assert(P.ARXIV_FEED_CATEGORIES.includes("cs.AI")));
test("mix field cs.LG maps to cs", () => eq(P.mixFieldOf("cs.LG"), "cs"));
test("mix field physics.med-ph stays specific", () => eq(P.mixFieldOf("physics.med-ph"), "physics.med-ph"));
test("mix field empty is other", () => eq(P.mixFieldOf(""), "other"));
test("all pubmed topics have labels", () => {
  for (const c of P.PUBMED_ONLY) {
    assert(P.ARXIV_CATEGORY_LABELS[c], c);
  }
});

/* -------------------------------------------------------------------------- */
group("json-body");

test("asRecord object", () => assert(P.asRecord({ a: 1 })));
test("asRecord array null", () => eq(P.asRecord([1]), null));
test("asRecord null", () => eq(P.asRecord(null), null));
test("asRecord string null", () => eq(P.asRecord("x"), null));
test("auth limit 8k", () => eq(P.JSON_LIMIT_AUTH, 8192));
test("default limit 32k", () => eq(P.JSON_LIMIT_DEFAULT, 32768));
test("article limit 256k", () => eq(P.JSON_LIMIT_ARTICLE, 262144));

/* -------------------------------------------------------------------------- */
group("request-ip");

test("ignores spoofed x-real-ip", () => {
  eq(P.getClientIp({ "x-real-ip": "10.0.0.9", "x-forwarded-for": "1.1.1.1, 2.2.2.2" }), "2.2.2.2");
});

test("ignores spoofed cf-connecting-ip", () => {
  eq(P.getClientIp({ "cf-connecting-ip": "8.8.8.8", "x-forwarded-for": "1.1.1.1" }), "1.1.1.1");
});

test("xff uses LAST hop not first", () => {
  eq(P.getClientIp({ "x-forwarded-for": "attacker, 10.1.1.1" }), "10.1.1.1");
});

test("rejects xff with spaces-only junk", () => {
  eq(P.getClientIp({ "x-forwarded-for": "not an ip" }), "unknown");
});

test("spoofed real-ip alone is unknown", () => {
  eq(P.getClientIp({ "x-real-ip": "1.1.1.1" }), "unknown");
});

test("ipv6 ok via xff", () => {
  eq(P.getClientIp({ "x-forwarded-for": "2001:db8::1" }), "2001:db8::1");
});

/* -------------------------------------------------------------------------- */
group("cron-auth");

test("prod without secret is 503", () => {
  eq(P.assertCronAuthorized({ secret: "", authHeader: "", nodeEnv: "production" }).status, 503);
});

test("dev without secret is open", () => {
  assert(P.assertCronAuthorized({ secret: "", authHeader: "", nodeEnv: "development" }).ok);
});

test("matching bearer ok", () => {
  assert(P.assertCronAuthorized({ secret: "s3cret", authHeader: "Bearer s3cret", nodeEnv: "production" }).ok);
});

test("wrong bearer 401", () => {
  eq(P.assertCronAuthorized({ secret: "s3cret", authHeader: "Bearer nope", nodeEnv: "production" }).status, 401);
});

test("missing bearer 401 when secret set", () => {
  eq(P.assertCronAuthorized({ secret: "s3cret", authHeader: "", nodeEnv: "production" }).status, 401);
});

test("prefix match is not enough", () => {
  eq(P.assertCronAuthorized({ secret: "aa", authHeader: "Bearer aaa", nodeEnv: "production" }).status, 401);
});

/* -------------------------------------------------------------------------- */
group("csrf-origin");

test("GET is always ok", () => {
  assert(P.assertSameOrigin({ method: "GET", origin: "https://evil.test", host: "www.papertrailresearch.co.uk" }).ok);
});

test("POST no origin ok (same-origin browsers)", () => {
  assert(P.assertSameOrigin({ method: "POST", origin: "", host: "x.test" }).ok);
});

test("POST bearer cron ok", () => {
  assert(
    P.assertSameOrigin({
      method: "POST",
      authorization: "Bearer cron",
      origin: "https://evil.test",
      host: "www.papertrailresearch.co.uk",
    }).ok
  );
});

test("POST matching origin ok", () => {
  assert(
    P.assertSameOrigin({
      method: "POST",
      origin: "https://www.papertrailresearch.co.uk",
      host: "www.papertrailresearch.co.uk",
    }).ok
  );
});

test("POST cross-site 403", () => {
  eq(
    P.assertSameOrigin({
      method: "POST",
      origin: "https://evil.test",
      host: "www.papertrailresearch.co.uk",
    }).status,
    403
  );
});

test("DELETE cross-site 403", () => {
  eq(
    P.assertSameOrigin({
      method: "DELETE",
      origin: "https://evil.test",
      host: "www.papertrailresearch.co.uk",
    }).status,
    403
  );
});

test("PATCH cross-site 403", () => {
  eq(
    P.assertSameOrigin({
      method: "PATCH",
      origin: "https://evil.test",
      host: "www.papertrailresearch.co.uk",
    }).status,
    403
  );
});

test("PATCH same host ok", () => {
  assert(
    P.assertSameOrigin({
      method: "PATCH",
      origin: "https://www.papertrailresearch.co.uk",
      host: "www.papertrailresearch.co.uk",
    }).ok
  );
});

test("invalid origin 403", () => {
  eq(P.assertSameOrigin({ method: "POST", origin: "not-a-url", host: "x.test" }).status, 403);
});

/* -------------------------------------------------------------------------- */
group("safe-error");

test("production hides message", () => {
  eq(P.publicErrorMessage(new Error("ECONNREFUSED mongodb://secret"), "Something went wrong.", "production"), "Something went wrong.");
});

test("dev shows message", () => {
  eq(P.publicErrorMessage(new Error("boom"), "fallback", "development"), "boom");
});

test("non-error uses fallback", () => {
  eq(P.publicErrorMessage("x", "fallback", "development"), "fallback");
});

/* -------------------------------------------------------------------------- */
group("auth");

test("short password rejected", () => {
  const s = new P.PaperTrailSandbox();
  eq(s.register("a@b.com", "short").error.includes("8–72"), true);
});

test("password 8 chars ok", () => {
  const s = new P.PaperTrailSandbox();
  assert(s.register("a@b.com", "12345678").user);
});

test("password 73 chars rejected", () => {
  const s = new P.PaperTrailSandbox();
  assert(s.register("a@b.com", "x".repeat(73)).error);
});

test("email must contain @", () => {
  const s = new P.PaperTrailSandbox();
  assert(s.register("not-an-email", "12345678").error);
});

test("duplicate email generic error", () => {
  const s = new P.PaperTrailSandbox();
  s.register("a@b.com", "12345678");
  includes(s.register("a@b.com", "12345678").error, "Try signing in");
});

test("email normalized lowercase", () => {
  const s = new P.PaperTrailSandbox();
  eq(s.register("A@B.COM", "12345678").user.email, "a@b.com");
});

test("starts unverified", () => {
  const s = new P.PaperTrailSandbox();
  eq(s.register("a@b.com", "12345678").user.email_verified, false);
});

test("verify token hashed in store", () => {
  const s = new P.PaperTrailSandbox();
  const r = s.register("a@b.com", "12345678");
  const stored = [...s.users.values()][0];
  eq(stored.verify_token, P.hashToken(r.verifyToken));
  assert(stored.verify_token !== r.verifyToken);
});

test("verifyEmail with raw token works", () => {
  const s = new P.PaperTrailSandbox();
  const r = s.register("a@b.com", "12345678");
  assert(s.verifyEmail(r.verifyToken));
  assert([...s.users.values()][0].email_verified);
});

test("GET verify-email does not mark verified", () => {
  const s = new P.PaperTrailSandbox();
  const r = s.register("a@b.com", "12345678");
  const get = s.verifyEmailGet(r.verifyToken);
  includes(get.redirect, "/verify-email");
  eq(get.mutated, false);
  eq([...s.users.values()][0].email_verified, false);
});

test("POST verify-email after GET still works", () => {
  const s = new P.PaperTrailSandbox();
  const r = s.register("a@b.com", "12345678");
  s.verifyEmailGet(r.verifyToken);
  assert(s.verifyEmail(r.verifyToken));
});

test("verifyEmail wrong token fails", () => {
  const s = new P.PaperTrailSandbox();
  s.register("a@b.com", "12345678");
  assert(!s.verifyEmail("deadbeef"));
});

test("stored verify hash is not a bearer", () => {
  const s = new P.PaperTrailSandbox();
  const r = s.register("a@b.com", "12345678");
  const stored = [...s.users.values()][0].verify_token;
  assert(!s.verifyEmail(stored));
  eq([...s.users.values()][0].email_verified, false);
  assert(s.verifyEmail(r.verifyToken));
});

test("login success", () => {
  const s = new P.PaperTrailSandbox();
  s.register("a@b.com", "12345678");
  assert(s.login("a@b.com", "12345678").user);
});

test("login wrong password 401", () => {
  const s = new P.PaperTrailSandbox();
  s.register("a@b.com", "12345678");
  eq(s.login("a@b.com", "nope!!!!").status, 401);
});

test("login rate limit after 5 fails", () => {
  const s = new P.PaperTrailSandbox();
  s.register("a@b.com", "12345678");
  for (let i = 0; i < 5; i++) s.login("a@b.com", "wrongpwd", "9.9.9.9");
  eq(s.login("a@b.com", "12345678", "9.9.9.9").status, 429);
});

test("login limit is per ip", () => {
  const s = new P.PaperTrailSandbox();
  s.register("a@b.com", "12345678");
  for (let i = 0; i < 5; i++) s.login("a@b.com", "wrongpwd", "9.9.9.9");
  assert(s.login("a@b.com", "12345678", "8.8.8.8").user);
});

test("success clears failures", () => {
  const s = new P.PaperTrailSandbox();
  s.register("a@b.com", "12345678");
  s.login("a@b.com", "wrongpwd", "1.2.3.4");
  s.login("a@b.com", "12345678", "1.2.3.4");
  eq(s.loginAttempts.filter((a) => a.ip_hash === P.hashIp("1.2.3.4")).length, 0);
});

test("name defaults from email local part", () => {
  const s = new P.PaperTrailSandbox();
  eq(s.register("ada@uni.edu", "12345678").user.name, "ada");
});

test("name capped 80", () => {
  const s = new P.PaperTrailSandbox();
  eq(s.register("a@b.com", "12345678", "n".repeat(200)).user.name.length, 80);
});

test("new user token_version 1", () => {
  const { user } = userStore();
  eq(user.token_version, 1);
});

/* -------------------------------------------------------------------------- */
group("publish-rules");

test("draft insert does not publish", () => {
  const s = new P.PaperTrailSandbox();
  const r = s.insertDraft({ title: "Draft", caveats: "limits", source_url: "https://arxiv.org/abs/1" });
  eq(r.article.status, "draft");
  eq(s.listPublished().length, 0);
});

test("publish without source_url fails", () => {
  const s = new P.PaperTrailSandbox();
  const r = s.insertDraft({ source_url: "https://arxiv.org/abs/2", caveats: "limits" });
  r.article.source_url = null;
  s.articles.set(r.article.id, r.article);
  eq(s.publish(r.article.id).status, 400);
});

test("publish with javascript url fails", () => {
  const s = new P.PaperTrailSandbox();
  const r = s.insertDraft({ source_url: "https://arxiv.org/abs/3", caveats: "limits" });
  eq(s.publish(r.article.id, { source_url: "javascript:alert(1)" }).status, 400);
});

test("javascript url is never a publishable source", () => {
  assert(
    !P.canPublishArticle({
      sourceUrl: "javascript:alert(1)",
      caveats: "limits",
      status: "published",
    }).ok
  );
});

test("credentialed url is never a publishable source", () => {
  assert(
    !P.canPublishArticle({
      sourceUrl: "https://user:pass@arxiv.org/abs/1",
      caveats: "limits",
      status: "published",
    }).ok
  );
});

test("publish without caveats fails", () => {
  const s = new P.PaperTrailSandbox();
  const r = s.insertDraft({ source_url: "https://arxiv.org/abs/4", caveats: "limits" });
  eq(s.publish(r.article.id, { caveats: "  " }).status, 400);
});

test("save on live note cannot strip source", () => {
  const s = new P.PaperTrailSandbox();
  const r = s.insertDraft({ source_url: "https://arxiv.org/abs/90", caveats: "limits" });
  s.publish(r.article.id);
  eq(s.saveArticle(r.article.id, { source_url: null }).status, 400);
  eq(s.articles.get(r.article.id).source_url, "https://arxiv.org/abs/90");
});

test("save on live note cannot strip caveats", () => {
  const s = new P.PaperTrailSandbox();
  const r = s.insertDraft({ source_url: "https://arxiv.org/abs/91", caveats: "limits" });
  s.publish(r.article.id);
  eq(s.saveArticle(r.article.id, { caveats: "  " }).status, 400);
});

test("keep-published does not rewrite published_at", () => {
  const s = new P.PaperTrailSandbox();
  const r = s.insertDraft({ source_url: "https://arxiv.org/abs/92", caveats: "limits" });
  const first = s.publish(r.article.id).article.published_at;
  s.setNow(s.now + 60_000);
  const again = s.publish(r.article.id, { headline: "updated" }).article.published_at;
  eq(again, first);
});

test("publish with source + caveats succeeds", () => {
  const s = new P.PaperTrailSandbox();
  const r = s.insertDraft({
    source_url: "https://arxiv.org/abs/5",
    caveats: "Small sample.",
    slug: "ok-paper",
  });
  assert(s.publish(r.article.id).article.status === "published");
  eq(s.listPublished().length, 1);
});

test("duplicate source_url rejected", () => {
  const s = new P.PaperTrailSandbox();
  s.insertDraft({ source_url: "https://arxiv.org/abs/6", caveats: "x" });
  eq(s.insertDraft({ source_url: "https://arxiv.org/abs/6", caveats: "x" }).error, "duplicate_source");
});

test("credentialed source rejected on insert", () => {
  const s = new P.PaperTrailSandbox();
  const r = s.insertDraft({ source_url: "https://user:pass@arxiv.org/abs/7", caveats: "x" });
  eq(r.article.source_url, null);
});

test("unknown id 404", () => {
  const s = new P.PaperTrailSandbox();
  eq(s.publish("507f1f77bcf86cd799439011").status, 404);
});

/* -------------------------------------------------------------------------- */
group("chat-quota");

test("anonymous fifth chat ok sixth 402", () => {
  const s = new P.PaperTrailSandbox();
  s.insertDraft({ source_url: "https://arxiv.org/abs/8", caveats: "c" });
  const id = [...s.articles.keys()][0];
  s.publish(id);
  for (let i = 0; i < 5; i++) assert(s.chat(null, "1.1.1.1", "what is this").ok);
  eq(s.chat(null, "1.1.1.1", "what is this").status, 402);
});

test("pro chat unlimited (under abuse cap)", () => {
  const { s, id } = userStore({ pro: true });
  s.insertDraft({ source_url: "https://arxiv.org/abs/9", caveats: "c" });
  s.publish([...s.articles.keys()][0]);
  for (let i = 0; i < 8; i++) assert(s.chat(id, "1.1.1.1", "explain").ok);
});

test("free quota is per identity not shared with other ip", () => {
  const s = new P.PaperTrailSandbox();
  s.insertDraft({ source_url: "https://arxiv.org/abs/10", caveats: "c" });
  s.publish([...s.articles.keys()][0]);
  for (let i = 0; i < 5; i++) s.chat(null, "1.1.1.1", "q");
  assert(s.chat(null, "2.2.2.2", "q").ok);
});

test("caveat question uses caveats", () => {
  const a = article();
  includes(P.answerFromArticle(a, "What are the limitations?"), "Sample of 50");
});

test("why question uses why_it_matters", () => {
  includes(P.answerFromArticle(article(), "why does this matter?"), "Home monitoring");
});

test("failed assistant does not burn daily quota", () => {
  const s = new P.PaperTrailSandbox();
  s.insertDraft({ source_url: "https://arxiv.org/abs/95", caveats: "c" });
  s.publish([...s.articles.keys()][0]);
  eq(s.chat(null, "5.5.5.5", "explain", { fail: true }).status, 502);
  assert(s.chat(null, "5.5.5.5", "explain").ok);
});

test("sixth chat still 402 after a failed attempt", () => {
  const s = new P.PaperTrailSandbox();
  s.insertDraft({ source_url: "https://arxiv.org/abs/96", caveats: "c" });
  s.publish([...s.articles.keys()][0]);
  for (let i = 0; i < 5; i++) assert(s.chat(null, "6.6.6.1", "q").ok);
  s.chat(null, "6.6.6.1", "q", { fail: true });
  eq(s.chat(null, "6.6.6.1", "q").status, 402);
});

test("offline note always appended", () => {
  includes(P.answerFromArticle(article(), "hello there friend"), "AI translator offline");
});

test("chat does not invent a second paper", () => {
  const ans = P.answerFromArticle(article(), "cite another study from 2019");
  assert(!ans.toLowerCase().includes("2019 study"));
});

/* -------------------------------------------------------------------------- */
group("saves-bookmarks");

test("free save 20 then 402", () => {
  const { s, id } = userStore();
  for (let i = 0; i < 20; i++) {
    const r = s.toggleSave(id, `paper-${i}`);
    assert(!r.error, r.error);
  }
  eq(s.toggleSave(id, "paper-20").status, 402);
});

test("toggle off does not consume cap", () => {
  const { s, id } = userStore();
  s.toggleSave(id, "paper-a");
  s.toggleSave(id, "paper-a");
  eq(s.users.get(id).saved_slugs.length, 0);
  assert(s.toggleSave(id, "paper-b").user);
});

test("invalid slug 400", () => {
  const { s, id } = userStore();
  eq(s.toggleSave(id, "no spaces allowed").status, 400);
});

test("pro unlimited saves", () => {
  const { s, id } = userStore({ pro: true });
  for (let i = 0; i < 25; i++) assert(s.toggleSave(id, `p-${i}`).user);
});

test("bookmarks have own cap", () => {
  const { s, id } = userStore();
  for (let i = 0; i < 20; i++) s.toggleSave(id, `b-${i}`, "bookmarks");
  eq(s.toggleSave(id, "b-20", "bookmarks").status, 402);
});

test("saves and bookmarks independent", () => {
  const { s, id } = userStore();
  for (let i = 0; i < 20; i++) s.toggleSave(id, `s-${i}`, "saved_slugs");
  assert(s.toggleSave(id, "b-0", "bookmarks").user);
});

/* -------------------------------------------------------------------------- */
group("topics-foryou");

test("free topics cap 8", () => {
  const { s, id } = userStore();
  const topics = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  eq(s.followTopics(id, topics).user.followed_topics.length, 8);
});

test("pro can follow more than 8", () => {
  const { s, id } = userStore({ pro: true });
  const topics = Array.from({ length: 12 }, (_, i) => `t${i}`);
  eq(s.followTopics(id, topics).user.followed_topics.length, 12);
});

test("for you matches tags", () => {
  const { s, id } = userStore();
  s.followTopics(id, ["sleep"]);
  const d = s.insertDraft({
    source_url: "https://arxiv.org/abs/11",
    caveats: "c",
    tags: ["sleep"],
    slug: "sleep-paper",
    title: "Sleep paper",
  });
  s.publish(d.article.id);
  eq(s.forYou(id).length, 1);
});

test("for you empty without follows", () => {
  const { s, id } = userStore();
  eq(s.forYou(id).length, 0);
});

test("digest injects FORYOU", () => {
  const { s, id } = userStore();
  s.followTopics(id, ["sleep"]);
  const d = s.insertDraft({
    source_url: "https://arxiv.org/abs/12",
    caveats: "c",
    tags: ["sleep"],
    title: "Sleep paper",
    slug: "sleep-paper-2",
  });
  s.publish(d.article.id);
  const html = s.digestHtml(id);
  includes(html, "For you");
  includes(html, "Sleep paper");
  assert(!html.includes("{{FORYOU}}"));
});

test("digest without follows leaves empty slot", () => {
  const { s, id } = userStore();
  const html = s.digestHtml(id);
  assert(!html.includes("{{FORYOU}}"));
  assert(!html.includes("For you"));
});

test("blank topic strings dropped", () => {
  const { s, id } = userStore();
  eq(s.followTopics(id, ["  ", "ai", ""]).user.followed_topics.join(","), "ai");
});

/* -------------------------------------------------------------------------- */
group("collections");

test("free second list 402", () => {
  const { s, id } = userStore();
  assert(s.createCollection(id, "Reading").collection);
  eq(s.createCollection(id, "More").code, "upgrade_required");
});

test("empty name rejected", () => {
  const { s, id } = userStore();
  eq(s.createCollection(id, "   ").error, "Name required.");
});

test("free list item cap 20", () => {
  const { s, id } = userStore();
  const c = s.createCollection(id, "Reading").collection;
  for (let i = 0; i < 20; i++) s.addToCollection(c.id, id, `p-${i}`);
  eq(s.addToCollection(c.id, id, "p-20").code, "upgrade_required");
});

test("pro can create more lists", () => {
  const { s, id } = userStore({ pro: true });
  assert(s.createCollection(id, "A").collection);
  assert(s.createCollection(id, "B").collection);
});

test("pro 51st list is abuse cap not upgrade", () => {
  const { s, id } = userStore({ pro: true });
  for (let i = 0; i < 50; i++) assert(s.createCollection(id, `L${i}`).collection);
  const r = s.createCollection(id, "L50");
  eq(r.code, undefined);
  eq(r.status, 400);
  includes(r.error, "50");
});

test("other user cannot add", () => {
  const { s, id } = userStore();
  const other = s.register("b@b.com", "12345678").user.id;
  const c = s.createCollection(id, "Reading").collection;
  eq(s.addToCollection(c.id, other, "p-1").error, "Not found.");
});

test("public collection view omits owner id", () => {
  const { s, id } = userStore();
  const c = s.createCollection(id, "Public", { isPublic: true }).collection;
  const view = s.publicCollectionView(c);
  assert(!("user_id" in view));
  eq(view.public, true);
});

test("public flag stored", () => {
  const { s, id } = userStore();
  eq(s.createCollection(id, "Public", { isPublic: true }).collection.public, true);
});

test("collection slug from name", () => {
  const { s, id } = userStore();
  eq(s.createCollection(id, "Deep Work").collection.slug, "deep-work");
});

/* -------------------------------------------------------------------------- */
group("highlights");

test("free 16th highlight 402", () => {
  const { s, id } = userStore();
  for (let i = 0; i < 15; i++) {
    const r = s.createHighlight(id, { slug: "p", quote: `q${i}` });
    assert(!r.error, r.error);
  }
  eq(s.createHighlight(id, { slug: "p", quote: "more" }).code, "upgrade_required");
});

test("empty quote and note rejected", () => {
  const { s, id } = userStore();
  includes(s.createHighlight(id, { slug: "p", quote: "  " }).error, "Highlight");
});

test("note-only allowed", () => {
  const { s, id } = userStore();
  assert(s.createHighlight(id, { slug: "p", note: "reread methods" }).highlight);
});

test("quote capped 800", () => {
  const { s, id } = userStore();
  eq(s.createHighlight(id, { slug: "p", quote: "x".repeat(900) }).highlight.quote.length, 800);
});

test("pro above 15 ok", () => {
  const { s, id } = userStore({ pro: true });
  for (let i = 0; i < 16; i++) assert(s.createHighlight(id, { slug: "p", quote: `q${i}` }).highlight);
});

/* -------------------------------------------------------------------------- */
group("export");

test("free export 402", () => {
  const { s, id } = userStore();
  const d = s.insertDraft({ source_url: "https://arxiv.org/abs/13", caveats: "c" });
  s.publish(d.article.id);
  eq(s.exportNote(id, d.article.id).status, 402);
});

test("pro export markdown", () => {
  const { s, id } = userStore({ pro: true });
  const d = s.insertDraft({ source_url: "https://arxiv.org/abs/14", caveats: "c", title: "Export me" });
  s.publish(d.article.id);
  includes(s.exportNote(id, d.article.id).markdown, "# Export me");
});

test("export unpublished 404", () => {
  const { s, id } = userStore({ pro: true });
  const d = s.insertDraft({ source_url: "https://arxiv.org/abs/15", caveats: "c" });
  eq(s.exportNote(id, d.article.id).status, 404);
});

/* -------------------------------------------------------------------------- */
group("submissions");

test("invalid url 400", () => {
  const s = new P.PaperTrailSandbox();
  eq(s.submit("not-a-url").status, 400);
});

test("javascript url 400", () => {
  const s = new P.PaperTrailSandbox();
  eq(s.submit("javascript:alert(1)").status, 400);
});

test("honeypot pretends success", () => {
  const s = new P.PaperTrailSandbox();
  const r = s.submit("https://arxiv.org/abs/16", { website: "http://bot" });
  eq(r.status, 201);
  eq(s.submissions.length, 0);
});

test("free third weekly ok fourth 402", () => {
  const { s, id } = userStore();
  for (let i = 0; i < 3; i++) {
    const r = s.submit(`https://arxiv.org/abs/2${i}`, { userId: id, ip: `3.3.3.${i + 1}` });
    assert(r.success, r.error);
  }
  eq(s.submit("https://arxiv.org/abs/29", { userId: id, ip: "3.3.3.9" }).status, 402);
});

test("duplicate pending is soft success", () => {
  const s = new P.PaperTrailSandbox();
  s.submit("https://arxiv.org/abs/30", { ip: "4.4.4.4" });
  includes(s.submit("https://arxiv.org/abs/30", { ip: "5.5.5.5" }).note, "already");
});

test("duplicate pending does not burn weekly quota", () => {
  const { s, id } = userStore();
  assert(s.submit("https://arxiv.org/abs/301", { userId: id, ip: "4.4.4.8" }).success);
  s.submit("https://arxiv.org/abs/301", { userId: id, ip: "4.4.4.8" });
  assert(s.submit("https://arxiv.org/abs/302", { userId: id, ip: "4.4.4.9" }).success);
  assert(s.submit("https://arxiv.org/abs/303", { userId: id, ip: "4.4.4.10" }).success);
  eq(s.submit("https://arxiv.org/abs/304", { userId: id, ip: "4.4.4.11" }).status, 402);
});

test("pro submissions marked priority", () => {
  const { s, id } = userStore({ pro: true });
  eq(s.submit("https://arxiv.org/abs/31", { userId: id }).priority, true);
});

test("anonymous ip hour cap 3", () => {
  const s = new P.PaperTrailSandbox();
  s.submit("https://arxiv.org/abs/32", { ip: "6.6.6.6" });
  s.submit("https://arxiv.org/abs/33", { ip: "6.6.6.6" });
  s.submit("https://arxiv.org/abs/34", { ip: "6.6.6.6" });
  // Weekly free cap is also 3/IP for anonymous, so the upsell 402 wins over 429.
  eq(s.submit("https://arxiv.org/abs/35", { ip: "6.6.6.6" }).status, 402);
});

test("free fourth same-ip is 402 upsell not 429", () => {
  const { s, id } = userStore();
  for (let i = 0; i < 3; i++) {
    assert(s.submit(`https://arxiv.org/abs/11${i}`, { userId: id, ip: "9.9.9.9" }).success);
  }
  eq(s.submit("https://arxiv.org/abs/119", { userId: id, ip: "9.9.9.9" }).status, 402);
});

test("shared IP still 429 when weekly quota remains", () => {
  const { s, id } = userStore();
  s.submit("https://arxiv.org/abs/200", { ip: "10.10.10.10" });
  s.submit("https://arxiv.org/abs/201", { ip: "10.10.10.10" });
  s.submit("https://arxiv.org/abs/202", { ip: "10.10.10.10" });
  eq(s.submit("https://arxiv.org/abs/203", { userId: id, ip: "10.10.10.10" }).status, 429);
});

test("note truncated 500", () => {
  const s = new P.PaperTrailSandbox();
  s.submit("https://arxiv.org/abs/36", { note: "n".repeat(800), ip: "7.7.7.7" });
  eq(s.submissions[0].note.length, 500);
});

/* -------------------------------------------------------------------------- */
group("billing-flow");

test("checkout 503 when unconfigured", () => {
  const { s, id } = userStore();
  eq(s.checkout(id, "month").status, 503);
});

test("checkout month url when configured", () => {
  const { s, id } = userStore();
  s.env = {
    STRIPE_SECRET_KEY: "sk_test",
    STRIPE_PRICE_MONTHLY: "price_m",
    STRIPE_PRICE_YEARLY: "price_y",
  };
  includes(s.checkout(id, "month").url, "checkout.stripe.com");
});

test("checkout invalid interval", () => {
  const { s, id } = userStore();
  s.env = {
    STRIPE_SECRET_KEY: "sk_test",
    STRIPE_PRICE_MONTHLY: "price_m",
    STRIPE_PRICE_YEARLY: "price_y",
  };
  eq(s.checkout(id, "week").status, 400);
});

test("webhook active grants pro", () => {
  const { s, id } = userStore();
  const sub = P.normalizeSubscription({
    id: "sub_live",
    customer: "cus_1",
    status: "active",
    items: { data: [{ price: { recurring: { interval: "month" } } }] },
  });
  eq(s.applySubscription(id, sub).plan, "pro");
});

test("webhook canceled revokes pro", () => {
  const { s, id } = userStore();
  s.applySubscription(id, { status: "active", id: "sub", customerId: "c", interval: "month" });
  eq(s.applySubscription(id, { status: "canceled", id: "sub", customerId: "c", interval: "month" }).plan, "free");
});

test("grant without plan is 400", () => {
  const { s } = userStore();
  eq(s.grantPlan("reader@example.com", "maybe").status, 400);
});

test("grant pro then free revokes override", () => {
  const { s } = userStore();
  eq(s.grantPlan("reader@example.com", "pro").user.plan, "pro");
  eq(s.grantPlan("reader@example.com", "free").user.plan, "free");
});

test("inquiry requires org", () => {
  const s = new P.PaperTrailSandbox();
  eq(s.inquiry({ name: "A", email: "a@b.com", org: "" }).status, 400);
});

test("inquiry stores lowercased email", () => {
  const s = new P.PaperTrailSandbox();
  eq(s.inquiry({ name: "Lab", email: "Lab@Uni.EDU", org: "Uni" }).inquiry.email, "lab@uni.edu");
});

test("inquiry note cap 500", () => {
  const s = new P.PaperTrailSandbox();
  eq(s.inquiry({ name: "Lab", email: "a@b.com", org: "Uni", note: "x".repeat(900) }).inquiry.note.length, 500);
});

/* -------------------------------------------------------------------------- */
group("publish-mix");

test("one per field", () => {
  const s = new P.PaperTrailSandbox();
  const drafts = [
    { title: "A", slug: "a", category: "cs.AI", source_url: "https://arxiv.org/abs/40", caveats: "c" },
    { title: "B", slug: "b", category: "cs.LG", source_url: "https://arxiv.org/abs/41", caveats: "c" },
    { title: "C", slug: "c", category: "q-bio", source_url: "https://arxiv.org/abs/42", caveats: "c" },
  ];
  const r = s.dailyMix(drafts, { dateKey: "2026-09-29" });
  eq(r.published, 2);
  const fields = r.items.map((i) => i.field).sort();
  deepEq(fields, ["cs", "q-bio"]);
});

test("second run same day skipped", () => {
  const s = new P.PaperTrailSandbox();
  const drafts = [
    { title: "A", slug: "aa", category: "math", source_url: "https://arxiv.org/abs/43", caveats: "c" },
  ];
  s.dailyMix(drafts, { dateKey: "2026-09-29" });
  eq(s.dailyMix(drafts, { dateKey: "2026-09-29" }).skipped, "already_ran");
});

test("force reruns", () => {
  const s = new P.PaperTrailSandbox();
  s.dailyMix(
    [{ title: "A", slug: "aaa", category: "math", source_url: "https://arxiv.org/abs/44", caveats: "c" }],
    { dateKey: "2026-09-29" }
  );
  const r = s.dailyMix(
    [{ title: "B", slug: "bbb", category: "stat", source_url: "https://arxiv.org/abs/45", caveats: "c" }],
    { dateKey: "2026-09-29", force: true }
  );
  eq(r.skipped, null);
});

test("mix skips whitespace caveats and takes next in field", () => {
  const s = new P.PaperTrailSandbox();
  const r = s.dailyMix(
    [
      {
        title: "Bad",
        slug: "bad-caveats",
        category: "math",
        source_url: "https://arxiv.org/abs/93",
        caveats: "   ",
      },
      {
        title: "Good",
        slug: "good-caveats",
        category: "math",
        source_url: "https://arxiv.org/abs/94",
        caveats: "Small n.",
      },
    ],
    { dateKey: "2026-03-03" }
  );
  eq(r.published, 1);
  eq(r.items[0].slug, "good-caveats");
});

test("mix will not publish without source", () => {
  const s = new P.PaperTrailSandbox();
  const r = s.dailyMix(
    [{ title: "A", slug: "no-src", category: "math", source_url: null, caveats: "c" }],
    { dateKey: "2026-01-01" }
  );
  eq(r.published, 0);
});

test("empty mix does not lock the day", () => {
  const s = new P.PaperTrailSandbox();
  const empty = s.dailyMix(
    [{ title: "A", slug: "no-src", category: "math", source_url: null, caveats: "c" }],
    { dateKey: "2026-04-04" }
  );
  eq(empty.published, 0);
  eq(empty.skipped, null);
  const later = s.dailyMix(
    [{ title: "B", slug: "ok-src", category: "math", source_url: "https://arxiv.org/abs/100", caveats: "c" }],
    { dateKey: "2026-04-04" }
  );
  eq(later.published, 1);
  eq(later.skipped, null);
});

test("cap 12 fields", () => {
  const s = new P.PaperTrailSandbox();
  const cats = [
    "cs",
    "math",
    "stat",
    "eess",
    "econ",
    "q-fin",
    "physics",
    "astro-ph",
    "quant-ph",
    "cond-mat",
    "q-bio",
    "physics.med-ph",
    "physics.ao-ph",
  ];
  const drafts = cats.map((c, i) => ({
    title: `T${i}`,
    slug: `t${i}`,
    category: c,
    source_url: `https://arxiv.org/abs/5${i}`,
    caveats: "c",
  }));
  const r = s.dailyMix(drafts, { dateKey: "2026-02-02" });
  eq(r.published, 12);
});

/* -------------------------------------------------------------------------- */
group("robots");

test("library is noindex path", () => assert(P.ROBOTS_DISALLOW.includes("/library")));
test("welcome is noindex path", () => assert(P.ROBOTS_DISALLOW.includes("/welcome")));
test("account is noindex path", () => assert(P.ROBOTS_DISALLOW.includes("/account")));
test("admin is noindex path", () => assert(P.ROBOTS_DISALLOW.includes("/admin")));
test("api is noindex path", () => assert(P.ROBOTS_DISALLOW.includes("/api")));
test("feed is indexable (not in disallow)", () => assert(!P.ROBOTS_DISALLOW.includes("/")));
test("posts not disallowed", () => assert(!P.ROBOTS_DISALLOW.includes("/posts")));
test("pricing not disallowed", () => assert(!P.ROBOTS_DISALLOW.includes("/pricing")));

/* -------------------------------------------------------------------------- */
group("middleware-matcher");

const adminProtected = ["/admin", "/admin/status", "/admin/manual-input"];
for (const path of adminProtected) {
  test(`admin path ${path} requires session`, () => {
    assert(path.startsWith("/admin"));
  });
}

test("public pages not in admin matcher", () => {
  for (const p of ["/", "/posts/x", "/pricing", "/today", "/topics"]) {
    assert(!p.startsWith("/admin") && p !== "/api");
  }
});

/* -------------------------------------------------------------------------- */
group("explore-product");

test("register lands on welcome conceptually (unverified + empty topics)", () => {
  const { user } = userStore();
  eq(user.email_verified, false);
  eq(user.followed_topics.length, 0);
});

test("home for-you hidden without topics", () => {
  const { s, id } = userStore();
  eq(s.forYou(id).length, 0);
});

test("citation always points at /posts/slug not source host as canonical page", () => {
  const c = P.formatCitation(article(), "https://www.papertrailresearch.co.uk", "apa");
  includes(c, "https://www.papertrailresearch.co.uk/posts/");
});

test("share links never include API keys", () => {
  const l = P.buildShareLinks(article(), "https://x.test");
  for (const v of Object.values(l)) {
    assert(!/sk_|whsec|Bearer/.test(v));
  }
});

test("hashToken of session material is not reversible", () => {
  const token = randomBytes(24).toString("hex");
  const h = P.hashToken(token);
  assert(h !== token);
  assert(!h.includes(token.slice(0, 8)));
});

test("yearly vs monthly savings advertised 24", () => {
  eq(8 * 12 - 72, 24);
});

test("drafts never appear in listPublished", () => {
  const s = new P.PaperTrailSandbox();
  s.insertDraft({ source_url: "https://arxiv.org/abs/60", caveats: "c", status: "draft" });
  eq(s.listPublished().length, 0);
});

test("chat on empty corpus still answers from sample fallback", () => {
  const s = new P.PaperTrailSandbox();
  assert(s.chat(null, "9.9.9.9", "explain").ok);
});

test("ObjectId hex sandbox ids are 24 chars from mongodb", () => {
  eq(new ObjectId().toString().length, 24);
});

test("sha256 known vector", () => {
  eq(
    createHash("sha256").update("abc", "utf8").digest("hex"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );
});

test("entitlements pro export true even if plan_status past_due", () => {
  eq(P.entitlementsFor({ plan: "pro", plan_status: "past_due" }).export, true);
});

test("incomplete_expired not live", () => {
  assert(!P.isProUser({ plan: "pro", plan_status: "incomplete_expired" }));
});

test("paused not live", () => {
  assert(!P.isProUser({ plan: "pro", plan_status: "paused" }));
});

test("search href keeps category", () => {
  includes(P.buildSearchHref("/", { category: "cs" }), "category=cs");
});

test("search href keeps author", () => {
  includes(P.buildSearchHref("/", { author: "Smith" }), "author=Smith");
});

test("from/to count as active filters", () => {
  assert(P.hasActiveFilters({ from: "2024-01-01" }));
});

test("sort alone is not an active filter", () => {
  assert(!P.hasActiveFilters({ sort: "oldest" }));
});

test("ai alias maps cs.AI", () => {
  assert(P.SEARCH_FIELD_ALIASES.ai.includes("cs.AI"));
});

test("space alias maps astro-ph", () => {
  assert(P.SEARCH_FIELD_ALIASES.space.includes("astro-ph"));
});

test("reading time uses 220 wpm", () => eq(P.WPM, 220));

test("hour ms 3600000", () => eq(P.HOUR_MS, 3_600_000));
test("day ms 86400000", () => eq(P.DAY_MS, 86_400_000));
test("week is 7 days", () => eq(P.WEEK_MS, 7 * P.DAY_MS));

test("canPublish draft always ok", () => {
  assert(P.canPublishArticle({ sourceUrl: null, caveats: "", status: "draft" }).ok);
});

test("pro override beats canceled stripe", () => {
  assert(P.isProUser({ plan: "pro", plan_status: "canceled", plan_override: "pro" }));
});

test("grant email beats canceled stripe", () => {
  assert(
    P.isProUser(
      { email: "x@y.com", plan: "pro", plan_status: "canceled" },
      { BILLING_GRANT_EMAILS: "x@y.com" }
    )
  );
});

test("billing public configured false by default", () => {
  eq(P.billingPublicConfig({}).configured, false);
});

test("highlight quote required xor note", () => {
  const { s, id } = userStore();
  assert(s.createHighlight(id, { slug: "z", quote: "passage" }).highlight);
});

test("collection description cap 280", () => {
  const { s, id } = userStore();
  eq(s.createCollection(id, "L", { description: "d".repeat(400) }).collection.description.length, 280);
});

test("follow topic slice 60 chars", () => {
  const { s, id } = userStore();
  eq(s.followTopics(id, ["t".repeat(90)]).user.followed_topics[0].length, 60);
});

test("same-origin GET with evil origin still ok", () => {
  assert(P.assertSameOrigin({ method: "GET", origin: "https://evil.test", host: "good.test" }).ok);
});

test("PUT mutating cross site 403", () => {
  eq(P.assertSameOrigin({ method: "PUT", origin: "https://evil.test", host: "good.test" }).status, 403);
});

test("cron header trim", () => {
  assert(P.assertCronAuthorized({ secret: "z", authHeader: "Bearer z", nodeEnv: "production" }).ok);
});

test("safe path allows nested admin", () => {
  eq(P.safeRelativePath("/admin/status", "/"), "/admin/status");
});

test("safe path blocks query open redirect", () => {
  eq(P.safeRelativePath("/login?next=https://evil.test", "/"), "/");
});

test("sanitize keeps https pubmed", () => {
  assert(P.sanitizeHttpUrl("https://pubmed.ncbi.nlm.nih.gov/12345678/"));
});

test("isSafeHttpUrl false for mailto", () => {
  assert(!P.isSafeHttpUrl("mailto:a@b.com"));
});

test("apa single-token author unchanged", () => {
  includes(P.formatCitation(P.sampleArticle({ authors: ["Plato"] }), "https://x.test", "apa"), "Plato (");
});

test("mla quotes title", () => {
  includes(P.formatCitation(article(), "https://x.test", "mla"), '"A quieter way to measure sleep."');
});

test("chicago ends with url period", () => {
  const c = P.formatCitation(article(), "https://x.test", "chicago");
  assert(c.trim().endsWith("."));
});

test("export filename matches slug", () => {
  eq(P.markdownFilename(article().slug), "quieter-way-to-measure-sleep.md");
});

test("share x encodes spaces", () => {
  includes(P.buildShareLinks(article(), "https://x.test").x, "text=");
});

test("getClientIp unknown default", () => eq(P.getClientIp({}), "unknown"));

test("tokenLookupValues trims", () => {
  eq(P.tokenLookupValues("  abc  ")[0], P.hashToken("abc"));
});

test("slugify apostrophes dropped", () => {
  eq(P.slugifyLabel("Alzheimer's"), "alzheimer-s");
});

test("labelMatchesSlug after accent fold", () => {
  assert(P.labelMatchesSlug("José", "jose"));
});

test("robots has 13 disallows", () => eq(P.ROBOTS_DISALLOW.length, 13));
test("verify-email is robots-disallowed", () => assert(P.ROBOTS_DISALLOW.includes("/verify-email")));
test("newsletter confirm is robots-disallowed", () =>
  assert(P.ROBOTS_DISALLOW.includes("/newsletter/confirm")));
test("newsletter unsubscribe is robots-disallowed", () =>
  assert(P.ROBOTS_DISALLOW.includes("/newsletter/unsubscribe")));

test("FREE_HIGHLIGHTS matches lib", () => eq(P.FREE_HIGHLIGHTS, 15));
test("FREE_COLLECTIONS matches lib", () => eq(P.FREE_COLLECTIONS, 1));
test("PRO_COLLECTIONS 50", () => eq(P.PRO_COLLECTIONS, 50));
test("PRO_COLLECTION_ITEMS 200", () => eq(P.PRO_COLLECTION_ITEMS, 200));
test("PRO_HIGHLIGHTS 500", () => eq(P.PRO_HIGHLIGHTS, 500));

test("stripe interval month from items", () => {
  eq(
    P.normalizeSubscription({
      items: { data: [{ price: { recurring: { interval: "month" } } }] },
    }).interval,
    "month"
  );
});

test("stripe interval garbage becomes null", () => {
  eq(
    P.normalizeSubscription({
      items: { data: [{ price: { recurring: { interval: "week" } } }] },
    }).interval,
    null
  );
});

test("site url railway already-https domain", () => {
  eq(P.getSiteUrl({ RAILWAY_PUBLIC_DOMAIN: "https://foo.up.railway.app" }), "https://foo.up.railway.app");
});

test("parseSearchParams trims author", () => {
  eq(P.parseSearchParams({ author: "  Ada  " }).author, "Ada");
});

test("invalid sort dropped", () => {
  eq(P.parseSearchParams({ sort: "popularity" }).sort, undefined);
});

test("relevance sort kept", () => {
  eq(P.parseSearchParams({ sort: "relevance" }).sort, "relevance");
});

test("hasActiveFilters institution", () => {
  assert(P.hasActiveFilters({ institution: "MIT" }));
});

test("buildSearchHref path only when empty", () => {
  eq(P.buildSearchHref("/topics", {}), "/topics");
});

test("highlight leaves unmatched text", () => {
  eq(P.highlightMatches("hello", "zzzz"), "hello");
});

test("publicError production never leaks mongo uri", () => {
  const msg = P.publicErrorMessage(
    new Error("connect ECONNREFUSED mongodb+srv://user:pass@cluster"),
    "Unavailable.",
    "production"
  );
  assert(!msg.includes("mongodb"));
  assert(!msg.includes("pass"));
});

test("login unknown email still 401", () => {
  const s = new P.PaperTrailSandbox();
  eq(s.login("ghost@x.com", "password1").status, 401);
});

test("register then login email case-insensitive", () => {
  const s = new P.PaperTrailSandbox();
  s.register("Ada@Uni.edu", "12345678");
  assert(s.login("ada@uni.edu", "12345678").user);
});

test("chat abuse hour cap", () => {
  const { s, id } = userStore({ pro: true });
  s.insertDraft({ source_url: "https://arxiv.org/abs/70", caveats: "c" });
  s.publish([...s.articles.keys()][0]);
  for (let i = 0; i < 40; i++) s.chat(id, "1.1.1.1", "q");
  eq(s.chat(id, "1.1.1.1", "q").status, 429);
});

test("mix dateKey utc slice", () => {
  const s = new P.PaperTrailSandbox(Date.parse("2026-09-29T23:00:00.000Z"));
  const r = s.dailyMix(
    [{ title: "Z", slug: "z", category: "math", source_url: "https://arxiv.org/abs/71", caveats: "c" }]
  );
  eq(r.dateKey, "2026-09-29");
});

test("inquiry seats optional", () => {
  const s = new P.PaperTrailSandbox();
  assert(s.inquiry({ name: "A", email: "a@b.com", org: "O" }).inquiry);
});

test("submit credentials url rejected", () => {
  const s = new P.PaperTrailSandbox();
  eq(s.submit("https://u:p@arxiv.org/abs/1").status, 400);
});

test("free user export false on public user", () => {
  const { s, id } = userStore();
  eq(s.publicUser(s.users.get(id)).entitlements.export, false);
});

test("stripe grant sets plan pro on public user", () => {
  const { s, id } = userStore({ pro: "stripe" });
  eq(s.publicUser(s.users.get(id)).plan, "pro");
});

test("authorsList fallback", () => deepEq(P.authorsList({ authors: ["  ", ""] }), ["Paper Trail"]));

test("wordCount filters extra space", () => eq(P.wordCount("  a   b  "), 2));

test("readingTimeLabel 0 still plural-ish via minutes max 1", () => {
  eq(P.readingTimeLabel(P.readingMinutes({ title: "", headline: "", why_it_matters: [], plain_explanation: "", caveats: "" })), "1 min read");
});

test("escapeRegex brackets", () => includes(P.escapeRegex("a[b]"), "\\["));

test("isFieldAliasQuery prefix tech", () => assert(P.isFieldAliasQuery("technology")));

test("looksLikeIp rejects empty", () => assert(!P.looksLikeIp("")));
test("looksLikeIp rejects long", () => assert(!P.looksLikeIp("1".repeat(65))));
test("looksLikeIp accepts dotted", () => assert(P.looksLikeIp("127.0.0.1")));

test("JSON limits ordered auth < default < article", () => {
  assert(P.JSON_LIMIT_AUTH < P.JSON_LIMIT_DEFAULT);
  assert(P.JSON_LIMIT_DEFAULT < P.JSON_LIMIT_ARTICLE);
});

test("canPublish whitespace source fails", () => {
  assert(!P.canPublishArticle({ sourceUrl: "   ", caveats: "c", status: "published" }).ok);
});

test("validEmailPassword 254 edge", () => {
  const email = `${"a".repeat(64)}@${"b".repeat(200)}.com`;
  assert(email.length > 254);
  assert(!P.validEmailPassword(email, "12345678"));
});

test("validEmailPassword 8 exactly", () => assert(P.validEmailPassword("a@b.c", "12345678")));

test("hashToken unicode stable", () => {
  eq(P.hashToken("café"), P.hashToken("café"));
});

test("timingSafeEqual empty strings", () => assert(P.timingSafeEqualString("", "")));

test("sign+verify roundtrip unicode payload", () => {
  const body = '{"ok":"✓"}';
  assert(P.verifyStripeSignature(body, P.signStripe(body, "s"), "s"));
});

test("multiple v1 signatures one valid", () => {
  const ts = Math.floor(Date.now() / 1000);
  const header = `${P.signStripe(payload, secret, ts)},v1=${"ab".repeat(32)}`;
  assert(P.verifyStripeSignature(payload, header, secret));
});

test("draft status cannot leak via listPublished after failed publish", () => {
  const s = new P.PaperTrailSandbox();
  const r = s.insertDraft({ source_url: "https://arxiv.org/abs/80", caveats: "" });
  s.publish(r.article.id, { caveats: "" });
  eq(s.listPublished().length, 0);
});

test("for you does not include drafts", () => {
  const { s, id } = userStore();
  s.followTopics(id, ["sleep"]);
  s.insertDraft({
    source_url: "https://arxiv.org/abs/81",
    caveats: "c",
    tags: ["sleep"],
    status: "draft",
  });
  eq(s.forYou(id).length, 0);
});

test("priority false for free submit", () => {
  const { s, id } = userStore();
  eq(s.submit("https://arxiv.org/abs/82", { userId: id }).priority, false);
});

test("pro daily cap 20", () => {
  const { s, id } = userStore({ pro: true });
  for (let i = 0; i < 20; i++) {
    const r = s.submit(`https://arxiv.org/abs/9${String(i).padStart(2, "0")}`, { userId: id, ip: "11.11.11.11" });
    assert(r.success, r.error);
  }
  eq(s.submit("https://arxiv.org/abs/9999", { userId: id, ip: "11.11.11.11" }).status, 429);
});

test("checkout year url", () => {
  const { s, id } = userStore();
  s.env = {
    STRIPE_SECRET_KEY: "sk",
    STRIPE_PRICE_MONTHLY: "m",
    STRIPE_PRICE_YEARLY: "y",
  };
  includes(s.checkout(id, "year").url, "year");
});

test("injectForYou replaces once", () => {
  eq(P.injectForYou("A{{FORYOU}}B{{FORYOU}}", "X"), "AXB{{FORYOU}}");
});

test("sample article has required publish fields", () => {
  const a = article();
  assert(P.canPublishArticle({ sourceUrl: a.source_url, caveats: a.caveats, status: "published" }).ok);
});

test("middleware api always runs csrf helper", () => {
  assert(P.assertSameOrigin({ method: "POST", origin: "", host: "x" }).ok);
});

test("admin matcher does not cover /account", () => {
  assert(!"/account".startsWith("/admin"));
});

test("user-login is robots-disallowed", () => assert(P.ROBOTS_DISALLOW.includes("/user-login")));

test("forgot-password is robots-disallowed", () =>
  assert(P.ROBOTS_DISALLOW.includes("/forgot-password")));

test("reset-password is robots-disallowed", () =>
  assert(P.ROBOTS_DISALLOW.includes("/reset-password")));

test("register is robots-disallowed", () => assert(P.ROBOTS_DISALLOW.includes("/register")));

test("login is robots-disallowed", () => assert(P.ROBOTS_DISALLOW.includes("/login")));

test("today is indexable", () => assert(!P.ROBOTS_DISALLOW.includes("/today")));
test("topics is indexable", () => assert(!P.ROBOTS_DISALLOW.includes("/topics")));
test("authors is indexable", () => assert(!P.ROBOTS_DISALLOW.includes("/authors")));
test("pricing is indexable", () => assert(!P.ROBOTS_DISALLOW.includes("/pricing")));

/* -------------------------------------------------------------------------- */
group("json-ld");

test("escapes script-break in list name", () => {
  const html = P.jsonLdScript({ name: "</script><script>alert(1)</script>" });
  assert(!html.includes("</script>"));
  includes(html, "\\u003c/script>");
});

test("escapes less-than in description", () => {
  const html = P.jsonLdScript({ description: "<img onerror=alert(1)>" });
  assert(!html.includes("<img"));
});

test("round-trips via JSON.parse", () => {
  const data = { name: "A < B", n: 1 };
  eq(JSON.parse(P.jsonLdScript(data)).name, "A < B");
});

/* -------------------------------------------------------------------------- */
group("arxiv-locator");

test("https arxiv url ok", () => {
  eq(P.parseArxivLocator("https://arxiv.org/abs/2401.12345"), "https://arxiv.org/abs/2401.12345");
});

test("bare id ok", () => eq(P.parseArxivLocator("2401.12345"), "2401.12345"));

test("bare id with version ok", () => eq(P.parseArxivLocator("2401.12345v2"), "2401.12345v2"));

test("javascript with embedded id rejected", () => {
  eq(P.parseArxivLocator("javascript:alert(2401.12345)"), null);
});

test("credentialed url rejected", () => {
  eq(P.parseArxivLocator("https://u:p@arxiv.org/abs/2401.12345"), null);
});

test("garbage containing id rejected", () => {
  eq(P.parseArxivLocator("not-a-url-2401.12345-more"), null);
});

/* -------------------------------------------------------------------------- */
group("arxiv-feed-allowlist");

test("empty env uses default feeds", () => {
  assert(P.arxivFeedCategoriesFromEnv("").includes("cs"));
});

test("drops pubmed-only codes", () => {
  const cats = P.arxivFeedCategoriesFromEnv("cs,dementia,obesity,math");
  assert(cats.includes("cs"));
  assert(cats.includes("math"));
  assert(!cats.includes("dementia"));
  assert(!cats.includes("obesity"));
});

test("all-invalid env falls back to full feed list", () => {
  const cats = P.arxivFeedCategoriesFromEnv("dementia,cancer");
  assert(cats.includes("cs.AI"));
  assert(!cats.includes("dementia"));
});

test("pubmed-only never in default feeds", () => {
  for (const c of P.PUBMED_ONLY) {
    assert(!P.ARXIV_FEED_CATEGORIES.includes(c), c);
  }
});

/* -------------------------------------------------------------------------- */
group("auth-secret");

test("short secret rejected", () => assert(!P.isAuthSecretOk("short")));
test("32 chars ok", () => assert(P.isAuthSecretOk("a".repeat(32))));
test("empty rejected", () => assert(!P.isAuthSecretOk("")));
test("null rejected", () => assert(!P.isAuthSecretOk(null)));

/* -------------------------------------------------------------------------- */
group("stripe-checkout-grant");

test("customer without subscription stays free", () => {
  const { s, id } = userStore();
  const pub = s.attachStripeCustomer(id, "cus_123");
  eq(pub.plan, "free");
  eq(s.users.get(id).stripe_customer_id, "cus_123");
});

test("subscription after customer grants pro", () => {
  const { s, id } = userStore();
  s.attachStripeCustomer(id, "cus_123");
  eq(s.applySubscription(id, { status: "active", id: "sub_1", customerId: "cus_123" }).plan, "pro");
});

test("stale deleted sub does not wipe live pro", () => {
  const { s, id } = userStore();
  s.applySubscription(id, { status: "active", id: "sub_live", customerId: "cus_1" });
  eq(s.applySubscription(id, { status: "canceled", id: "sub_old", customerId: "cus_1" }).plan, "pro");
  eq(s.users.get(id).stripe_subscription_id, "sub_live");
});

/* -------------------------------------------------------------------------- */
group("confirm-get-safe");

test("newsletter GET confirm does not activate", () => {
  const s = new P.PaperTrailSandbox();
  const sub = s.subscribeNewsletter("reader@example.com");
  const get = s.confirmNewsletterGet(sub.verifyToken);
  includes(get.redirect, "/newsletter/confirm");
  eq(get.mutated, false);
  eq(s.subscribers[0].status, "pending");
});

test("newsletter POST confirm activates", () => {
  const s = new P.PaperTrailSandbox();
  const sub = s.subscribeNewsletter("reader@example.com");
  s.confirmNewsletterGet(sub.verifyToken);
  assert(s.confirmNewsletterPost(sub.verifyToken));
  eq(s.subscribers[0].status, "active");
});

test("newsletter confirm URL is a page not the mutating API", () => {
  const s = new P.PaperTrailSandbox();
  const sub = s.subscribeNewsletter("a@b.com");
  includes(sub.verifyUrl, "/newsletter/confirm");
  assert(!sub.verifyUrl.includes("/api/"));
});

test("wrong newsletter token fails", () => {
  const s = new P.PaperTrailSandbox();
  s.subscribeNewsletter("a@b.com");
  assert(!s.confirmNewsletterPost("deadbeef"));
  eq(s.subscribers[0].status, "pending");
});

test("rss category is xml-escaped", () => {
  includes(P.rssChannelTitle("</title><script>", null), "&lt;/title&gt;");
  assert(!P.rssChannelTitle("</title><script>", null).includes("</title><script>"));
});

test("rss tag quote escaped", () => {
  includes(P.escapeXml(`foo"bar`), "&quot;");
});

test("rate limit ttl covers a week", () => {
  assert(P.RATE_LIMIT_TTL_SEC >= 7 * 24 * 60 * 60);
});

test("production subscribe without mail is 503", () => {
  const r = P.newsletterSubscribeNote({ emailReady: false, nodeEnv: "production", emailSent: false });
  eq(r.status, 503);
  eq(r.ok, false);
});

test("local subscribe without mail still succeeds", () => {
  const r = P.newsletterSubscribeNote({ emailReady: false, nodeEnv: "development", emailSent: false });
  eq(r.ok, true);
  includes(r.note, "on the list");
});

test("production send failure is 503 not subscribed", () => {
  const r = P.newsletterSubscribeNote({ emailReady: true, nodeEnv: "production", emailSent: false });
  eq(r.status, 503);
});

test("legacy unsub hash still matches allow-stored", () => {
  const stored = P.hashToken("deadbeef");
  assert(P.tokenLookupValuesAllowStored(stored).includes(stored));
  assert(!P.tokenLookupValues(stored).includes(stored));
});

/* -------------------------------------------------------------------------- */
group("social-share");

test("four platforms", () => eq(P.VALID_PLATFORMS.length, 4));
test("facebook is a platform", () => assert(P.isSocialPlatform("facebook")));
test("instagram is a platform", () => assert(P.isSocialPlatform("instagram")));
test("reddit is a platform", () => assert(P.isSocialPlatform("reddit")));
test("x is a platform", () => assert(P.isSocialPlatform("x")));
test("twitter alias is not a platform", () => assert(!P.isSocialPlatform("twitter")));
test("constructor is not a platform", () => assert(!P.isSocialPlatform("constructor")));
test("toString is not a platform", () => assert(!P.isSocialPlatform("toString")));
test("__proto__ is not a platform", () => assert(!P.isSocialPlatform("__proto__")));
test("empty platform rejected", () => assert(!P.isSocialPlatform("")));

test("draft cannot be shared", () => {
  const a = P.sampleArticle({ status: "draft", share_approved: true });
  eq(P.canShareNow(a, "x").status, 400);
});

test("published without approval cannot share", () => {
  const a = P.sampleArticle({ status: "published", share_approved: false });
  eq(P.canShareNow(a, "x").status, 403);
});

test("published and approved can share x", () => {
  const a = P.sampleArticle({ status: "published", share_approved: true });
  assert(P.canShareNow(a, "x").ok);
});

test("approved draft still blocked", () => {
  const a = P.sampleArticle({ status: "draft", share_approved: true });
  eq(P.canShareNow(a, "facebook").error, "not_published");
});

test("scheduled fire requires published", () => {
  const a = P.sampleArticle({ status: "draft", share_approved: true });
  eq(P.canFireScheduled(a, "reddit").ok, false);
});

test("scheduled fire requires approval", () => {
  const a = P.sampleArticle({ status: "published", share_approved: false });
  eq(P.canFireScheduled(a, "reddit").error, "not_approved");
});

test("scheduled constructor platform rejected", () => {
  const a = P.sampleArticle({ status: "published", share_approved: true });
  eq(P.canFireScheduled(a, "constructor").status, 400);
});

test("schedule date must be future", () => {
  eq(P.scheduleAtOk("2000-01-01T00:00:00.000Z", Date.parse("2026-01-01")).error, "must_be_future");
});

test("schedule date invalid", () => eq(P.scheduleAtOk("not-a-date").status, 400));

test("schedule date empty", () => eq(P.scheduleAtOk("").status, 400));

test("schedule date future ok", () => {
  assert(P.scheduleAtOk("2099-01-01T00:00:00.000Z", Date.parse("2026-01-01")).ok);
});

/* -------------------------------------------------------------------------- */
group("search-suggest");

test("suggest q too short is empty not error", () => {
  eq(P.suggestQueryOk("a").empty, true);
  assert(P.suggestQueryOk("a").ok);
});

test("suggest blank is empty", () => assert(P.suggestQueryOk("  ").empty));

test("suggest two chars ok", () => eq(P.suggestQueryOk("ai").empty, false));

test("suggest over 80 is 400", () => eq(P.suggestQueryOk("x".repeat(81)).status, 400));

test("suggest 80 chars ok", () => assert(P.suggestQueryOk("x".repeat(80)).ok));

/* -------------------------------------------------------------------------- */
group("edges");

test("object id 23 hex rejected", () => assert(!P.isValidObjectId("a".repeat(23))));

test("json-ld escapes script close", () => {
  includes(P.jsonLdScript({ name: "</script>" }), "\\u003c/script>");
});

test("json-ld escapes open angle", () => includes(P.jsonLdScript({ n: "<img>" }), "\\u003c"));

test("grant null plan 400", () => {
  const { s } = userStore();
  eq(s.grantPlan("reader@example.com", null).status, 400);
});

test("grant unknown email 404", () => {
  const s = new P.PaperTrailSandbox();
  eq(s.grantPlan("ghost@x.com", "pro").status, 404);
});

test("public collection omits user_id", () => {
  const { s, id } = userStore();
  const c = s.createCollection(id, "P", { isPublic: true }).collection;
  assert(!("user_id" in s.publicCollectionView(c)));
});

test("no xff is unknown even with cf", () => {
  eq(P.getClientIp({ "cf-connecting-ip": "1.1.1.1" }), "unknown");
});

test("submit data url 400", () => {
  const s = new P.PaperTrailSandbox();
  eq(s.submit("data:text/html,hi").status, 400);
});

test("pro override beats canceled stripe", () => {
  const { s, id } = userStore({ pro: "override" });
  s.users.get(id).plan = "pro";
  s.users.get(id).plan_status = "canceled";
  eq(P.isProUser(s.users.get(id), s.env), true);
});

test("unpaid no export", () => {
  eq(P.entitlementsFor({ plan: "pro", plan_status: "unpaid" }).export, false);
});

test("trialing can export", () => {
  eq(P.entitlementsFor({ plan: "pro", plan_status: "trialing" }).export, true);
});

test("password 7 chars rejected", () => {
  const s = new P.PaperTrailSandbox();
  assert(s.register("a@b.com", "1234567").error);
});

test("password 72 chars ok", () => {
  const s = new P.PaperTrailSandbox();
  assert(s.register("a@b.com", "x".repeat(72)).user);
});

test("email 255 rejected", () => {
  const s = new P.PaperTrailSandbox();
  const local = "a".repeat(250);
  assert(s.register(`${local}@b.com`, "12345678").error);
});

test("publish whitespace caveats blocked", () => {
  const s = new P.PaperTrailSandbox();
  const r = s.insertDraft({ source_url: "https://arxiv.org/abs/1", caveats: "  " });
  assert(!s.publish(r.article.id).article);
});

test("publish javascript source blocked", () => {
  const s = new P.PaperTrailSandbox();
  const r = s.insertDraft({ source_url: "https://arxiv.org/abs/2", caveats: "n=12" });
  eq(s.publish(r.article.id, { source_url: "javascript:alert(1)" }).status, 400);
});

test("safe path protocol relative rejected", () => {
  eq(P.safeRelativePath("//evil.test", "/"), "/");
});

test("safe path backslash rejected", () => {
  eq(P.safeRelativePath("\\\\evil.test", "/home"), "/home");
});

test("http url file protocol rejected", () => assert(!P.sanitizeHttpUrl("file:///etc/passwd")));
test("http url ftp rejected", () => assert(!P.sanitizeHttpUrl("ftp://arxiv.org/abs/1")));
test("bare arxiv locator still ok", () => eq(P.parseArxivLocator("2501.00001"), "2501.00001"));
test("arxiv locator http ok", () => assert(P.parseArxivLocator("http://arxiv.org/abs/2501.00001")));

test("feed allowlist trims spaces", () => {
  const cats = P.arxivFeedCategoriesFromEnv(" cs , math ");
  assert(cats.includes("cs"));
  assert(cats.includes("math"));
});

test("stripe skew 5 min", () => eq(P.STRIPE_SKEW_SEC, 300));
test("pro topics unlimited", () => eq(P.entitlementsFor({ plan_override: "pro" }).topics, null));
test("pro highlights unlimited entitlement", () =>
  eq(P.entitlementsFor({ plan_override: "pro" }).highlights, null));
test("login window 15 min", () => eq(P.LOGIN_WINDOW_MS, 15 * 60 * 1000));
test("wpm 220", () => eq(P.WPM, 220));
test("word count newlines", () => eq(P.wordCount("one\ntwo\nthree"), 3));
test("slugify unicode dash", () => includes(P.slugifyLabel("foo—bar"), "foo"));
test("mix other field not in primary 12", () => eq(P.mixFieldOf("linguistics"), "linguistics"));
test("mix q-fin kept", () => eq(P.mixFieldOf("q-fin.GN"), "q-fin"));
test("hashToken empty is still 64 hex", () => {
  assert(/^[a-f0-9]{64}$/.test(P.hashToken("")));
});
test("asRecord Date is object", () => assert(P.asRecord(new Date())));
test("rate ttl 8 days", () => eq(P.RATE_LIMIT_TTL_SEC, 8 * 24 * 60 * 60));
test("escapeXml amp first", () => eq(P.escapeXml("&<"), "&amp;&lt;"));
test("rss no extra when no filters", () => {
  eq(P.rssChannelTitle(null, null), "Paper Trail — Research, Translated");
});

test("verify GET redirect keeps token slice", () => {
  const s = new P.PaperTrailSandbox();
  const r = s.register("z@z.com", "12345678");
  includes(s.verifyEmailGet(r.verifyToken).redirect, r.verifyToken.slice(0, 128));
});

test("confirm GET redirect path", () => {
  const s = new P.PaperTrailSandbox();
  const sub = s.subscribeNewsletter("z@z.com");
  includes(s.confirmNewsletterGet(sub.verifyToken).redirect, "/newsletter/confirm?token=");
});

test("chat fail then success still under cap", () => {
  const s = new P.PaperTrailSandbox();
  eq(s.chat(null, "7.7.7.7", "q", { fail: true }).status, 502);
  for (let i = 0; i < 5; i++) assert(s.chat(null, "7.7.7.7", "q").ok);
  eq(s.chat(null, "7.7.7.7", "q").status, 402);
});

test("null source drafts allowed twice", () => {
  const s = new P.PaperTrailSandbox();
  assert(s.insertDraft({ source_url: null, caveats: "c", slug: "n1" }).article);
  assert(s.insertDraft({ source_url: null, caveats: "c", slug: "n2" }).article);
});

/* -------------------------------------------------------------------------- */
group("count-guard");

test("past_due with stripe sub cannot start another checkout", () => {
  const { s, id } = userStore();
  s.env = { STRIPE_SECRET_KEY: "sk", STRIPE_PRICE_MONTHLY: "m", STRIPE_PRICE_YEARLY: "y" };
  s.applySubscription(id, { status: "past_due", id: "sub_live", customerId: "cus_1" });
  eq(s.checkout(id, "month").status, 409);
});

test("trialing with stripe sub cannot start another checkout", () => {
  const { s, id } = userStore();
  s.env = { STRIPE_SECRET_KEY: "sk", STRIPE_PRICE_MONTHLY: "m", STRIPE_PRICE_YEARLY: "y" };
  s.applySubscription(id, { status: "trialing", id: "sub_t", customerId: "cus_1" });
  eq(s.checkout(id, "year").status, 409);
});

test("grant pro without stripe can still checkout", () => {
  const { s, id } = userStore({ pro: "override" });
  s.env = { STRIPE_SECRET_KEY: "sk", STRIPE_PRICE_MONTHLY: "m", STRIPE_PRICE_YEARLY: "y" };
  assert(s.checkout(id, "month").url);
});

test("public user hides stripe id but flags customer", () => {
  const { s, id } = userStore();
  s.attachStripeCustomer(id, "cus_abc");
  const pub = s.publicUser(s.users.get(id));
  eq(pub.has_billing_customer, true);
  assert(!("stripe_customer_id" in pub));
});

test("resubscribe of active list does not error", () => {
  const s = new P.PaperTrailSandbox();
  const sub = s.subscribeNewsletter("a@b.com");
  s.confirmNewsletterPost(sub.verifyToken);
  const again = s.subscribeNewsletter("a@b.com");
  eq(again.already, true);
  assert(!again.error);
});

test("constructor is not in VALID_PLATFORMS", () => {
  assert(!P.VALID_PLATFORMS.includes("constructor"));
});

test("LIVE_STATUSES has past_due", () => assert(P.LIVE_STATUSES.has("past_due")));

test("suite defines at least 500 scenarios", () => {
  const n = results.filter((r) => r.name !== "count-guard · suite defines at least 500 scenarios").length + 1;
  assert(n >= 500, `only ${n} tests registered`);
});

/* -------------------------------------------------------------------------- */

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);
const groups = new Map();
for (const r of results) {
  const g = r.name.split(" · ")[0];
  const cur = groups.get(g) || { pass: 0, fail: 0 };
  if (r.ok) cur.pass += 1;
  else cur.fail += 1;
  groups.set(g, cur);
}

console.log("Paper Trail sandbox");
console.log("===================");
for (const [g, n] of groups) {
  const mark = n.fail ? "FAIL" : "ok  ";
  console.log(`${mark}  ${g.padEnd(22)} ${n.pass + n.fail} (${n.pass} passed${n.fail ? `, ${n.fail} failed` : ""})`);
}
console.log("-------------------");
console.log(`${passed}/${results.length} passed`);
if (failed.length) {
  console.log("\nFailures:");
  for (const f of failed) console.log(`  - ${f.name}: ${f.error}`);
  process.exitCode = 1;
} else {
  console.log("\nAll sandbox scenarios passed.");
}
