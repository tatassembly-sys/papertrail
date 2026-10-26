# Changelog

## How to add an entry

- Keep **[Unreleased]** at the top. Add bullets under Added, Changed, or Fixed.
- One line per user-visible change. Name the milestone id when there is one (`M1.6`).
- Do not paste secrets, tokens, or live URLs that contain credentials.
- On a release, rename `[Unreleased]` to the tag (`[v1.0.0] — YYYY-MM-DD`) and open a new empty `[Unreleased]`.
- `npm run release:notes` prints `git log` since the latest tag. Use it as the source list, then edit.

## [Unreleased]

## [v1.0.0] — release candidate (owner sets the date and pushes the tag at launch, M10.5/M10.6)

### Added
- Hosting prep for Vercel: confirmed index script, Vercel site-URL order, cron-job.org runbook, read-only `smoke:prod` (M0).
- Proposed CI with lint, audit, gitleaks, integration and coverage steps in `docs/ci/proposed-ci.yml` (M1.3, M4.4).
- Integration tests on in-memory MongoDB (`npm run test:integration`) and coverage (`npm run test:coverage`, fails under 60% of `lib/`) (M4.2, M4.3).
- Playwright smoke plus axe accessibility, dark-mode and 360px checks (`npm run test:e2e`); Lighthouse CI with ≥0.9 assertions (`npm run lighthouse`) (M4.1, M8.1, M8.3, M9.4).
- Structured JSON logger with PII/token redaction; optional Sentry behind `SENTRY_DSN` (M7.1, M7.2).
- `/api/health` reports `cron_last_run` per job and `queue_depth`; stale crons shown in red on `/admin/status` (M7.3).
- Incident runbook and launch checklist (`docs/runbooks/`, `docs/launch-checklist.md`) (M7.4, M10.1).
- ScholarlyArticle + BreadcrumbList structured data on posts (M8.2).
- Admin: bulk approve/reject drafts, retry failed queue items, LLM model and cost recorded per draft (M9.3).
- Onboarding: topic picks personalise `/today`; newsletter prompt from the 2nd article read (M9.2).
- Search suggestions show topic hints when nothing matches (M9.5).

### Changed
- Topic and author pages are cached (ISR, 5 minutes); post probe API sends a short shared cache header; list queries skip article bodies (M8.4).
- Accent colour darkened to #B03024 and inline links underlined for WCAG AA contrast (M8.3).
- MongoDB Stable API is non-strict by default so the text search index and `$text` work (`MONGODB_STABLE_API_STRICT=true` to opt in).

### Fixed
- Missing posts, topics, authors and lists return real 404s (M3.1); cron runs are idempotent (M3.2); Europe/London schedule handling across DST (M3.3); email tokens are single-use and expire (M3.5).
- A failed text-index create no longer drops the existing index.

### Security
- Production dependency advisories cleared (`npm audit --omit=dev --audit-level=high` exits 0) (M2).

## History — production hardening and Railway go-live

All notable modifications from the engineering session culminating 2026-08-04.

## [Unreleased] / Session ship

### 2026-10-05 follow-ups
- `npm test` alias for the offline sandbox suite (CI-friendly).
- Confirm / verify / unsubscribe pages: POST via shared form; hide URL token; robots disallow.
- Unsubscribe form POST truncates tokens like JSON path; richer `.env.example` Resend/DNS/Stripe notes.

### Added

- Library layer (Semantic Scholar / Readwise / Zotero / The Conversation):
  author + topic hubs, `/today` briefing, collections, highlights, cite
  formats, Highwire meta tags, For you + continue reading, `/` search hotkey.
- Paper Trail Pro: Stripe Checkout + Customer Portal + signed webhooks, free
  quotas on chat / saves / suggestions, markdown export, lab enquiry form,
  `/pricing`, account billing panel, admin grant-Pro. No Stripe package —
  REST + HMAC. Checkout stays off until keys are set.
