/**
 * Isolated Paper Trail product replica for sandbox scenarios.
 * Pure functions mirror lib/; the store is in-memory (no Mongo, no network).
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ObjectId } from "mongodb";

export const FREE_CHAT_PER_DAY = 5;
export const FREE_SAVES = 20;
export const FREE_BOOKMARKS = 20;
export const FREE_TOPICS = 8;
export const FREE_SUBMISSIONS_PER_WEEK = 3;
export const PRO_SUBMISSIONS_PER_DAY = 20;
export const FREE_COLLECTIONS = 1;
export const FREE_COLLECTION_ITEMS = 20;
export const PRO_COLLECTIONS = 50;
export const PRO_COLLECTION_ITEMS = 200;
export const FREE_HIGHLIGHTS = 15;
export const PRO_HIGHLIGHTS = 500;
export const CHAT_ABUSE_PER_HOUR = 40;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;
export const HOUR_MS = 60 * 60 * 1000;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX = 5;
export const SUBMIT_IP_MAX = 3;
export const SUBMIT_IP_WINDOW_MS = HOUR_MS;
export const JSON_LIMIT_AUTH = 8 * 1024;
export const JSON_LIMIT_DEFAULT = 32 * 1024;
export const JSON_LIMIT_ARTICLE = 256 * 1024;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;
export const MAX_EMAIL_LENGTH = 254;
export const WPM = 220;
export const STRIPE_SKEW_SEC = 300;

export const PLAN_COPY = {
  monthly: { amount: 8, currency: "GBP", interval: "month", label: "£8" },
  yearly: { amount: 72, currency: "GBP", interval: "year", label: "£72" },
};

export const LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export const ROBOTS_DISALLOW = [
  "/admin",
  "/login",
  "/user-login",
  "/register",
  "/account",
  "/library",
  "/welcome",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/api",
];

export const ARXIV_CATEGORY_LABELS = {
  cs: "Tech & Computer Science",
  "cs.AI": "AI",
  "cs.LG": "Machine Learning",
  "cs.CL": "Language & NLP",
  "cs.CV": "Computer Vision",
  math: "Mathematics",
  stat: "Statistics",
  eess: "Engineering",
  econ: "Economics",
  "q-fin": "Finance",
  physics: "Physics",
  "astro-ph": "Space & Astrophysics",
  "quant-ph": "Quantum",
  "cond-mat": "Materials",
  "q-bio": "Biology",
  "physics.med-ph": "Medicine",
  "physics.ao-ph": "Climate & Atmosphere",
  "gr-qc": "Gravity & Relativity",
  hep: "Particle Physics",
  nlin: "Complex Systems",
  "math-ph": "Mathematical Physics",
  nucl: "Nuclear",
  dementia: "Dementia & Alzheimer's",
  obesity: "Obesity & Metabolic Health",
  "population-growth": "Population & Demographics",
  cancer: "Cancer",
  cardiology: "Heart & Circulation",
  "mental-health": "Mental Health",
  "infectious-disease": "Infectious Disease",
  nutrition: "Nutrition",
  "public-health": "Public Health",
};

export const ARXIV_FEED_CATEGORIES = [
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
  "gr-qc",
  "hep-th",
  "hep-ph",
  "nlin",
  "math-ph",
  "nucl-th",
  "cs.AI",
  "cs.LG",
  "cs.CL",
  "cs.CV",
  "physics.med-ph",
  "physics.ao-ph",
];

export const PUBMED_ONLY = [
  "dementia",
  "obesity",
  "population-growth",
  "cancer",
  "cardiology",
  "mental-health",
  "infectious-disease",
  "nutrition",
  "public-health",
];

export const SEARCH_FIELD_ALIASES = {
  tech: ["cs", "cs.AI", "cs.LG", "cs.CL", "cs.CV", "eess"],
  space: ["astro-ph"],
  ai: ["cs.AI", "cs.LG"],
  health: [
    "physics.med-ph",
    "dementia",
    "obesity",
    "cancer",
    "cardiology",
    "mental-health",
    "public-health",
    "nutrition",
    "infectious-disease",
  ],
  finance: ["q-fin", "econ"],
};

const MIX_FIELDS = [
  ["cs", /^cs(\.|$)/i],
  ["math", /^math(\.|$)/i],
  ["stat", /^stat(\.|$)/i],
  ["eess", /^eess(\.|$)/i],
  ["econ", /^econ(\.|$)/i],
  ["q-fin", /^q-fin/i],
  ["physics.med-ph", /^physics\.med-ph/i],
  ["physics.ao-ph", /^physics\.ao-ph/i],
  ["physics", /^physics(\.|$)/i],
  ["astro-ph", /^astro-ph/i],
  ["quant-ph", /^quant-ph/i],
  ["cond-mat", /^cond-mat/i],
  ["q-bio", /^q-bio/i],
];

const MAX_URL_LENGTH = 500;

export function hashToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function tokenLookupValues(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  return [hashToken(trimmed)];
}

export function tokenLookupValuesAllowStored(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  return [hashToken(trimmed), trimmed];
}

export function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function rssChannelTitle(category, tag) {
  const extra = category ? ` · ${escapeXml(category)}` : tag ? ` · ${escapeXml(tag)}` : "";
  return `Paper Trail — Research, Translated${extra}`;
}

export const RATE_LIMIT_TTL_SEC = 8 * 24 * 60 * 60;

export function newsletterSubscribeNote({ emailReady, nodeEnv, emailSent }) {
  if (!emailReady && nodeEnv === "production") {
    return { ok: false, error: "Email delivery is not configured. Try again later.", status: 503 };
  }
  if (nodeEnv === "production" && !emailSent) {
    return { ok: false, error: "Could not send confirmation email. Try again shortly.", status: 503 };
  }
  return {
    ok: true,
    note: emailSent ? "Check your inbox for a confirmation link." : "You're on the list.",
  };
}

export function timingSafeEqualString(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function sanitizeHttpUrl(value, maxLen = MAX_URL_LENGTH) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLen) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function isSafeHttpUrl(value) {
  return sanitizeHttpUrl(value) !== null;
}

const BARE_ARXIV_ID = /^\d{4}\.\d{4,5}(v\d+)?$/;

export function parseArxivLocator(input) {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 500) return null;
  const clean = sanitizeHttpUrl(trimmed);
  if (clean) return clean;
  if (BARE_ARXIV_ID.test(trimmed)) return trimmed;
  return null;
}

export function jsonLdScript(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export const AUTH_SECRET_MIN = 32;

export function isAuthSecretOk(secret) {
  return Boolean(secret && secret.length >= AUTH_SECRET_MIN);
}

const ARXIV_FEED_SET = new Set(ARXIV_FEED_CATEGORIES);

export function arxivFeedCategoriesFromEnv(raw) {
  if (!raw || !String(raw).trim()) return [...ARXIV_FEED_CATEGORIES];
  const picked = String(raw)
    .split(",")
    .map((c) => c.trim())
    .filter((c) => ARXIV_FEED_SET.has(c));
  return picked.length ? picked : [...ARXIV_FEED_CATEGORIES];
}

export function safeRelativePath(value, fallback) {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.includes("\\") || value.includes("://")) return fallback;
  if (!/^\/[A-Za-z0-9/_-]*$/.test(value)) return fallback;
  return value;
}

export function isValidObjectId(id) {
  if (!id || typeof id !== "string") return false;
  if (!/^[a-f0-9]{24}$/i.test(id)) return false;
  return ObjectId.isValid(id);
}

export function slugifyLabel(value) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "item";
}

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function slugToLooseRegex(slug) {
  const parts = slug
    .split("-")
    .map((p) => p.trim())
    .filter(Boolean)
    .map(escapeRegex);
  const source = parts.join("[\\s.,\\-'’]+");
  return new RegExp(source, "i");
}

export function labelMatchesSlug(label, slug) {
  return slugifyLabel(label) === slug;
}

export function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function articleWordCount(article) {
  const body = [
    article.title,
    article.headline,
    ...(article.why_it_matters || []),
    article.plain_explanation,
    article.caveats,
  ]
    .filter(Boolean)
    .join(" ");
  return wordCount(body);
}

export function readingMinutes(article) {
  return Math.max(1, Math.round(articleWordCount(article) / WPM));
}

export function readingTimeLabel(minutes) {
  return minutes === 1 ? "1 min read" : `${minutes} min read`;
}

export function grantedProEmails(env = process.env) {
  const raw = env.BILLING_GRANT_EMAILS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isProUser(user, env = process.env) {
  if (!user) return false;
  if (user.plan_override === "pro") return true;
  if (user.email && grantedProEmails(env).has(user.email.trim().toLowerCase())) {
    return true;
  }
  if (user.plan !== "pro") return false;
  return LIVE_STATUSES.has(user.plan_status || "");
}

export function entitlementsFor(user, env = process.env) {
  if (isProUser(user, env)) {
    return {
      plan: "pro",
      chatPerDay: null,
      saves: null,
      bookmarks: null,
      topics: null,
      submissionsPerWeek: null,
      export: true,
      prioritySubmit: true,
      collections: null,
      highlights: null,
    };
  }
  return {
    plan: "free",
    chatPerDay: FREE_CHAT_PER_DAY,
    saves: FREE_SAVES,
    bookmarks: FREE_BOOKMARKS,
    topics: FREE_TOPICS,
    submissionsPerWeek: FREE_SUBMISSIONS_PER_WEEK,
    export: false,
    prioritySubmit: false,
    collections: FREE_COLLECTIONS,
    highlights: FREE_HIGHLIGHTS,
  };
}

export function isBillingConfigured(env = process.env) {
  return Boolean(
    env.STRIPE_SECRET_KEY?.trim() &&
      env.STRIPE_PRICE_MONTHLY?.trim() &&
      env.STRIPE_PRICE_YEARLY?.trim()
  );
}

export function stripeWebhookConfigured(env = process.env) {
  return Boolean(env.STRIPE_WEBHOOK_SECRET?.trim());
}

export function billingPublicConfig(env = process.env) {
  return {
    configured: isBillingConfigured(env),
    currency: PLAN_COPY.monthly.currency,
    monthly: {
      label: env.BILLING_MONTHLY_LABEL?.trim() || PLAN_COPY.monthly.label,
      amount: PLAN_COPY.monthly.amount,
      interval: PLAN_COPY.monthly.interval,
    },
    yearly: {
      label: env.BILLING_YEARLY_LABEL?.trim() || PLAN_COPY.yearly.label,
      amount: PLAN_COPY.yearly.amount,
      interval: PLAN_COPY.yearly.interval,
    },
  };
}

export function verifyStripeSignature(payload, header, secret, nowMs = Date.now()) {
  if (!header || !secret || !payload) return false;
  const parts = header.split(",").map((p) => p.trim());
  let timestamp = "";
  const signatures = [];
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq);
    const v = part.slice(eq + 1);
    if (k === "t") timestamp = v;
    if (k === "v1") signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(nowMs / 1000 - ts) > STRIPE_SKEW_SEC) return false;

  const expectedHex = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const expected = Buffer.from(expectedHex, "utf8");
  for (const sig of signatures) {
    const got = Buffer.from(sig, "utf8");
    if (got.length === expected.length && timingSafeEqual(got, expected)) {
      return true;
    }
  }
  return false;
}

export function signStripe(payload, secret, ts = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex");
  return `t=${ts},v1=${v1}`;
}

export function normalizeSubscription(raw) {
  const id = typeof raw.id === "string" ? raw.id : "";
  const customer =
    typeof raw.customer === "string"
      ? raw.customer
      : raw.customer && typeof raw.customer === "object" && "id" in raw.customer
        ? String(raw.customer.id)
        : "";
  const status = typeof raw.status === "string" ? raw.status : "canceled";
  const periodEndUnix =
    typeof raw.current_period_end === "number" ? raw.current_period_end : null;
  const items = raw.items;
  const intervalRaw = items?.data?.[0]?.price?.recurring?.interval;
  const interval = intervalRaw === "year" || intervalRaw === "month" ? intervalRaw : null;
  return {
    id,
    customerId: customer,
    status,
    interval,
    periodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
    cancelAtPeriodEnd: Boolean(raw.cancel_at_period_end),
  };
}

export function planFromSubscription(sub) {
  return LIVE_STATUSES.has(sub.status) ? "pro" : "free";
}

export function authorsList(article) {
  const authors = (article.authors || []).map((a) => a.trim()).filter(Boolean);
  return authors.length ? authors : ["Paper Trail"];
}

function yearOf(article) {
  const raw = article.published_at || article.created_at;
  if (!raw) return "n.d.";
  const y = new Date(raw).getFullYear();
  return Number.isFinite(y) ? String(y) : "n.d.";
}

function apaAuthors(names) {
  const formatted = names.map((name) => {
    const parts = name.split(/\s+/);
    if (parts.length === 1) return parts[0];
    const last = parts[parts.length - 1];
    const initials = parts
      .slice(0, -1)
      .map((p) => `${p.charAt(0).toUpperCase()}.`)
      .join(" ");
    return `${last}, ${initials}`;
  });
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`;
  return `${formatted.slice(0, -1).join(", ")}, & ${formatted[formatted.length - 1]}`;
}

function bibtexKey(article) {
  const last = (authorsList(article)[0] || "paper")
    .split(/\s+/)
    .slice(-1)[0]
    .replace(/[^a-zA-Z]/g, "");
  return `${last || "paper"}${yearOf(article)}${(article.slug || "").replace(/-/g, "").slice(0, 12)}`;
}

export function formatCitation(article, siteUrl, style) {
  const names = authorsList(article);
  const year = yearOf(article);
  const url = `${siteUrl.replace(/\/$/, "")}/posts/${article.slug}`;
  const source = article.source_url || url;
  const title = article.title.replace(/\.$/, "");

  if (style === "apa") {
    return `${apaAuthors(names)} (${year}). ${title}. Paper Trail. ${url}`;
  }
  if (style === "mla") {
    const mlaNames = names.length === 1 ? names[0] : `${names[0]}, et al.`;
    return `${mlaNames}. "${title}." Paper Trail, ${year}, ${url}.`;
  }
  if (style === "chicago") {
    return `${names.join(", ")}. "${title}." Paper Trail. ${year}. ${url}.`;
  }
  const bibAuthors = names.join(" and ");
  return `@article{${bibtexKey(article)},
  title     = {${title}},
  author    = {${bibAuthors}},
  year      = {${year === "n.d." ? "" : year}},
  journal   = {Paper Trail},
  url       = {${url}},
  note      = {Plain-language note. Original: ${source}}
}`;
}

export function articleToMarkdown(article, siteUrl) {
  const source = article.source_url || "";
  const why = (article.why_it_matters || [])
    .map((point, i) => `${i + 1}. ${point}`)
    .join("\n");
  const authors = (article.authors || []).join(", ");
  const page = `${siteUrl.replace(/\/$/, "")}/posts/${article.slug}`;

  return (
    [
      `# ${article.title}`,
      "",
      article.headline,
      "",
      authors ? `Authors: ${authors}` : "",
      source ? `Original paper: ${source}` : "",
      `Plain-language note: ${page}`,
      "",
      "## Why it matters",
      why || "_Not listed._",
      "",
      "## In plain language",
      article.plain_explanation || "",
      "",
      "## Editor's caveats",
      article.caveats || "",
      "",
      "---",
      "",
      "This is a Paper Trail editorial translation of a published paper, not the paper itself,",
      "and not medical, legal, or investment advice. Always read the original before relying on a claim.",
      "",
    ]
      .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
      .join("\n")
      .trim() + "\n"
  );
}

export function markdownFilename(slug) {
  const safe = slug.replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "") || "note";
  return `${safe}.md`;
}

export function buildShareLinks(article, siteUrl) {
  const link = `${siteUrl}/posts/${article.slug}`;
  const text = article.headline;
  return {
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
    reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(link)}&title=${encodeURIComponent(article.title)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`,
    hackernews: `https://news.ycombinator.com/submitlink?u=${encodeURIComponent(link)}&t=${encodeURIComponent(article.title)}`,
  };
}

export function highlightMatches(text, query) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const tokens = query
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .filter((t) => t.length > 1);

  if (tokens.length === 0) return escaped;

  const re = new RegExp(`(${tokens.join("|")})`, "gi");
  return escaped.replace(
    re,
    '<mark class="bg-redpen-soft text-ink px-0.5 rounded-sm">$1</mark>'
  );
}

export function parseSearchParams(sp) {
  const one = (k) => {
    const v = sp[k];
    return typeof v === "string" ? v.trim() : "";
  };
  const sort = one("sort");
  const source = one("source");
  return {
    query: one("q") || one("query"),
    category: one("category"),
    author: one("author"),
    institution: one("institution"),
    tag: one("tag") || one("tags"),
    source:
      source === "arxiv" || source === "pubmed" || source === "manual" || source === "submission"
        ? source
        : "",
    from: one("from"),
    to: one("to"),
    sort: sort === "oldest" || sort === "newest" || sort === "relevance" ? sort : undefined,
  };
}

export function buildSearchHref(path, filters) {
  const usp = new URLSearchParams();
  if (filters.query) usp.set("q", filters.query);
  if (filters.category) usp.set("category", filters.category);
  if (filters.author) usp.set("author", filters.author);
  if (filters.institution) usp.set("institution", filters.institution);
  if (filters.tag) usp.set("tag", filters.tag);
  if (filters.source) usp.set("source", filters.source);
  if (filters.from) usp.set("from", filters.from);
  if (filters.to) usp.set("to", filters.to);
  if (filters.sort && filters.sort !== "newest") usp.set("sort", filters.sort);
  if (filters.page && filters.page > 1) usp.set("page", String(filters.page));
  const qs = usp.toString();
  return qs ? `${path}?${qs}` : path;
}

export function hasActiveFilters(f) {
  return Boolean(
    f.query || f.category || f.author || f.institution || f.tag || f.source || f.from || f.to
  );
}

export function isFieldAliasQuery(query) {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (SEARCH_FIELD_ALIASES[q]) return true;
  return Object.keys(SEARCH_FIELD_ALIASES).some(
    (key) => key.startsWith(q) || q.startsWith(key)
  );
}

export function looksLikeIp(value) {
  if (!value || value.length > 64) return false;
  if (/[\s,;]/.test(value)) return false;
  return /^[0-9a-fA-F.:%]+$/.test(value);
}

export function getClientIp(headers) {
  const forwarded = headers["x-forwarded-for"];
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && looksLikeIp(last)) return last;
  }
  return "unknown";
}

export function hashIp(ip) {
  return createHash("sha256").update(ip || "unknown").digest("hex");
}

export function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

export function publicErrorMessage(err, fallback, nodeEnv) {
  if (nodeEnv === "production") return fallback;
  return err instanceof Error ? err.message : fallback;
}

export function getSiteUrl(env = process.env) {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const railwayDomain = env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railwayDomain) {
    const host = railwayDomain.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    return `https://${host}`;
  }
  const railwayStatic = env.RAILWAY_STATIC_URL?.trim();
  if (railwayStatic) return railwayStatic.replace(/\/$/, "");
  return "http://localhost:3000";
}

export function assertCronAuthorized({ secret, authHeader, nodeEnv }) {
  const trimmedSecret = secret?.trim();
  const header = (authHeader || "").trim();
  if (!trimmedSecret) {
    if (nodeEnv === "production") return { ok: false, status: 503 };
    return { ok: true };
  }
  const expected = `Bearer ${trimmedSecret}`;
  if (!timingSafeEqualString(header, expected)) return { ok: false, status: 401 };
  return { ok: true };
}

export const VALID_PLATFORMS = ["facebook", "instagram", "reddit", "x"];

export function isSocialPlatform(platform) {
  return VALID_PLATFORMS.includes(platform);
}

export function canShareNow(article, platform) {
  if (!article || article.status !== "published") {
    return { ok: false, error: "not_published", status: 400 };
  }
  if (!article.share_approved) {
    return { ok: false, error: "not_approved", status: 403 };
  }
  if (!isSocialPlatform(platform)) {
    return { ok: false, error: "invalid_platform", status: 400 };
  }
  return { ok: true };
}

export function canFireScheduled(article, platform) {
  return canShareNow(article, platform);
}

export function suggestQueryOk(q) {
  const t = String(q || "").trim();
  if (t.length < 2) return { ok: true, suggestions: [], empty: true };
  if (t.length > 80) return { ok: false, status: 400 };
  return { ok: true, empty: false };
}

export function scheduleAtOk(when, now = Date.now()) {
  const d = new Date(when);
  if (!when || Number.isNaN(d.getTime())) return { ok: false, error: "invalid_date", status: 400 };
  if (d.getTime() <= now) return { ok: false, error: "must_be_future", status: 400 };
  return { ok: true };
}

export function assertSameOrigin({ method, authorization, origin, host }) {
  const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  if (!MUTATING.has(method)) return { ok: true };
  if ((authorization || "").toLowerCase().startsWith("bearer ")) return { ok: true };
  if (!origin) return { ok: true };
  try {
    if (host && new URL(origin).host === host) return { ok: true };
  } catch {
    /* invalid Origin */
  }
  return { ok: false, status: 403 };
}

