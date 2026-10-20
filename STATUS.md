# Paper Trail — status

> **Current as of 20 October 2026.** Plan: [`MILESTONES.md`](MILESTONES.md) · Agent manual: [`AGENTS.md`](AGENTS.md) · Log & baseline: [`PROGRESS.md`](PROGRESS.md).
> Production: **down / being moved off Railway** (spending cap). Target: Vercel Hobby (Next.js, region `lhr1`) + MongoDB Atlas M0 (EU region) + cron-job.org for frequent cron ticks.
> Market decision: **NO-GO until M10 launch checklist passes.**
> Older sections below are history; where they mention Railway URLs or MR0–MR5, the new M0–M10 plan supersedes them.

## Milestones (update this table when a milestone closes)
| Id | Milestone | State |
|---|---|---|
| M0 | Hosting cut-over: Railway → Vercel + MongoDB Atlas | open — agent prep M0.3, M0.4, M0.5, M0.7 done; Atlas, Vercel, scheduler, and Railway deletion are owner work |
| M1 | Release truth and CI hardening | open — agent tasks M1.1, M1.2, M1.3, M1.5, M1.6 done; M1.4 branch protection and copying proposed CI are owner work |
| M2 | Security hardening | open |
| M3 | Correctness and known bugs | open |
| M4 | Tests and CI depth | open |
| M5 | Legal and compliance (UK GDPR, PECR) | open |
| M6 | Payments readiness (Stripe, Paper Trail Pro — optional) | open |
| M7 | Observability and operations | open |
| M8 | Performance, accessibility and SEO | open |
| M9 | UX polish and content operations | open |
| M10 | Launch checklist and go-live | open |

## Baseline (20 October 2026)
Install ✅ · typecheck ✅ · tests ✅ (520 sandbox + 34 unit) · build ✅ · lint = typecheck alias (no ESLint).

---

## History (previous status, kept for reference)


**Date:** 13 October 2026  
**Verified runtime (last known):** `e8fe318a702720ce084e55f964a83f9a2b44f1f3` on Railway deployment `b8a507a0-0bd9-46e6-9f96-b08993ae65bb` (SUCCESS when last checked on 7 Oct).  
**Live check 13 Oct 2026 ~11:25 BST:** `https://papertrail-production-71d6.up.railway.app/api/health` → HTTP 404 `Application not found` (Railway spend capped; production is down).  
**Verdict:** **MR0 (move to Vercel + Atlas) is TOP PRIORITY.** Milestone 1 / MR1 agent work was previously verified on Railway. **MR2 is not closed.** Inbox delivery and the custom domain are **BLOCKED**. Stripe Pro checkout stays **off**. Market decision stays **NO-GO**.

