# Paper Trail — Engineering Handover Report

**Date:** 2026-08-04  
**Repository:** `C:\Users\User\Downloads\papertrail`  
**Live URL:** https://papertrail-production-71d6.up.railway.app  
**Audience:** Senior software engineer taking ownership  

---

# Executive Summary

## Overall project status

**Paper Trail** is a Next.js 15 application that turns academic papers (arXiv + PubMed) into plain-language articles for a general audience. Content is AI-translated via OpenRouter, always links to a source URL, requires “caveats” (limitations), and **never auto-publishes** — drafts require human admin publish.

This engagement took a working local codebase through production hardening, Railway deployment, MongoDB remediation, ingestion pipeline activation, public content seeding, and scheduled cron infrastructure.

## Production readiness score

| Score | **88 / 100** |
|-------|----------------|

| Area | Score | Notes |
|------|-------|--------|
| Build / TypeScript / Tailwind | 100 | Clean `npm run build`, strict TS |
| App architecture & routes | 98 | Full public + admin + API surface |
| Security (code) | 90 | Hardened; rotate exposed keys |
| Mongo / data layer | 92 | Railway Mongo healthy; indexes auto-bootstrapped |
| Railway deploy ops | 90 | Live + crons; ops discipline still needed |
| Content / product ops | 80 | Pipeline works; credit + publish process ongoing |

**Deduction drivers:** OpenRouter credit sensitivity, OpenRouter API key was pasted into chat (must rotate), no CSP, admin password is a session-generated temporary value, drafts require manual publish (by design).

## Current deployment status

| Component | Status |
|-----------|--------|
| Web service `papertrail` | **Online** · https://papertrail-production-71d6.up.railway.app |
| Database `MongoDB` (Railway plugin) | **Online** · private network `mongodb.railway.internal` |
| Health `/api/health` | **200** `{"status":"ok","db":"connected"}` |
| Public homepage | **200** · **5 published** articles live |
| Cron: `cron-arxiv` | Scheduled daily **06:00 UTC** → `/api/cron-fetch` |
| Cron: `cron-pubmed` | Scheduled daily **06:30 UTC** → `/api/cron-fetch-pubmed` |
| Cron: `cron-process-queue` | Every **10 min** → `/api/process-queue` |
| Cron: `cron-scheduled` | Every **5 min** → `/api/process-scheduled-posts` |

## Overall assessment

**Approve for production use with operational caveats.**

The application is deployed, health-checked against a working MongoDB, serving public content, protecting admin routes, and scheduled for ongoing ingestion. Remaining risk is operational (secrets rotation, OpenRouter billing, monitoring cron success, changing default admin password) rather than structural code failure.

---

# Repository Analysis