export function categoryLabel(code) {
  if (!code) return "Other";
  return ARXIV_CATEGORY_LABELS[code] || code;
}

export function mixFieldOf(category) {
  const raw = (category || "").trim();
  for (const [name, rx] of MIX_FIELDS) {
    if (rx.test(raw)) return name;
  }
  return raw || "other";
}

export function canPublishArticle({ sourceUrl, caveats, status }) {
  if (status !== "published") return { ok: true };
  if (!sourceUrl || !String(sourceUrl).trim()) {
    return { ok: false, error: "A source URL is required before publishing." };
  }
  if (!sanitizeHttpUrl(sourceUrl)) {
    return { ok: false, error: "A source URL is required before publishing." };
  }
  if (!caveats || !String(caveats).trim()) {
    return { ok: false, error: "Caveats are required before publishing." };
  }
  return { ok: true };
}

export function validEmailPassword(email, password) {
  const normalized = email.trim().toLowerCase();
  return (
    normalized.includes("@") &&
    normalized.length <= MAX_EMAIL_LENGTH &&
    password.length >= MIN_PASSWORD_LENGTH &&
    password.length <= MAX_PASSWORD_LENGTH
  );
}

export function validSlug(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug);
}

export function answerFromArticle(fields, question) {
  const q = question.toLowerCase();
  const wantsLimits = /limit|caveat|cannot|can't|weak|sample|bias/.test(q);
  const wantsWhy = /why|matter|impact|useful|practical|application/.test(q);
  const wantsSimple = /simple|explain|eli5|plain|summary|what is|what's/.test(q);
  const note = "\n\n— Answered from this filing’s text (AI translator offline).";
  if (wantsLimits && fields.caveats.trim()) return fields.caveats.trim() + note;
  if (wantsWhy && fields.why_it_matters.length) {
    return fields.why_it_matters.map((p, i) => `${i + 1}. ${p}`).join("\n") + note;
  }
  if (wantsSimple) {
    return `${fields.headline}\n\n${fields.plain_explanation}`.slice(0, 1200) + note;
  }
  return (fields.headline || "") + note;
}