Previous Railway URL (down): [https://papertrail-production-71d6.up.railway.app](https://papertrail-production-71d6.up.railway.app)

## MR1–MR5 (7 October 2026)

Checked live on deployment `b8a507a0` (`e8fe318`). PASS means the running site did it. The 404 and health checks below were repeated on this deploy.

| Result | Check |
|--------|--------|
| PASS | `GET /api/health` is `ok`, database `connected`, email `log`, billing `off`, `commit` `e8fe318a702720ce084e55f964a83f9a2b44f1f3`. |
| PASS | `GET /posts/does-not-exist-mr1` is HTTP 404, HTML, contains “not on file” and “Not on file”, and `noindex`. It does not redirect to login. |
| PASS | `GET /posts/duck-hunting-with-quantum-mechanics` is HTTP 200. Home, pricing, login, and library are HTTP 200. |
| PASS | Unsigned `GET /api/process-queue` is 401. `POST /api/billing/checkout` is 503. |
| PASS | Actions on `e8fe318` completed success (`37691157508`). Earlier runs on `453ce63`, `696e424`, `01aa7ed`, and `d338436` also succeeded. |
| PASS | Anonymous `GET /` set no cookie. The repo has no analytics SDK and no consent banner. |
| PARTIAL | `/admin/status` lists the six cron jobs with status and duration after an authorized run, plus the latest stored queue error. No cron was called with a bearer on this deploy, so the new rows are empty until the next schedule. The page was not opened with an admin session. |
| PARTIAL | `scripts/smoke-http.mjs` plans home, pricing, login, a missing article, and one local article. It refuses any non-localhost `BASE_URL`. It was not run against a local server. Playwright is not a dependency and was not added. |
| PARTIAL | Duplicate and out-of-order Stripe webhook tests pass offline. Checkout stays 503. No test-mode purchase was made. |
| BLOCKED | Inbox delivery. `RESEND_API_KEY`, `NEWSLETTER_FROM`, and `EMAIL_FROM` are absent. Mail links are built with `getSiteUrl()`. |
| BLOCKED | `papertrailresearch.co.uk` has no public DNS zone. `NEXT_PUBLIC_SITE_URL` stays on the Railway host. |
| BLOCKED | OpenRouter key rotation. Health only shows that a key is present. |
| BLOCKED | Mongo backup restore, a 7-day editorial run, an uptime monitor, privacy/terms review, ICO registration, and the GO decision. |

Deploy `01aa7ed` put `/posts` on the admin session matcher. Public articles then returned HTTP 307 to `/login`. Deploy `696e424` removed that matcher. Deploy `453ce63` is the one verified above.

`docs/RUNBOOK.md` covers redeploy, rollback, secret rotation, a scratch Mongo restore, and cron reruns. A 200 on a cron route runs the job. An authorized cron call was not sent.

## Waiting on owner

### MR0 — bring the site back on Vercel + Atlas (do these first)
1. Create a MongoDB Atlas M0 cluster (near `lhr1`/`fra1`), DB user, Network Access `0.0.0.0/0`. Set `MONGODB_URI` / `MONGODB_DB`. If Railway Mongo data still matters, `mongodump` / `mongorestore` from a local machine before any Railway credit fully lapses.
2. Vercel → Add New Project → import `tatassembly-sys/papertrail` (Next.js, `npm run build`). Copy Production env vars from `.env.example` / the old Railway variable list (names only in docs; never commit values).
3. After the first deploy: set `NEXT_PUBLIC_SITE_URL` to the Vercel URL, then set up cron-job.org (or similar) `GET`s with `Authorization: Bearer <CRON_SECRET>` for `/api/cron-fetch`, `/api/cron-fetch-pubmed`, `/api/process-queue`, `/api/process-scheduled-posts`, `/api/cron-publish-mix` (cadence in `SETUP.md`).
4. Tell an agent when it is live so they can verify `/api/health`, cron 401/200, and key pages, then remove the Railway service.

Agent MR0 prep already done in-repo: `vercel.json` (`lhr1`), SETUP/README/STATUS wording updated for Vercel; `railway.toml` kept until you confirm the cut-over.

### Still open after MR0
- Add an external uptime monitor on `/api/health` and send one test alert. This repo cannot create that account.
- MR2 needs a Resend key, `NEWSLETTER_FROM`, `EMAIL_FROM`, DNS for `papertrailresearch.co.uk`, and an OpenRouter key rotation. After that, say which inbox to use for register, reset, confirm, and unsubscribe.
- MR5 starts only if you want to charge and Stripe test keys are set. Checkout must stay 503 until then.
- Privacy, terms, ICO registration, and the GO decision stay with you. This file does not say GO.

## Production verification on `91f12539`

Checked in Edge headless and with direct API calls against that deployment. PASS means the behaviour was exercised on the running site. Static reading of the repo was not treated as PASS.

| Result | Check |
|--------|--------|
| PASS | Home, pricing, library, and newsletter render visible copy. Health from the loaded page is `ok`, database `connected`, email `log`, billing `off`. |
| PASS | Unsigned `/welcome` ends on `/register` (“Create account”). The first document status is HTTP 200; the browser then completes the redirect. |
| PASS | `/verify-email` shows the paste-token instruction. `/account?verified=1` while signed out shows “Email verified. Sign in to use this account.” |
| PASS | The reset form, after submit, shows “Email delivery is not configured.” Subscribe of a valid address returns 503. |
| PASS | An article linked from home renders. Admin sign-in opens the dashboard and ops status; sign-out returns to `/login`. |
| PASS | Bad reader password 401. Unsigned `/api/process-queue` 401. Cross-site login 403. Checkout 503. |
| PARTIAL | Cron routes reject a missing secret (401). A call with the current bearer was not repeated on this deployment, because a 200 runs the job. |
| BLOCKED | Confirmation, reset, and digest mail in an inbox. `RESEND_API_KEY` and `NEWSLETTER_FROM` are absent. |
| BLOCKED | `www.papertrailresearch.co.uk` (`ENOTFOUND`). The name has no public DNS zone. |
| BLOCKED | OpenRouter key rotation. Health only reports that a key is present. A replacement key has to come from the OpenRouter dashboard. |
| FAIL | `/posts/does-not-exist-journey` shows the not-on-file page and returns HTTP 200, not 404. |

No HTTP 500 or 502 was recorded for this deployment’s check window. The only error-level startup line is npm’s `production` config warning.

---

## What Paper Trail is

Plain-language articles from real academic papers (arXiv + PubMed), AI-translated via OpenRouter, always sourced, always with caveats, **never auto-published**.

- Public reading stays free.
- **Paper Trail Pro** (Stripe) unlocks unlimited chat, markdown export, larger library quotas, and priority suggestions — checkout is off until Stripe keys are set.
- Admin + cron pipeline create **drafts**; humans publish.

See `README.md`, `SETUP.md`, and `HANDOVER.md` (Aug 2026 go-live history).

---

## What’s done through `a953950`

### Core product (earlier + tip)

- Next.js 15 App Router, MongoDB, Railway (`railway.toml`), admin JWT gate, cron Bearer auth.
- Ingestion: arXiv + PubMed enqueue → `process-queue` → drafts → manual publish (source URL + caveats gated).
- Search / filters, user accounts, newsletter APIs, per-article AI chat, share-approval gates, CSP/security headers.

### Paper Trail Pro + billing (`01c5024`+)

- Stripe Checkout + Customer Portal + signed webhook (REST + HMAC, no Stripe SDK).
- Free quotas: chat 5/day, saves/bookmarks 20, topics 8, submissions 3/week, 1 collection, 15 highlights.
- Pro: unlimited entitlements, export, priority submit; lab enquiry form; `/pricing`; account billing panel; admin grant-Pro (`BILLING_GRANT_EMAILS` or `/admin/status`).
- Checkout returns 503 until `STRIPE_SECRET_KEY` + price IDs are set.

### Library hubs (`7a82aa8`+)

- `/library`, `/topics`, `/authors`, `/today`, `/welcome`, reading lists, highlights, APA/MLA/Chicago/BibTeX cite + Highwire meta.
- Topic follow + personalized weekly digest from followed topics (`8ffbb89`).

### Email confirmation harden + publish/billing polish (`bc80e36`)

- Verify / newsletter confirm via **POST + hashed tokens** (prefetch-safe pages: `/verify-email`, `/newsletter/confirm`).
- Stronger publish gate, submissions hardening, billing webhook edge cases, index bootstrap updates.

### Sandbox suite (`bc80e36`)

- `npm test` / `npm run test:sandbox` → `sandbox/run.mjs` (500+ scenarios against in-memory `product.mjs`: entitlements, Stripe signatures, publish gates, quotas, auth tokens). No Mongo server / no network / no deploy (needs `mongodb` npm package for ObjectId only).
- Confirm / verify / unsubscribe UI posts tokens deliberately (hidden when present in the link); newsletter confirm/unsubscribe disallowed in robots.txt; `.env.example` documents Resend DNS + Stripe test keys + custom domain.

---

## Milestone 1 — production tip (closed)

Checked 6 October 2026. GitHub `main` and the active Railway deployment are the same commit. The previous September CLI image is `REMOVED`. No second web service is running.

Health:

```json
{"status":"ok","db":"connected","openrouter":true,"openrouter_mode":"free","openrouter_model":"openrouter/free","xai":false,"translator":"openrouter","email":"log","billing":"off"}
```

| Check | Result |
|-------|--------|
| `/`, `/pricing`, `/library`, `/topics`, `/authors`, `/today`, `/welcome` | 200 |
| `/topics/daily-mix`, `/authors/andreas-dietzel`, homepage article | 200 |
| `/verify-email`, `/newsletter/confirm`, `/newsletter/unsubscribe` | 200 |
| `/login`, `/user-login`, `/register`, `/forgot-password`, `/reset-password`, `/account` | 200 |
| `/admin`, `/admin/status` unsigned | 307 → `/login` |
| `POST /api/auth/login` and `/api/auth/user-login` with a bad password | 401 |
| `GET /api/me` unsigned | 200, `user: null` |
| `/about`, `/submit`, `/privacy`, `/terms`, `/sitemap.xml`, `/robots.txt`, `/feed.xml` | 200 |
| Deploy logs `@level:error` and HTTP 5xx over the last day | none |
| `npm test` on this tip | 520 sandbox + 13 unit, all passed |

`email: "log"` and `billing: "off"` are expected until Milestone 2 and Stripe keys. They are not a tip mismatch.

Missing-post requests show the not-on-file page and return HTTP 200 with `NEXT_HTTP_ERROR_FALLBACK;404`. That is a production **FAIL** for the HTTP status. It is not a live-vs-main gap, and it is outside the Milestone 2 exit.

`www.papertrailresearch.co.uk` and the apex domain still do not resolve. Use the Railway hostname above. DNS is Milestone 2.

---

## Milestone 2 — email, domain, secrets (open)

Checked 6 October 2026.

| Item | State |
|------|--------|
| `RESEND_API_KEY`, `NEWSLETTER_FROM` | Absent on the papertrail service. Health stays `email: "log"`. |
| `papertrailresearch.co.uk` | NXDOMAIN at 1.1.1.1 and `dns1.nic.uk`. No zone exists for Railway CNAMEs or Resend DKIM. |
| `NEXT_PUBLIC_SITE_URL` | Set to the working `*.up.railway.app` host. Do not point it at the custom domain until that name resolves. |
| Digest cron | `cron-newsletter` is scheduled `0 15 * * 0` and calls `/api/newsletter/digest`. It cannot deliver until Resend is set. |
| Confirm / reset / verify | Pages are POST-confirm. Failed Resend sends no longer claim success. Confirm mail includes an unsubscribe link. Deleting an account unsubscribes that email. |
| Secrets in git | None in history. |
| `CRON_SECRET` | Rotated 6 October 2026 on the web service and all six cron start commands. Unsigned cron calls return 401 on `91f12539`. The matching bearer was not sent again on this deployment. |
| Admin password | Rotated the same day. The new password is not in git. |
| OpenRouter key | Still the previously exposed key. Rotation needs a new key from the OpenRouter dashboard. |

Railway still expects these records once a zone exists: apex CNAME `6mp7haey.up.railway.app`, `www` CNAME `su8i7gl4.up.railway.app`, plus the `_railway-verify` TXT records shown by `railway domain status`.

## Remaining launch blockers

1. **Resend** — set `RESEND_API_KEY` + `NEWSLETTER_FROM` on a verified sending domain. Until then, auth verify / newsletter stay log-mode (`email: "log"` on health).
2. **DNS** — register or restore `papertrailresearch.co.uk`, then add the Railway records above. Keep `NEXT_PUBLIC_SITE_URL` on the Railway host until then.
3. **OpenRouter** — rotate the exposed API key in the OpenRouter dashboard and update Railway.
4. **Stripe keys (optional)** — Pro checkout stays off without `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, and webhook secret on `POST /api/billing/webhook`. Comp Pro via `BILLING_GRANT_EMAILS` or admin grant without Stripe. Milestone 8.

## Stripe (explicitly optional)

Reading and the free tier do **not** require Stripe. Pro Checkout + portal + webhook exist in code; live keys are **not** a launch blocker for the free product.

**STRIPE: OPTIONAL — CHECKOUT OFF UNTIL KEYS SET**

---

## Tests (repo)

| Check | How |
|-------|-----|
| Sandbox product rules | `npm test` / `npm run test:sandbox` (500+ scenarios, offline) |
| Typecheck | `npm run typecheck` / `npm run lint` |
| Production build | `npm run build` |

---

## Doc map

| Doc | Role |
|-----|------|
| `STATUS.md` | **This file** — current tip vs live, blockers |
| `HANDOVER.md` | Aug 2026 go-live engineering report (dates refreshed) |
| `PHASE_COMPLETION.md` | Feature phases + remaining ops table |
| `SETUP.md` | Deploy checklist, env, crons, Stripe notes |
| `PRODUCTION_HARDENING.md` / `PRODUCTION_HEALTH.md` | Earlier hardening + cron health notes |
| `sandbox/README.md` | Isolated scenario suite |
| `CHANGELOG.md` | Session ship summary |


## Vercel deployment (2026-10-20)
- Production URL: https://papertrail-six-rho.vercel.app (Vercel project `papertrail`, scope `procureai1`, GitHub repo connected for auto-deploy from `main`).
- Env vars set (production): MONGODB_URI, MONGODB_DB, AUTH_SECRET, CRON_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD_HASH, NEXT_PUBLIC_SITE_URL. Email in log mode (no RESEND_API_KEY); OpenRouter/Stripe/social unset.
- Status: homepage 200, cron unsigned 401. /api/health 503 `db: unreachable` — Atlas rejects the TLS handshake (alert 80): add 0.0.0.0/0 to Atlas Network Access.
- TODO: Atlas network access; cron-job.org jobs with CRON_SECRET (stored in Vercel env); OPENROUTER_API_KEY for article generation.
