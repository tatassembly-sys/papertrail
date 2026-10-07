# Paper Trail — current project status

**Date:** 7 October 2026  
**Verified runtime:** `54ab66a5980fece1da8e720be008359af5410320` on deployment `e7cfcf6a-2c76-42b6-b2a9-606ea73ea4ed` (SUCCESS). Health on that deploy was `ok`, database `connected`, email `log`, billing `off`. This matches `PAPERTRAIL_MARKET_READINESS.md`. The earlier `4f25f06` / `91f12539` note is the previous deploy.  
**Verdict:** **Milestone 1 closed.** **MR1 is in progress.** **Milestone 2 / MR2 is not closed.** Inbox delivery and the custom domain are **BLOCKED** on credentials and DNS this repo cannot create. Stripe Pro checkout stays **off**.

Live app: [https://papertrail-production-71d6.up.railway.app](https://papertrail-production-71d6.up.railway.app)

## MR1 (7 October 2026)

Agent tasks in this commit: missing-post metadata no longer calls `notFound()` during streaming, `app/posts/[slug]/loading.tsx` is removed so a missing note can return HTTP 404, `/api/health` includes `commit` from `RAILWAY_GIT_COMMIT_SHA`, and `.github/workflows/ci.yml` runs typecheck, test, and build.

The HTTP 404 and the health `commit` field are not production-verified until the next Railway deploy of this commit.

## Waiting on owner

- Confirm Railway deploys GitHub `main` (or redeploy this commit), then check `GET /posts/does-not-exist` is 404 and `GET /api/health` `commit` matches that deploy.
- Add an external uptime monitor on `/api/health` and send one test alert. This repo cannot create that account.
- MR2 still needs a Resend key, `NEWSLETTER_FROM`, DNS for `papertrailresearch.co.uk`, and an OpenRouter key rotation.

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