export function injectForYou(html, extra) {
  return html.replace("{{FORYOU}}", extra || "");
}

export function sampleArticle(overrides = {}) {
  return {
    title: "A quieter way to measure sleep",
    headline: "A small trial found overnight sensors tracked rest without a lab visit.",
    why_it_matters: [
      "Home monitoring could cut clinic wait times.",
      "Cheaper devices may reach more patients.",
      "Night data is usually hard to collect.",
    ],
    plain_explanation:
      "Researchers fitted fifty adults with a bedside sensor and compared the readings to a standard sleep lab. The match was close enough for screening, not diagnosis.",
    caveats:
      "Sample of 50 adults at one clinic. Not a treatment study. Industry sensors were donated.",
    slug: "quieter-way-to-measure-sleep",
    source_url: "https://arxiv.org/abs/2401.00001",
    status: "published",
    authors: ["Jane Smith", "Luis Ortega"],
    tags: ["sleep", "sensors"],
    category: "q-bio",
    published_at: "2024-03-01T00:00:00.000Z",
    created_at: "2024-02-20T00:00:00.000Z",
    ...overrides,
  };
}

let seq = 0;
function nid() {
  seq += 1;
  return new ObjectId().toString() + seq.toString(16).padStart(2, "0").slice(-2);
}