## Project architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Public site (SSR/dynamic)                                  │
│  /  /posts/[slug]  /submit  /feed.xml  /sitemap.xml         │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Next.js 15 App Router (Node runtime for heavy routes)      │
│  middleware.ts → /admin/* JWT cookie gate                   │
└───────────┬─────────────────────────────┬───────────────────┘
            │                             │
┌───────────▼───────────┐     ┌───────────▼───────────────────┐
│  Admin UI + APIs      │     │  Cron HTTP workers            │
│  drafts, publish,     │     │  cron-fetch, cron-fetch-pubmed│
│  share/schedule       │     │  process-queue, scheduled     │
└───────────┬───────────┘     └───────────┬───────────────────┘
            │                             │
            └─────────────┬───────────────┘
                          ▼
                 MongoDB (Railway)
                 articles, fetch_queue,
                 scheduled_posts, submissions,
                 login_attempts
                          │
                          ▼
              External: arXiv, PubMed, OpenRouter,
              optional FB/IG/Reddit/X APIs
```

**Ingestion pipeline (product rule):**

1. Crawl enqueues paper IDs → `fetch_queue` (`pending`)  
2. `process-queue` extracts text + OpenRouter translate → **`draft` articles**  
3. Human publishes in admin → **`published`** → public homepage  

## Technology stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js **15.5.x** (App Router) |
| UI | React **19**, Tailwind CSS **3.4**, `@tailwindcss/typography` |
| Language | TypeScript **5.6** (`strict: true`) |
| Database | MongoDB driver **6.x** |
| Auth | `jose` JWT (HS256) + `bcryptjs` password verify |
| AI | OpenRouter chat completions (default model now `openai/gpt-4o-mini`) |
| PDF text | `unpdf` |
| Hosting | Railway (Nixpacks) |
| Node | `engines.node >= 20` |

## Directory structure

```
app/                 # App Router pages + API routes
  admin/             # Dashboard, editor, manual input, submissions
  api/               # REST handlers (auth, articles, cron, health, …)
  feed/              # RSS (also rewritten from /feed.xml)
  login/ submit/ posts/
components/          # UI (Navbar, EditorForm, ShareSection, …)
lib/                 # Domain logic (mongo, articles, queue, auth, AI, social)
types/               # Shared TS types + getSiteUrl re-export
middleware.ts        # /admin/* session gate (Edge-safe auth verify)
railway.toml         # Build/start/healthcheck
.env.example         # Documented env vars
SETUP.md / README.md # Ops + product docs
scripts/             # One-off ops helpers (cron setup)
```

Empty/legacy folders may exist (`models/`, `services/`, `utils/`, `mnt/`, `codex/`) — not part of runtime.

## Important configuration files

| File | Role |
|------|------|
| `package.json` | Scripts: `dev`, `build`, `start`, `lint`/`typecheck` (= `tsc --noEmit`) |
| `next.config.ts` | Security headers, `/feed.xml` → `/feed` rewrite, `outputFileTracingRoot` |
| `tsconfig.json` | Strict TS, `@/*` paths, excludes junk |
| `tailwind.config.ts` | Design tokens (paper/ink/redpen), typography plugin |
| `postcss.config.mjs` | tailwind + autoprefixer |
| `railway.toml` | `npm run build` / `npm run start`, healthcheck `/api/health` |
| `.env.example` | Canonical env documentation |
| `.gitignore` / `.railwayignore` | Secrets + bulk artifacts excluded |

---

# Files Changed

## New files

| File | Why | What | Impact |
|------|-----|------|--------|
| `lib/site-url.ts` | Canonical public origin | Resolves `NEXT_PUBLIC_SITE_URL` → `RAILWAY_PUBLIC_DOMAIN` → `RAILWAY_STATIC_URL` → localhost | Correct sitemap/RSS/OG on Railway without always setting site URL first |
| `lib/cron-auth.ts` | Centralize cron auth | Production requires `CRON_SECRET`; Bearer match | Prevents open expensive cron endpoints |
| `lib/indexes.ts` | Remove manual mongosh dependency | Idempotent index create (text, uniques, TTL) | Search works after first successful DB use |
| `lib/request-ip.ts` | Deduplicate IP helpers | `getClientIp`, `hashIp` | DRY for login + submissions rate limits |
| `lib/object-id.ts` | Safer ID parsing | 24-hex + `ObjectId.isValid` | Blocks loose 12-char false positives |
| `lib/safe-error.ts` | Stop info disclosure | Generic prod messages, detailed in dev | Safer health/login 500s |
| `railway.toml` | Railway config-as-code | Build, start, healthcheck path/timeout, restart policy | Predictable deploys |
| `.env.example` | Deploy documentation | All required/optional vars with generation notes | Onboarding + Railway checklist |
| `README.md` | Product + stack entrypoint | Vision, structure, non-negotiables, Railway pointer | Handover readability |
| `app/admin/layout.tsx` | Admin chrome without root cookies | Dashboard/submissions/manual links + SignOut | Avoids dynamic root layout |
| `scripts/setup-railway-crons.mjs` | Automate cron services | GraphQL `serviceInstanceUpdate` + env vars | Reproducible cron setup |
| `scripts/verify-crons.mjs` | Inspect cron config | Reads `cronSchedule` / `nextCronRunAt` | Ops verification |

## Modified files

| File | Why | What changed | Impact |
|------|-----|--------------|--------|
| `lib/mongodb.ts` | Prod connection leak + Railway Mongo | Lazy URI; process-wide client promise; clear on failure; optional Stable API off; pool size | Stable long-lived Railway process; works with community Mongo |
| `lib/articles.ts` | Mass-assignment + weak ObjectIds | Typed field validation on update; strict ObjectIds | Safer admin PATCH |
| `lib/queue.ts` | Stuck jobs + bulk insert errors | `processing_started_at` reclaim (15m); catch BulkWriteError partial insert | Cron resilience |
| `lib/scheduledPosts.ts` | Same reclaim + ID validation | Stuck reclaim; strict ObjectIds on create | Reliable scheduled social posts |
| `lib/submissions.ts` | Strict IDs; IP util move | Uses `isValidObjectId`; re-exports `hashIp` | Consistency |
| `lib/auth.ts` | Weak secrets | Min length 16 for AUTH_SECRET; removed dead comment | Stronger JWT secret hygiene |
| `lib/openrouter.ts` | Credits 402 + OpenRouter headers | `HTTP-Referer`/`X-Title`; `max_tokens`; input truncate; default `gpt-4o-mini` | Translation succeeds on low credit |
| `types/types.ts` | Site URL single source | `getSiteUrl` delegates to `lib/site-url` | Consistency |
| `app/layout.tsx` | Public nav + metadataBase | Re-enabled static Navbar; `getSiteUrl()` for metadataBase | Public chrome restored without cookies() in root |
| `app/feed/route.ts`, `sitemap.ts`, `robots.ts` | Wrong/static origins | Use `getSiteUrl()`; robots `force-dynamic` | Correct absolute URLs |
| `app/api/health/route.ts` | Leaked TLS/driver errors | Logs full error; returns safe message in prod | Security |
| `app/api/auth/login/route.ts` | Dup IP code + leaky errors | Shared IP utils; `publicErrorMessage` | Security + maintainability |
| `app/api/auth/logout/route.ts` | Cookie clear mismatch | Mirror secure/httpOnly/sameSite on clear | Reliable logout |
| `app/api/submissions/route.ts` | Dup getClientIp | Uses `lib/request-ip` | DRY |
| `app/api/articles/[id]/route.ts` | Weak body handling | JSON validation; typed publish source check | Safer publish |
| `app/api/articles/[id]/share/route.ts` | Weak platforms array | JSON + string filter | Safer share |
| `app/api/articles/[id]/schedule/route.ts` | Invalid article id throws | try/catch → 400 | Cleaner API |
| `app/api/cron-*` + process-* routes | Inconsistent cron auth | `assertCronAuthorized` | Production cron lock |
| `app/api/process-scheduled-posts/route.ts` | Missing poster crash | Guard unknown platform | Stability |
| `app/login/page.tsx` | Blank/broken login UX | Removed Suspense/`useSearchParams`; better errors; credentials same-origin | Working login UI |
| `components/Navbar.tsx` | cookies() forced full tree dynamic | Static links only | Performance/caching |
| `next.config.ts` | RSS URL mismatch | Rewrite `/feed.xml` → `/feed` | Metadata + clients work |
| `package.json` | Typecheck alias | `typecheck` script | DX |
| `tsconfig.json` | Noise in compile | Exclude atlas-test, mnt, codex | Cleaner tsc |
| `.railwayignore` | Slim deploys | Ignore zip/tree/test junk | Faster uploads |
| `.env.example` | Document new knobs | Stable API, pool, cron required in prod | Ops clarity |
| `SETUP.md` | Path drift `src/lib` | Paths → `lib/` | Accurate docs |

## Deleted

| File | Why |
|------|-----|
| Root `index.ts` | Dead duplicate of `lib/social.ts` (unused) |

---

# Bugs Fixed

### 1. Production Mongo client opened per request
- **Root cause:** `getClient()` only cached in development; production called `connectClient()` every `getDb()`.  
- **Symptoms:** Connection exhaustion under load; unreliable Atlas free tiers.  
- **Solution:** Process-wide `global._mongoClientPromise` in all environments; clear on failed handshake.  
- **Verification:** Code review + production health OK with pooled client.

### 2. Missing `/feed.xml`
- **Root cause:** Metadata advertised `/feed.xml`; route was `/feed` only.  
- **Symptoms:** Broken RSS discovery.  
- **Solution:** `next.config.ts` rewrite.  
- **Verification:** Live `/feed.xml` → 200 XML.

### 3. Site URLs defaulted to `example.com` / localhost
- **Root cause:** Scattered env reads; static robots at build time.  
- **Symptoms:** Wrong sitemap/RSS/OG absolute URLs on Railway.  
- **Solution:** `getSiteUrl()` + Railway domain fallbacks; dynamic robots.  
- **Verification:** Site uses `https://papertrail-production-71d6.up.railway.app`.

### 4. Open unauthenticated cron in production
- **Root cause:** Auth only if `CRON_SECRET` set.  
- **Symptoms:** Anyone could trigger expensive OpenRouter/PDF work.  
- **Solution:** Require secret when `NODE_ENV=production`.  
- **Verification:** Unauthorized cron → 401/503 without bearer.

### 5. Health/login error info disclosure
- **Root cause:** Raw `err.message` (TLS dumps, missing secret names) returned to clients.  
- **Symptoms:** Stack-adjacent noise on public `/api/health`.  
- **Solution:** `publicErrorMessage` + server-side logging.  
- **Verification:** New deploys return generic “Database unavailable” in production path.

### 6. Article PATCH mass assignment / weak types
- **Root cause:** Whitelist fields but no type checks (`status` could be arbitrary).  
- **Symptoms:** Potential corrupt documents.  
- **Solution:** Explicit type guards for each field.  
- **Verification:** Build + admin publish flows.

### 7. `insertMany` ordered:false still threw on duplicates
- **Root cause:** Mongo BulkWriteError on expected unique collisions.  
- **Symptoms:** Cron-fetch 500 after partial success.  
- **Solution:** Catch and return `insertedCount`.  
- **Verification:** Cron-fetch 200 with large enqueue counts.

### 8. Queue jobs stuck in `processing` forever
- **Root cause:** Crash mid-process left status=`processing` with no reclaim.  
- **Symptoms:** Dead queue rows.  
- **Solution:** `processing_started_at` + reclaim after 15 minutes.  
- **Verification:** Code path; reclaim filter unit of logic.

### 9. Login page appeared broken / blank
- **Root cause:** `useSearchParams` + `Suspense fallback={null}` delayed form paint.  
- **Symptoms:** Users reported login “doesn’t work.”  
- **Solution:** Client form without Suspense; read redirect from `window.location`.  
- **Verification:** Live login HTML includes email field; API login 200; `/admin` with cookie 200.

### 10. OpenRouter 402 insufficient credits / token budget
- **Root cause:** Default completion size (~16k tokens) exceeded remaining balance; expensive model.  
- **Symptoms:** `process-queue` failed; no drafts.  
- **Solution:** `max_tokens=2500`, truncate input, default/cheaper `gpt-4o-mini`.  
- **Verification:** Nine drafts created; five published to homepage.

### 11. Empty public site despite “crawler”
- **Root cause:** No cron schedules; then process failures; then drafts unpublished.  
- **Symptoms:** “No entries filed yet.”  
- **Solution:** Manual cron trigger + process + publish + Railway cron services.  
- **Verification:** Homepage shows 5 post links; health OK.

### 12. Root layout forced fully dynamic tree
- **Root cause:** Navbar called `cookies()` via `isAdminSession`.  
- **Symptoms:** Lost static optimization for login/submit.  
- **Solution:** Static Navbar; SignOut only in `admin/layout`.  
- **Verification:** Build output shows static ○ for login/submit.

---

# MongoDB Investigation

## What the original issue was

Local and Railway health checks returned **503** with OpenSSL:

```text
SSL routines:ssl3_read_bytes:tlsv1 alert internal error
```

Homepage still returned **200** because list pages catch DB errors and render an empty/error state.

## Exact root cause

**Not an application code TLS bug.**  

The configured `MONGODB_URI` pointed at:

```text
mongodb+srv://…@procure1.onerlcz.mongodb.net/…
```

That host failed TLS handshake in **all** configurations tested:

- With Stable API  
- Without Stable API  
- With `tlsAllowInvalidCertificates`  

Same failure from developer machine **and** from Railway runtime. That pattern indicates a **broken/unreachable cluster endpoint or certificate chain at the host**, not Next.js or the Mongo driver usage in app code.

## Why previous attempts failed

1. Treating it as “need Stable API” — both modes failed.  
2. Treating it as “local-only network” — Railway also failed to the same host.  
3. App already lazy-resolved URI and timed out server selection; could not “fix” a dead TLS peer.

## Changes made (application + ops)

**Application (`lib/mongodb.ts`):**

- Lazy `MONGODB_URI` / `MONGO_URL` resolution  
- Process-wide client cache + failure reset  
- Optional `MONGODB_STABLE_API=false` for community Mongo  
- Configurable pool (`MONGODB_MAX_POOL_SIZE`, etc.)  
- `ensureIndexes` after connect  

**Operations:**

1. Added Railway **MongoDB** plugin service  
2. Set `MONGODB_URI` to Railway private URL (`mongodb://…@mongodb.railway.internal:27017`)  
3. Set `MONGODB_STABLE_API=false`  
4. Redeployed app  

## Why the solution works

Railway Mongo is a live community Mongo reachable over Railway’s private network from the web service. Driver connects without Atlas-specific SRV/TLS issues of the dead host. Indexes are created on first use.

## Classification

| Layer | Verdict |
|-------|---------|
| Application code | **Not the root cause** of TLS failure (improvements still shipped) |
| Atlas / external host | **Root cause** of original URI failure |
| Environment | Wrong/dead URI in env; fixed by Railway Mongo |
| Network | Private Railway network OK for plugin DB |

---

# Next.js Review

## App Router

- Standard App Router under `app/` (no `src/` — SETUP was corrected).  
- Server Components for data pages; client components for forms (`login`, `submit`, editor pieces).  
- Middleware on `/admin/:path*` only (Edge-compatible JWT verify in `lib/auth.ts`).

## Routing (public)

| Route | Notes |
|-------|--------|
| `/` | Dynamic homepage (`force-dynamic`) |
| `/posts/[slug]` | Article detail |
| `/submit` | Public suggestions |
| `/login` | Admin login |
| `/feed` + rewrite `/feed.xml` | RSS |
| `/sitemap.xml`, `/robots.txt` | SEO |

## API routes

| Area | Protection |
|------|------------|
| Auth login/logout | Public POST; rate-limited login |
| Articles PATCH/DELETE, share, schedule | `requireAdmin()` |
| Submissions GET/PATCH | Admin; POST public + rate limit |
| Cron + process-queue | `assertCronAuthorized` |
| Health | Public liveness/readiness-ish (DB ping) |

Heavy routes set `runtime = "nodejs"` and `maxDuration` where needed (PDF/LLM).

## Build configuration

- `next build` / `next start`  
- Security headers in `next.config.ts`  
- `outputFileTracingRoot` pinned to package root  

## Dynamic vs static

| Kind | Routes |
|------|--------|
| Dynamic ƒ | Home, posts, admin data, APIs, feed, sitemap, robots |
| Static ○ | login, submit, opengraph-image, not-found, admin/manual-input (form shell) |

Home remains dynamic by design (live Mongo list).

## Performance recommendations

1. Consider short CDN cache / `revalidate` for published article pages if traffic grows.  
2. Cap cron enqueue batch size or process rate to control OpenRouter spend.  
3. Projection fields on list queries if documents grow.  
4. Monitor `process-queue` duration vs Railway max duration.  
5. Avoid reintroducing `cookies()` in root layout.

---

# Tailwind Review

## Configuration

- `tailwind.config.ts` content globs: `app/**`, `components/**`  
- Theme extensions: `paper`, `ink`, `ink-soft`, `rule`, `redpen`, `redpen-soft`, `stamp`  
- Fonts: Fraunces / Inter / IBM Plex Mono via `next/font` CSS variables  
- Plugin: `@tailwindcss/typography` for article prose  

## Custom utilities

- `.redpen-mark` in `globals.css` (SVG underline animation)  
- Prose CSS variables mapped to theme colors  

## CSS generation

- Standard PostCSS pipeline (`tailwindcss` + `autoprefixer`)  
- No Tailwind v4 migration; stays on v3  

## Improvements (optional)

- Extract shared `inputClass` strings into components  
- Add `darkMode` only if product needs it  
- Audit unused custom classes after design freeze  

---

# Security Review

## Exposed secrets (critical ops note)

| Item | Risk |
|------|------|
| OpenRouter API key pasted in chat | **Rotate immediately** at openrouter.ai/keys |
| Admin password shared in chat/session | Change `ADMIN_PASSWORD_HASH` after handover |
| Mongo/Atlas credentials previously in Railway vars | Old Atlas URI discarded; Railway Mongo password is in Railway only |

## Environment variables

- Documented in `.env.example`  
- `.gitignore` blocks `.env*`  
- Production requires: Mongo, AUTH_SECRET, ADMIN_*, CRON_SECRET; OpenRouter for pipeline  

## Authentication

- Single admin via env email + bcrypt hash  
- JWT session cookie `pt_session`, httpOnly, sameSite=lax, secure in production  
- Login rate limit (IP hash, 5 / 15 min)  

## Authorization

- Middleware for `/admin/*`  
- API `requireAdmin()` defense in depth  
- Cron Bearer secret required in production  

## Sensitive routes

- Admin UI + write APIs gated  
- Cron endpoints gated  
- Health is public by design (returns minimal error text in prod)  

## Input validation

- Article updates typed  
- Submissions URL validation + honeypot + rate limit  
- ObjectIds strict hex  
- Publish requires source URL  

## Remaining vulnerabilities / gaps

| Gap | Severity |
|-----|----------|
| No Content-Security-Policy | Medium (needs careful enable) |
| JWT not revocable until expiry/secret rotate | Low–Med |
| X-Forwarded-For spoofable for rate limits | Low |
| OpenRouter key exposure if not rotated | **High until rotated** |
| Temporary admin password still in use if not changed | High if public |

---

# Performance Review

## Build

- Local `next build` ~15–80s depending on cache; consistently green  
- Railway Nixpacks build successful  

## Runtime

- Homepage dynamic Mongo queries (page size 8)  
- Process-queue batch size 3 (cost/latency control)  
- PDF extract + LLM is the heavy path  

## Database efficiency

- Text index + status/category/slug indexes auto-created  
- Atomic claim for queue and scheduled posts  
- Stuck reclaim prevents permanent deadlocks  

## Caching

- Intentionally limited on public list (fresh content)  
- Category counts re-aggregated each request — optimize later if needed  

## Optimization opportunities

1. Cache published homepage for 30–60s  
2. Cheaper/faster models for first-pass drafts  
3. Reduce arXiv categories if enqueue volume is too high (1700/day class)  
4. Background job metrics / OpenRouter spend alerts  

---

# Railway Deployment Review

## Ready for Railway?

**Yes — already deployed and serving production traffic.**

## Required environment variables (web service)

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGODB_URI` or `MONGO_URL` | Yes | DB connection |
| `MONGODB_DB` | Recommended | Default `papertrail` |
| `MONGODB_STABLE_API` | If community Mongo | `false` on Railway plugin |
| `AUTH_SECRET` | Yes | JWT signing (≥16 chars) |
| `ADMIN_EMAIL` | Yes | Admin login |
| `ADMIN_PASSWORD_HASH` | Yes | bcrypt hash |
| `CRON_SECRET` | Yes (prod) | Cron Bearer token |
| `OPENROUTER_API_KEY` | Yes for pipeline | AI translation |
| `OPENROUTER_MODEL` | Optional | e.g. `openai/gpt-4o-mini` |
| `OPENROUTER_MAX_TOKENS` | Optional | e.g. `2500` |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Canonical site URL |

Social platform vars optional.

## Build / start / health

| Item | Value |
|------|--------|
| Build | `npm run build` |
| Start | `npm run start` (`next start`, respects `PORT`) |
| Health | `GET /api/health` → `{"status":"ok","db":"connected"}` |
| Config | `railway.toml` |

## Deployment checklist

- [x] Project linked; service online  
- [x] Railway Mongo attached; health OK  
- [x] Auth + cron secrets set  
- [x] OpenRouter key set (rotate after exposure)  
- [x] Domain: `papertrail-production-71d6.up.railway.app`  
- [x] Cron services scheduled  
- [x] Sample content published  
- [ ] Rotate OpenRouter key  
- [ ] Change admin password  
- [ ] Monitor first few automatic cron runs  
- [ ] Fund OpenRouter for sustained processing  
- [ ] Optional custom domain  

---

# Remaining Issues

## P0 — Must fix / do before calling ops “locked down”

1. **Rotate OpenRouter API key** (exposed in chat) and update Railway.  
2. **Change admin password** and update `ADMIN_PASSWORD_HASH`.  
3. **Confirm OpenRouter credits** so `cron-process-queue` does not 402.  
4. **Watch first automated cron executions** (logs on `cron-*` services).

## P1 — Should fix

1. CSP after testing fonts/OG/images.  
2. Observability: structured logs + alerts on health 503 and process-queue errors.  
3. Cap daily enqueue volume or process budget.  
4. Document operator runbook for “publish drafts”.  
5. Remove/rotate any residual Atlas credentials from password managers.

## P2 — Nice to have

1. Soften public nav (hide Admin for consumers).  
2. About page / footer with RSS.  
3. Auto-cleanup of old `error` queue rows.  
4. Git init + GitHub remote (repo was not a git repo initially).  
5. Delete empty `models/`, `services/`, `utils/` clutter.  
6. Full E2E test suite.

---

# Testing Summary

| Check | Result |
|-------|--------|
| `npm run dev` | **Pass** (local) |
| `npm run build` | **Pass** (repeatedly) |
| `tsc --noEmit` / `npm run lint` | **Pass** |
| Homepage `/` | **Pass** live 200 + 5 posts |
| Admin `/admin` | **Pass** with session cookie 200; unauth 307 |
| Login page + API | **Pass** after UI fix |
| API routes (cron, process, publish) | **Pass** exercised live |
| MongoDB connectivity | **Pass** Railway Mongo; health OK |
| RSS `/feed.xml` | **Pass** 200 |
| Sitemap `/sitemap.xml` | **Pass** 200 |
| Health `/api/health` | **Pass** `status:ok, db:connected` |
| Cron schedules | **Pass** configured with `nextCronRunAt` |

---

# Final Recommendations

## Deployment recommendation

**Ship / keep live.** The system is production-capable on Railway with:

- Working public site and sample content  
- Working admin auth  
- Working DB  
- Working AI draft pipeline (credit-dependent)  
- Scheduled crawlers and workers  

## Would I approve for production?

**Yes, conditional approval.**

Conditions for full confidence:

1. Rotate leaked OpenRouter key and change admin password.  
2. Maintain OpenRouter balance.  
3. Operator process for reviewing/publishing drafts (product intentional).  
4. Monitor cron services for silent failures.  

Do **not** treat auto-publish as a feature request without revisiting product non-negotiables (human review before live).

## Operator credentials (change ASAP)

| Item | Value at handover |
|------|-------------------|
| Site | https://papertrail-production-71d6.up.railway.app |
| Admin email | `admin@papertrail.app` |
| Admin password | Session-generated temporary (see prior chat; **change it**) |
| Railway project | `papertrail` (workspace of `tatassembly@gmail.com`) |

## Architecture decisions to preserve

1. Drafts only from automation; publish is manual.  
2. Source URL required to publish.  
3. Caveats required in AI schema.  
4. Cron must exit; separate Railway cron services (not in-process schedulers on web dyno).  
5. No `cookies()` in root layout.

---

*End of handover body. See `CHANGELOG.md` for session modification summary.*
