# App setup

## Deployment checklist
Follow in order — later steps depend on earlier ones.

1. **Push to GitHub.** `.gitignore` is already set up to exclude `node_modules`
   and any `.env*` files, so secrets never get committed.
2. **Create a Railway project** from that repo.
3. **Add a MongoDB plugin** to the project (Railway → New → Database → MongoDB).
   It'll expose a connection string, commonly as `MONGO_URL`.
4. **Set env vars** in Railway's dashboard — copy `.env.example`, fill in every
   value (generation instructions for the tricky ones — `AUTH_SECRET`,
   `ADMIN_PASSWORD_HASH` — are in the "Env vars" section below). Social
   posting vars are optional; leave them blank to skip a platform for now.
5. **Create the required MongoDB text index** (search will error without it —
   see "Database" below for the exact command). Connect via `mongosh` using
   the same connection string from step 3.
6. **Deploy.** Railway builds with `npm run build` and runs `npm run start`
   automatically — no extra config needed.
7. **Set `NEXT_PUBLIC_SITE_URL`** to your actual Railway URL once you have one
   (Settings → Networking → Generate Domain), then redeploy — this env var
   feeds the sitemap, RSS feed, and OG image URLs, so it needs to be correct
   before those are meaningful.
8. **Set up the three (or four, if using PubMed) cron schedules** — see "Cron
   jobs on Railway" below for both the in-Railway and external-scheduler options.
9. **Log in at `/login`** with `ADMIN_EMAIL` and the plaintext password you
   hashed into `ADMIN_PASSWORD_HASH`, then process one paper manually via
   `/admin/manual-input` to confirm the whole pipeline works end to end
   before relying on the cron sweeps.
10. **Check `/api/health`** returns `{"status":"ok"}` — confirms both the
    app and its MongoDB connection are actually working, not just that the
    server responds. Worth pointing Railway's own health check at this route.

Everything below this point is reference material for the steps above, not
additional steps — the same information the checklist points to.

## Install
```
npm install
```

## Env vars
All variables are listed in `.env.example` with generation notes for the
tricky ones inline as comments. A few worth calling out:

- **`MONGODB_URI`** — if unset, falls back to Railway's own `MONGO_URL` automatically
- **`AUTH_SECRET`** — signs admin session tokens; any long random string works
- **`ADMIN_PASSWORD_HASH`** — a bcrypt hash, not the plaintext password itself
- **`CRON_SECRET`** — shared secret the cron callers send as a bearer token;
  without it, the cron routes are unauthenticated (fine for testing, not for production)
- **`NEXT_PUBLIC_SITE_URL`** — must be correct before sitemap/RSS/OG images are meaningful
- Everything under "Social posting" is optional and independently skippable
- **Stripe (Paper Trail Pro)** — optional. Without `STRIPE_SECRET_KEY` +
  `STRIPE_PRICE_MONTHLY` + `STRIPE_PRICE_YEARLY`, `/pricing` still renders and
  checkout returns 503. Add a webhook to `POST /api/billing/webhook` with
  `STRIPE_WEBHOOK_SECRET`. Comp accounts with `BILLING_GRANT_EMAILS` or the
  grant form on `/admin/status`.

## Database
No schema migration needed — MongoDB collections are created automatically on
first write. Four collections are used: `articles`, `fetch_queue`,
`scheduled_posts`, and `submissions`. All are managed entirely through
`lib/articles.ts`, `lib/queue.ts`, `lib/scheduledPosts.ts`, and
`lib/submissions.ts` — there's no separate SQL/schema file to run.