- `lib/site-url.ts` — Railway-aware public origin resolution  
- `lib/cron-auth.ts` — production-required cron Bearer auth  
- `lib/indexes.ts` — idempotent Mongo index bootstrap  
- `lib/request-ip.ts` — shared client IP + hash helpers  
- `lib/object-id.ts` — strict ObjectId validation  
- `lib/safe-error.ts` — production-safe API error messages  
- `railway.toml` — build/start/healthcheck config-as-code  
- `.env.example` — full environment documentation  
- `README.md` — product and stack overview  
- `app/admin/layout.tsx` — admin nav + sign out (no root cookies)  
- `HANDOVER.md` — engineering handover report  
- Railway services: MongoDB plugin, `cron-arxiv`, `cron-pubmed`, `cron-process-queue`, `cron-scheduled`  
- Ops scripts: `scripts/setup-railway-crons.mjs`, `scripts/verify-crons.mjs`  

### Changed

- `lib/mongodb.ts` — process-wide client pool; lazy URI; optional Stable API; pool size knobs  
- `lib/articles.ts` — typed update validation; strict ObjectIds  
- `lib/queue.ts` — stuck-job reclaim; safe bulk insert on duplicates  
- `lib/scheduledPosts.ts` — stuck-job reclaim; strict ObjectIds  
- `lib/submissions.ts` — strict ObjectIds; hashIp re-export from request-ip  
- `lib/auth.ts` — minimum AUTH_SECRET length  
- `lib/openrouter.ts` — attribution headers; max_tokens; input truncate; cheaper default model  
- `types/types.ts` — getSiteUrl delegates to lib/site-url  
- `app/layout.tsx` — static Navbar; metadataBase via getSiteUrl  
- `app/feed/route.ts`, `app/sitemap.ts`, `app/robots.ts` — getSiteUrl; dynamic robots  
- `app/api/health/route.ts` — no raw error leakage in production  
- `app/api/auth/login/route.ts` — shared IP utils; safe errors  
- `app/api/auth/logout/route.ts` — cookie clear attributes match login  
- `app/api/submissions/route.ts` — shared IP utils  
- `app/api/articles/[id]/*` — stronger validation  
- Cron/process API routes — assertCronAuthorized  
- `app/login/page.tsx` — reliable form (no blank Suspense shell)  
- `components/Navbar.tsx` — static public chrome  
- `next.config.ts` — `/feed.xml` rewrite  
- `package.json` — typecheck script  
- `tsconfig.json` — exclude junk paths  
- `.railwayignore` / `.env.example` / `SETUP.md` — deploy docs accuracy  
- Railway env: Mongo private URI, auth secrets, OpenRouter, site URL, stable API off  

### Fixed

- Production Mongo connection leak (new client per request)  
- RSS `/feed.xml` 404/mismatch  
- Sitemap/robots/OG wrong host on Railway  
- Unauthenticated production cron endpoints  
- Health/login information disclosure  
- Article PATCH weak typing  
- Cron enqueue BulkWriteError on duplicates  
- Queue/scheduled jobs stuck in `processing`  
- Login page blank / hard to use  
- OpenRouter 402 token budget failures  
- Empty public site (pipeline + publish + crons)  
- Root layout over-dynamic due to cookies() in Navbar  

### Removed

- Dead root `index.ts` (duplicate of `lib/social.ts`)  

### Security

- Production cron auth required  
- Safer public error messages  
- Stricter ObjectId and article update validation  
- **Action required:** rotate OpenRouter key exposed in chat; change admin password  

### Deployment

- Live: https://papertrail-production-71d6.up.railway.app  
- Health: `{"status":"ok","db":"connected"}`  
- Crons scheduled (UTC): arXiv 06:00, PubMed 06:30, process-queue */10, scheduled */5  
- Sample content: 5 published articles on homepage  

---

## Ops notes

- Drafts are created by automation; **publish is manual** (product rule).  
- OpenRouter credits required for sustained `process-queue` success.  
- Prefer Railway Mongo (`mongodb.railway.internal`) over the failed Atlas host `procure1.onerlcz.mongodb.net`.  