export class PaperTrailSandbox {
  constructor(now = Date.now()) {
    this.now = now;
    this.users = new Map();
    this.articles = new Map();
    this.collections = new Map();
    this.highlights = [];
    this.submissions = [];
    this.chatHits = new Map();
    this.loginAttempts = [];
    this.inquiries = [];
    this.subscribers = [];
    this.mixRuns = new Set();
    this.rate = new Map();
    this.env = {};
  }

  setNow(t) {
    this.now = t;
  }

  register(email, password, name = "") {
    if (!validEmailPassword(email, password)) {
      return { error: "Valid email and password (8–72 chars) required." };
    }
    const normalized = email.trim().toLowerCase();
    if ([...this.users.values()].some((u) => u.email === normalized)) {
      return { error: "Unable to create that account. Try signing in instead." };
    }
    const id = new ObjectId().toString();
    const verifyToken = randomBytes(24).toString("hex");
    const user = {
      id,
      email: normalized,
      password,
      name: (name.trim() || normalized.split("@")[0]).slice(0, 80),
      email_verified: false,
      verify_token: hashToken(verifyToken),
      reset_token: null,
      reset_token_expires: null,
      saved_slugs: [],
      bookmarks: [],
      followed_topics: [],
      reading_history: [],
      token_version: 1,
      plan: "free",
      plan_status: null,
      plan_override: null,
      created_at: this.now,
    };
    this.users.set(id, user);
    return { user: this.publicUser(user), verifyToken };
  }

