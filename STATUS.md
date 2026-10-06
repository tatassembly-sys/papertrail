# Paper Trail — current project status

**Date:** 6 October 2026  
**Verified runtime:** `a953950` on deployment `8c52b989-8219-4a01-b90d-cfcfe543a9d5` (GitHub `tatassembly-sys/papertrail` `main`, SUCCESS).  
**Verdict:** **Milestone 1 closed.** Live production matches `main`. **Milestone 2 is not closed.** Real email still needs a Resend key and a registered sending domain. Stripe Pro checkout stays **off**.

Live app: [https://papertrail-production-71d6.up.railway.app](https://papertrail-production-71d6.up.railway.app)

---

## What Paper Trail is

Plain-language articles from real academic papers (arXiv + PubMed), AI-translated via OpenRouter, always sourced, always with caveats, **never auto-published**.

- Public reading stays free.
- **Paper Trail Pro** (Stripe) unlocks unlimited chat, markdown export, larger library quotas, and priority suggestions — checkout is off until Stripe keys are set.
- Admin + cron pipeline create **drafts**; humans publish.

See `README.md`, `SETUP.md`, and `HANDOVER.md` (Aug 2026 go-live history).

---

## What’s done at tip (`a953950`)

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

Missing-post requests stream a shell and then a `NEXT_HTTP_ERROR_FALLBACK;404` payload. That matches this tip. It is not a live-vs-main gap.

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