**One index is required, not optional:** both the public homepage search bar
and the admin dashboard's search box use MongoDB's built-in `$text` search,
which needs a text index to exist first — search will error without it (a
plain community MongoDB feature, not an Atlas-only one, so this works fine on
Railway's MongoDB plugin). Run this once against your database:
```js
db.articles.createIndex({ title: "text", headline: "text", plain_explanation: "text" });
```

Other indexes are optional but worth adding once you have real traffic:
```js
db.articles.createIndex({ slug: 1 }, { unique: true });
db.articles.createIndex({ status: 1, created_at: -1 });
db.articles.createIndex({ status: 1, category: 1 });
db.articles.createIndex({ source_url: 1 });
db.fetch_queue.createIndex({ source: 1, external_id: 1 }, { unique: true });
db.fetch_queue.createIndex({ status: 1, created_at: 1 });
db.scheduled_posts.createIndex({ status: 1, scheduled_for: 1 });
db.scheduled_posts.createIndex({ article_id: 1 });
db.submissions.createIndex({ status: 1, submitted_at: -1 });
db.submissions.createIndex({ ip_hash: 1, submitted_at: -1 });
db.login_attempts.createIndex({ ip_hash: 1, attempted_at: -1 });
db.login_attempts.createIndex({ attempted_at: 1 }, { expireAfterSeconds: 3600 });
```
The last one is a TTL index — MongoDB automatically deletes login attempt
records an hour after they're created, so this collection doesn't grow forever.

## Two ingestion sources
arXiv covers AI, space, and most physical sciences well, but has essentially
no clinical/medical content — dementia and obesity research live in PubMed,
not arXiv preprints. So there are two independent daily sweeps feeding the
same queue:

- **arXiv** (`cron-fetch` → `lib/paper-extract.ts`) — abstract API + PDF
  text extraction, category from whichever RSS feed it came from
- **PubMed** (`cron-fetch-pubmed` → `lib/pubmed.ts`) — NCBI E-utilities,
  abstract-only (PubMed has no full-text API for most articles — many are
  paywalled at the publisher), category is the search topic itself

Both write into the same `fetch_queue` collection with a `source` field
(`"arxiv"` | `"pubmed"`), and `process-queue` branches on it — one worker,
one retry/backoff mechanism, for both sources. To add or change PubMed
topics, edit `PUBMED_TOPICS` in `lib/arxivCategories.ts`.

**If you already had data in `fetch_queue` from before this change:** the
field names changed (`arxiv_id`/`abs_url` → `external_id`/`url`, plus a new
required `source` field) to stop being arXiv-specific. Old pending rows won't
match the new queries — either clear the collection (`db.fetch_queue.deleteMany({})`)
or manually add `source: "arxiv"` and rename the fields on existing documents.

## Categories & search
Every article is tagged with a `category` — set automatically from whichever
arXiv category feed it came from (`lib/arxivCategories.ts` holds the code →
label mapping), or editable manually in the admin editor for raw-text
submissions, which have no arXiv metadata to infer it from. The homepage shows
filter pills for any category with at least one published article, plus a
search box (`$text` search across title/headline/plain_explanation) — both are
plain URL params (`/?q=...&category=...`), so they combine and are shareable/bookmarkable.

To track a different set of categories, edit `ARXIV_CATEGORY_LABELS` in
`lib/arxivCategories.ts` (this drives both the `cron-fetch` sweep default
and the homepage filter pills) — or override just the sweep via
`ARXIV_RSS_CATEGORIES` without changing the labels file.

## Auth
There's no users collection — this app has a single admin account configured
entirely through env vars (`ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH`). Sessions are
a signed JWT in an httpOnly cookie (`lib/auth.ts`), verified in
`middleware.ts` for every `/admin/*` route, and independently re-checked
inside each sensitive API route (`requireAdmin()` in `lib/auth-server.ts`)
as defense in depth.

## Production checks
A review pass specifically for "is this safe and reliable to run for real,"
separate from the deployment steps above. What was fixed, and what was
checked and found fine as-is:

**Fixed:**
- **MongoDB connection wasn't self-healing.** If the very first connection
  attempt failed (a transient blip during a cold start), the rejected
  connection promise was cached forever — every request after that would
  fail the same way until the process restarted, even once Mongo was
  reachable again. `lib/mongodb.ts` now clears the cache on failure so
  the next request gets a fresh attempt instead of replaying a stale error.
  Production also reuses a single client promise for the process lifetime
  (required on Railway's long-running Node server).
- **Login had no rate limiting.** A single admin account with unlimited
  password guesses is a straightforward brute-force target. `/api/auth/login`
  now blocks an IP for 15 minutes after 5 failed attempts
  (`lib/loginAttempts.ts`), independent from `lib/auth.ts` since that
  file is imported by edge middleware and can't use the mongodb driver.
- **No security headers.** Added the standard baseline in `next.config.ts`:
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, `Strict-Transport-Security`, plus an explicit
  `X-Robots-Tag: noindex` on every `/admin/*` response as defense in depth
  alongside `robots.txt`.
- **No health check.** `/api/health` now pings MongoDB and returns 503 if
  it can't connect — point Railway's health check (or an external uptime
  monitor) at this instead of just checking that the server responds at all.

**Checked, found fine:**
- **XSS** — no `dangerouslySetInnerHTML` anywhere in the codebase; all
  article content renders through React's default escaping.
- **NoSQL injection** — every route that takes public input type-checks
  with `typeof x === "string"` (or equivalent) before that value ever
  reaches a MongoDB query, which blocks the classic "pass an object with a
  `$` operator instead of a string" attack. IDs go through `ObjectId.isValid()`
  before use.
- **CSRF** — session cookies are `httpOnly` + `sameSite: "lax"`, which
  modern browsers won't attach on cross-site `fetch`/XHR POST requests, so
  a malicious site can't ride a logged-in admin's session to make authenticated
  writes.

**Deliberately not done:** a strict Content-Security-Policy. CSP is high-value
but needs testing against every external resource this app actually loads
(Google Fonts, the `next/og`-generated images, `next/image` optimization) —
getting it wrong silently breaks things rather than failing loudly, and that's
not something to ship unverified. Worth adding once you can test it against a
real running deploy.

## Deploying to Railway
The sequence is in the checklist at the top of this doc. One detail worth
elaborating: Railway builds with `npm run build` and runs `npm run start` by
default, no extra config needed — this is a normal long-lived Node server
(not serverless), so none of Vercel's edge/serverless constraints apply here.

### Cron jobs on Railway
Railway doesn't have Vercel-style declarative cron for hitting an HTTP route
on your main service (a cron schedule on a service replaces its normal start
command, which doesn't work for an always-on web server). Two options:

**Option A — separate lightweight Railway services** (stays on Railway):
Add extra services in the same project, each with a cron schedule and a
start command like:
```
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://your-app.up.railway.app/api/cron-fetch
```
Four schedules needed:
- `/api/cron-fetch` — once daily (arXiv sweep)
- `/api/cron-fetch-pubmed` — once daily (PubMed sweep — dementia, obesity, population growth)
- `/api/process-queue` — every 10 minutes (does the actual extraction + translation for both sources)
- `/api/process-scheduled-posts` — every 5 minutes (so scheduled social posts fire close to their requested time)

**Option B — external scheduler** (simpler, no extra Railway services):
Use GitHub Actions (a scheduled workflow) or a free service like
cron-job.org to hit the same URLs with the `CRON_SECRET` bearer token.

## Manual trigger
Two submission modes, both via `/admin/manual-input` or directly:
```
POST /api/process-paper
Content-Type: application/json

{ "url": "https://arxiv.org/abs/2401.12345" }
```
```
POST /api/process-paper
Content-Type: application/json

{ "rawText": "…paste the abstract or paper text (200+ chars)…", "sourceUrl": "https://required-citation-link.com" }
```
The `url` path is arXiv-specific (abstract API + PDF text extraction). The
`rawText` path is for paywalled or non-arXiv sources where automatic extraction
isn't reliable — `sourceUrl` is required either way, since every article here
must link back to its source.

## Social posting setup
Sharing lives on each article's admin page once it's published
(`src/components/ShareSection.tsx`). Nothing here is required — every
platform degrades gracefully to "not configured" if you skip it.

**X (Twitter)** — as of Feb 2026, X's API has no free tier: posts cost
roughly $0.015–0.02 each, **plus $0.20 extra for any post containing a link**
(which every article post does). Because of that, X uses a free one-click
share-intent link instead (opens a pre-filled tweet — no API, no cost). The
real API path exists in `src/lib/social/x.ts` and is fully wired up, but
stays off unless you explicitly set `ENABLE_X_API_POSTING=true` — check
developer.x.com for current pricing before turning it on.

**Facebook** — free. You need:
1. A Meta Developer account and a Business-type app (developers.facebook.com)
2. A Facebook Page you manage
3. A long-lived Page Access Token with `pages_manage_posts` — for posting to
   your own Page, this works in the app's Development mode without waiting
   on Meta's App Review process (review is only required to post on behalf
   of accounts you don't own)
4. Set `FACEBOOK_PAGE_ID` and `FACEBOOK_PAGE_ACCESS_TOKEN`

**Instagram** — free, but has real requirements: your account must be a
Business or Creator account linked to a Facebook Page (personal accounts
can't use this API at all). Uses the same Meta Developer app as Facebook,
plus the Instagram Graph API product and `instagram_content_publish`
permission — again, Development mode is enough for posting to your own
linked account. Instagram has no text-only posts, so this uses the
auto-generated cover image (`/posts/[slug]/opengraph-image`) as the media.
Set `INSTAGRAM_BUSINESS_ACCOUNT_ID` and `INSTAGRAM_ACCESS_TOKEN` (or reuse
`FACEBOOK_PAGE_ACCESS_TOKEN` if it has both scopes).

**Reddit** — free, simplest of the four. Create a "script" type app at
reddit.com/prefs/apps (no review process for personal use). Set
`REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USERNAME`,
`REDDIT_PASSWORD`, and `REDDIT_SUBREDDIT` (which subreddit to post link
posts to — test with something like `r/test` first).

Meta's Graph API version pins (`v21.0` in `facebook.ts` / `instagram.ts`)
should be checked against developers.facebook.com/docs/graph-api/changelog
periodically — Meta deprecates old versions on a rolling schedule.

## Public submissions
Anyone can suggest a paper at `/submit` — this deliberately does **not** call
the AI translator or create a draft. It only stores the link (plus an optional
note) in `submissions`, rate-limited to 3 per IP per hour (hashed, not stored
raw) with a honeypot field for basic bot deterrence. An editor reviews
suggestions at `/admin/submissions` and either **Process**es one (which opens
`/admin/manual-input` pre-filled with the URL — from there it goes through the
exact same draft → review → publish flow as any other submission) or
**Dismiss**es it. Nothing a visitor submits can reach the public site, or even
trigger a paid API call, without that manual step.

## Routes overview
- `/` — public feed of published articles
- `/posts/[slug]` — public article view
- `/submit` — public "suggest a paper" form
- `/login` — admin sign-in
- `/admin` — dashboard listing all drafts/published articles (auth required)
- `/admin/[id]` — review/edit/publish/share a single article (auth required)
- `/admin/manual-input` — paste a URL or raw text to run the pipeline on demand
- `/admin/submissions` — review visitor-suggested papers (auth required)
- `POST /api/auth/login`, `POST /api/auth/logout` — session management
- `POST /api/submissions` — public, rate-limited; stores a suggestion, no LLM call
- `GET /api/submissions`, `PATCH /api/submissions/[id]` — review/dismiss (auth required)
- `POST /api/process-paper` — runs extraction + translation + saves as draft (admin session required)
- `GET /api/cron-fetch` — daily arXiv RSS sweep, enqueues only (CRON_SECRET required)
- `GET /api/cron-fetch-pubmed` — daily PubMed topic sweep, enqueues only (CRON_SECRET required)
- `GET /api/process-queue` — queue worker for both sources, does the actual extraction + translation (CRON_SECRET required)
- `PATCH /api/articles/[id]` — update fields / change status (auth required)
- `DELETE /api/articles/[id]` — delete an article (auth required)
- `POST /api/articles/[id]/share` — post a published article to facebook/instagram/reddit/x (auth required)
- `POST /api/articles/[id]/schedule`, `GET /api/articles/[id]/schedule` — schedule/list social posts for an article (auth required)
- `DELETE /api/scheduled-posts/[id]` — cancel a pending scheduled post (auth required)
- `GET /api/process-scheduled-posts` — worker that fires due scheduled posts (CRON_SECRET required)
- `GET /api/health` — checks the app is up and can reach MongoDB (for Railway monitoring or an external uptime checker)
- `/posts/[slug]/opengraph-image` — auto-generated branded cover image per article
- `/feed.xml` — RSS feed of published articles
- `/sitemap.xml`, `/robots.txt` — SEO

## Design system
Public pages (`/`, `/posts/[slug]`) use a "field notes" identity: cool paper-grey
background, navy ink type, and a proofreader's-red accent (`redpen`) used sparingly —
most visibly as the hand-drawn underline on the homepage hero (`.redpen-mark` in
`globals.css`). Headlines use Fraunces (serif, editorial), body copy stays on Inter,
and metadata/labels use IBM Plex Mono to read like typed index-card annotations.
Admin pages are intentionally left plain/utilitarian since they're an internal tool,
not the branded surface. All tokens live in `tailwind.config.ts`.

## Known gaps / next steps
- Cover images are generated typographically (title + headline), not extracted from
  the paper's actual figures — deliberate, since reproducing copyrighted figures from
  papers on a public site is a real copyright risk
- The queue and scheduler are both polling-based rather than event-driven — fine at
  this scale, and `process-scheduled-posts` should run every ~5 minutes for posts to
  fire close to their requested time
- X posting via the API is opt-in and off by default due to per-post cost — scheduling
  is available for X too if you enable `ENABLE_X_API_POSTING`, but isn't recommended
  given the free share-link alternative