  publicUser(u) {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      email_verified: u.email_verified,
      saved_slugs: [...u.saved_slugs],
      bookmarks: [...u.bookmarks],
      followed_topics: [...u.followed_topics],
      plan: isProUser(u, this.env) ? "pro" : "free",
      has_billing_customer: Boolean(u.stripe_customer_id),
      entitlements: entitlementsFor(u, this.env),
    };
  }

  verifyEmailGet(token) {
    const t = String(token || "").slice(0, 128);
    return { redirect: `/verify-email?token=${t}`, mutated: false };
  }

  verifyEmail(token) {
    const candidates = tokenLookupValues(token);
    for (const u of this.users.values()) {
      if (u.verify_token && candidates.includes(u.verify_token)) {
        u.email_verified = true;
        u.verify_token = null;
        return true;
      }
    }
    return false;
  }

  subscribeNewsletter(email) {
    const normalized = String(email || "").trim().toLowerCase();
    const existing = this.subscribers.find((s) => s.email === normalized);
    if (existing?.status === "active") {
      return { ok: true, already: true, emailSent: true, verifyToken: "", verifyUrl: "" };
    }
    const verifyToken = randomBytes(24).toString("hex");
    this.subscribers.push({
      email: normalized,
      status: "pending",
      verify_token: hashToken(verifyToken),
    });
    return { verifyToken, verifyUrl: `/newsletter/confirm?token=${verifyToken}` };
  }

  confirmNewsletterGet(token) {
    const t = String(token || "").slice(0, 128);
    return { redirect: `/newsletter/confirm?token=${t}`, mutated: false };
  }

  confirmNewsletterPost(token) {
    const candidates = tokenLookupValues(token);
    const row = this.subscribers.find(
      (s) => s.verify_token && candidates.includes(s.verify_token)
    );
    if (!row) return false;
    row.status = "active";
    row.verify_token = null;
    return true;
  }

  login(email, password, ip = "1.1.1.1") {
    const ipHash = hashIp(ip);
    if (this.isLoginLimited(ipHash)) return { error: "rate_limited", status: 429 };
    const user = [...this.users.values()].find(
      (u) => u.email === email.trim().toLowerCase()
    );
    if (!user || user.password !== password) {
      this.loginAttempts.push({ ip_hash: ipHash, at: this.now });
      return { error: "invalid", status: 401 };
    }
    this.loginAttempts = this.loginAttempts.filter((a) => a.ip_hash !== ipHash);
    return { user: this.publicUser(user) };
  }

  isLoginLimited(ipHash) {
    const since = this.now - LOGIN_WINDOW_MS;
    return this.loginAttempts.filter((a) => a.ip_hash === ipHash && a.at >= since)
      .length >= LOGIN_MAX;
  }

  grantPro(userId, via = "override") {
    const u = this.users.get(userId);
    if (!u) return null;
    if (via === "override") u.plan_override = "pro";
    if (via === "stripe") {
      u.plan = "pro";
      u.plan_status = "active";
    }
    return this.publicUser(u);
  }

  applySubscription(userId, sub) {
    const u = this.users.get(userId);
    if (!u) return null;
    const storedId = u.stripe_subscription_id || "";
    if (storedId && sub.id && storedId !== sub.id) {
      const incomingLive = LIVE_STATUSES.has(sub.status);
      const storedLive = LIVE_STATUSES.has(u.plan_status || "");
      if (storedLive && !incomingLive) return this.publicUser(u);
    }
    const live = LIVE_STATUSES.has(sub.status);
    u.plan = live ? "pro" : "free";
    u.plan_status = sub.status;
    u.plan_interval = sub.interval;
    u.plan_period_end = sub.periodEnd;
    u.plan_cancel_at_period_end = sub.cancelAtPeriodEnd;
    u.stripe_customer_id = sub.customerId;
    u.stripe_subscription_id = sub.id;
    return this.publicUser(u);
  }

  /** Checkout completed with a customer but no subscription must not grant Pro. */
  attachStripeCustomer(userId, customerId) {
    const u = this.users.get(userId);
    if (!u) return null;
    u.stripe_customer_id = customerId;
    return this.publicUser(u);
  }

  insertDraft(article) {
    const id = new ObjectId().toString();
    const row = {
      ...sampleArticle({ status: "draft", published_at: null, ...article }),
      id,
      source_url:
        article.source_url === undefined
          ? sanitizeHttpUrl(sampleArticle().source_url)
          : sanitizeHttpUrl(article.source_url),
    };
    if (this.hasSourceUrl(row.source_url)) {
      return { error: "duplicate_source" };
    }
    this.articles.set(id, row);
    return { article: row };
  }

  hasSourceUrl(url) {
    if (!url) return false;
    return [...this.articles.values()].some((a) => a.source_url === url);
  }

  publish(id, patch = {}) {
    const a = this.articles.get(id);
    if (!a) return { error: "not_found", status: 404 };
    const next = { ...a, ...patch, status: "published" };
    const gate = canPublishArticle({
      sourceUrl: next.source_url,
      caveats: next.caveats,
      status: "published",
    });
    if (!gate.ok) return { error: gate.error, status: 400 };
    if (a.status !== "published") {
      next.published_at = new Date(this.now).toISOString();
    } else {
      next.published_at = a.published_at;
    }
    this.articles.set(id, next);
    return { article: next };
  }

  /** Save without changing status — still cannot strip source/caveats from a live note. */
  saveArticle(id, patch = {}) {
    const a = this.articles.get(id);
    if (!a) return { error: "not_found", status: 404 };
    const next = { ...a, ...patch };
    if (next.status === "published") {
      const gate = canPublishArticle({
        sourceUrl: next.source_url,
        caveats: next.caveats,
        status: "published",
      });
      if (!gate.ok) return { error: gate.error, status: 400 };
    }
    this.articles.set(id, next);
    return { article: next };
  }

  listPublished() {
    return [...this.articles.values()].filter((a) => a.status === "published");
  }

  chat(userId, ip, message, { fail = false } = {}) {
    const user = userId ? this.users.get(userId) : null;
    const pro = isProUser(user, this.env);
    const key = userId ? `user:${userId}` : `ip:${hashIp(ip)}`;
    if (!pro) {
      const used = this.hit("chat_day", key, DAY_MS);
      if (used > FREE_CHAT_PER_DAY) {
        return { error: "upgrade_required", status: 402, code: "upgrade_required" };
      }
    }
    const hourKey = `hour:${key}`;
    const hourUsed = this.hit("chat_hour", hourKey, HOUR_MS);
    if (hourUsed > CHAT_ABUSE_PER_HOUR) {
      if (!pro) this.undo("chat_day", key, DAY_MS);
      return { error: "abuse", status: 429 };
    }
    if (fail) {
      if (!pro) this.undo("chat_day", key, DAY_MS);
      return { error: "unavailable", status: 502 };
    }
    const article = this.listPublished()[0] || sampleArticle();
    return { ok: true, answer: answerFromArticle(article, message), pro };
  }

  grantPlan(email, plan) {
    if (plan !== "pro" && plan !== "free") return { error: "plan must be pro or free.", status: 400 };
    const user = [...this.users.values()].find((u) => u.email === email.trim().toLowerCase());
    if (!user) return { error: "No account with that email.", status: 404 };
    user.plan_override = plan === "pro" ? "pro" : null;
    return { user: this.publicUser(user) };
  }

  publicCollectionView(row) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      slugs: row.slugs,
      public: row.public,
    };
  }

  toggleSave(userId, slug, field = "saved_slugs") {
    const u = this.users.get(userId);
    if (!u) return { error: "Unauthorized", status: 401 };
    if (!validSlug(slug)) return { error: "Invalid slug.", status: 400 };
    const list = u[field];
    const adding = !list.includes(slug);
    const capKey = field === "saved_slugs" ? "saves" : "bookmarks";
    const cap = entitlementsFor(u, this.env)[capKey];
    if (adding && cap != null && list.length >= cap) {
      return { error: "upgrade_required", status: 402, code: "upgrade_required" };
    }
    if (adding) list.push(slug);
    else u[field] = list.filter((s) => s !== slug);
    return { user: this.publicUser(u) };
  }

  followTopics(userId, topics) {
    const u = this.users.get(userId);
    if (!u) return { error: "Unauthorized", status: 401 };
    const cap = entitlementsFor(u, this.env).topics ?? 80;
    u.followed_topics = topics
      .filter((t) => typeof t === "string")
      .map((t) => t.trim().slice(0, 60))
      .filter(Boolean)
      .slice(0, cap);
    return { user: this.publicUser(u) };
  }

  forYou(userId) {
    const u = this.users.get(userId);
    if (!u?.followed_topics.length) return [];
    const topics = new Set(u.followed_topics.map((t) => t.toLowerCase()));
    return this.listPublished().filter((a) => {
      const tags = (a.tags || []).map((t) => t.toLowerCase());
      const cat = (a.category || "").toLowerCase();
      return tags.some((t) => topics.has(t)) || topics.has(cat) || topics.has(categoryLabel(a.category).toLowerCase());
    });
  }

  digestHtml(userId) {
    const extra = this.forYou(userId)
      .map((a) => `<li>${a.title}</li>`)
      .join("");
    const block = extra ? `<h2>For you</h2><ul>${extra}</ul>` : "";
    return injectForYou("<p>Newest</p>{{FORYOU}}<p>Footer</p>", block);
  }

  createCollection(userId, name, { description = "", isPublic = false } = {}) {
    const u = this.users.get(userId);
    if (!u) return { error: "Unauthorized" };
    const existing = [...this.collections.values()].filter((c) => c.user_id === userId);
    const pro = entitlementsFor(u, this.env).collections == null;
    const maxLists = pro ? PRO_COLLECTIONS : FREE_COLLECTIONS;
    if (existing.length >= maxLists) {
      if (pro) return { error: `You can keep up to ${maxLists} reading lists.`, status: 400 };
      return { error: "upgrade_required", code: "upgrade_required", status: 402 };
    }
    const trimmed = name.trim().slice(0, 80);
    if (!trimmed) return { error: "Name required." };
    const id = new ObjectId().toString();
    const row = {
      id,
      user_id: userId,
      name: trimmed,
      slug: slugifyLabel(trimmed),
      description: description.trim().slice(0, 280),
      slugs: [],
      public: Boolean(isPublic),
    };
    this.collections.set(id, row);
    return { collection: row };
  }

  addToCollection(id, userId, slug) {
    const u = this.users.get(userId);
    const c = this.collections.get(id);
    if (!c || c.user_id !== userId) return { error: "Not found." };
    const pro = entitlementsFor(u, this.env).collections == null;
    const maxItems = pro ? PRO_COLLECTION_ITEMS : FREE_COLLECTION_ITEMS;
    if (!c.slugs.includes(slug) && c.slugs.length >= maxItems) {
      if (pro) return { error: `This list is full (${maxItems} papers).`, status: 400 };
      return { error: "upgrade_required", code: "upgrade_required", status: 402 };
    }
    if (!c.slugs.includes(slug)) c.slugs.push(slug);
    return { collection: c };
  }

  createHighlight(userId, { slug, quote, note = "" }) {
    const u = this.users.get(userId);
    if (!u) return { error: "Unauthorized" };
    const q = (quote || "").trim().slice(0, 800);
    const n = (note || "").trim().slice(0, 1000);
    if (!slug || (!q && !n)) return { error: "Highlight a passage or add a note." };
    const cap = entitlementsFor(u, this.env).highlights;
    const count = this.highlights.filter((h) => h.user_id === userId).length;
    if (cap != null && count >= cap) {
      return { error: "upgrade_required", code: "upgrade_required" };
    }
    const row = { id: new ObjectId().toString(), user_id: userId, article_slug: slug, quote: q, note: n };
    this.highlights.push(row);
    return { highlight: row };
  }

  exportNote(userId, articleId) {
    const u = this.users.get(userId);
    if (!u) return { error: "Unauthorized", status: 401 };
    if (!entitlementsFor(u, this.env).export) {
      return { error: "upgrade_required", status: 402, code: "upgrade_required" };
    }
    const a = this.articles.get(articleId);
    if (!a || a.status !== "published") return { error: "Not found", status: 404 };
    return { markdown: articleToMarkdown(a, "https://www.papertrailresearch.co.uk") };
  }

  submit(url, { note, ip = "8.8.8.8", userId = null, website = "" } = {}) {
    if (website) return { success: true, honeypot: true, status: 201 };
    const clean = sanitizeHttpUrl(url);
    if (!clean) return { error: "Please provide a valid URL.", status: 400 };
    if (this.submissions.some((s) => s.url === clean && s.status === "pending")) {
      return { success: true, note: "already awaiting review" };
    }
    const user = userId ? this.users.get(userId) : null;
    const pro = isProUser(user, this.env);
    const ipHash = hashIp(ip);
    if (pro) {
      const used = this.count("submit_day", `user:${userId}`, DAY_MS);
      if (used >= PRO_SUBMISSIONS_PER_DAY) {
        return { error: "Daily suggestion limit reached.", status: 429 };
      }
      this.hit("submit_day", `user:${userId}`, DAY_MS);
    } else {
      const weekKey = userId ? `user:${userId}` : `ip:${ipHash}`;
      const weekUsed = this.count("submit_week", weekKey, WEEK_MS);
      if (weekUsed >= FREE_SUBMISSIONS_PER_WEEK) {
        return { error: "upgrade_required", status: 402, code: "upgrade_required" };
      }
      const ipCount = this.submissions.filter(
        (s) => s.ip_hash === ipHash && this.now - s.at < SUBMIT_IP_WINDOW_MS
      ).length;
      if (ipCount >= SUBMIT_IP_MAX) {
        return { error: "ip_limit", status: 429 };
      }
      this.hit("submit_week", weekKey, WEEK_MS);
    }
    this.submissions.push({
      url: clean,
      note: (note || "").slice(0, 500),
      status: "pending",
      ip_hash: ipHash,
      priority: Boolean(pro),
      user_id: userId,
      at: this.now,
    });
    return { success: true, priority: Boolean(pro), status: 201 };
  }

  inquiry({ name, email, org, seats, note }) {
    if (!name?.trim() || !email?.includes("@") || !org?.trim()) {
      return { error: "name, email, and org required", status: 400 };
    }
    const row = {
      name: name.slice(0, 80),
      email: email.trim().toLowerCase().slice(0, 254),
      org: org.slice(0, 120),
      seats: seats?.slice(0, 40),
      note: note?.slice(0, 500),
    };
    this.inquiries.push(row);
    return { inquiry: row };
  }

  dailyMix(drafts, { force = false, dateKey } = {}) {
    const key = dateKey || new Date(this.now).toISOString().slice(0, 10);
    if (this.mixRuns.has(key) && !force) {
      return { published: 0, skipped: "already_ran", dateKey: key, items: [] };
    }
    const byField = new Map();
    for (const d of drafts) {
      const field = mixFieldOf(d.category);
      if (byField.has(field)) continue;
      const gate = canPublishArticle({
        sourceUrl: d.source_url,
        caveats: d.caveats,
        status: "published",
      });
      if (!gate.ok) continue;
      byField.set(field, d);
      if (byField.size >= 12) break;
    }
    const items = [];
    for (const [field, d] of byField) {
      const res = this.insertDraft(d);
      if (res.article) {
        const pub = this.publish(res.article.id);
        if (pub.article) items.push({ field, slug: pub.article.slug });
      }
    }
    if (items.length > 0) this.mixRuns.add(key);
    return { published: items.length, skipped: null, dateKey: key, items };
  }

  checkout(userId, interval) {
    if (!isBillingConfigured(this.env)) return { error: "Billing is not configured.", status: 503 };
    const u = this.users.get(userId);
    if (!u) return { error: "Unauthorized", status: 401 };
    if (u.stripe_subscription_id && LIVE_STATUSES.has(u.plan_status || "")) {
      return { error: "already subscribed", status: 409 };
    }
    if (interval !== "month" && interval !== "year") return { error: "invalid interval", status: 400 };
    return {
      url: `https://checkout.stripe.com/c/pay/cs_test_${interval}_${userId}`,
      id: `cs_test_${interval}`,
    };
  }

  count(bucket, key, windowMs) {
    const windowId = Math.floor(this.now / windowMs);
    return this.rate.get(`${bucket}:${key}:${windowId}`) || 0;
  }

  hit(bucket, key, windowMs) {
    const windowId = Math.floor(this.now / windowMs);
    const k = `${bucket}:${key}:${windowId}`;
    const n = (this.rate.get(k) || 0) + 1;
    this.rate.set(k, n);
    return n;
  }

  undo(bucket, key, windowMs) {
    const windowId = Math.floor(this.now / windowMs);
    const k = `${bucket}:${key}:${windowId}`;
    const n = this.rate.get(k) || 0;
    if (n > 0) this.rate.set(k, n - 1);
  }
}

export { nid, ObjectId };
