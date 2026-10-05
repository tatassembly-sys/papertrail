# Changelog — Production hardening & Railway go-live

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
