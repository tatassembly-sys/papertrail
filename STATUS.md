# Paper Trail — current project status

**Date:** 5 October 2026 (BST)  
**Source tip:** `bc80e36` (`main`) — *Harden publish, email confirmation, billing, and submissions.*  
**Verdict:** **Code tip is launch-capable for the free product**; live Railway is still on an **older image** (Pro / library routes 404). Wire Resend + DNS, rotate secrets, then **redeploy tip** before treating production as current. Stripe Pro checkout stays **optional**.

Live app (older image as of this date): [https://papertrail-production-71d6.up.railway.app](https://papertrail-production-71d6.up.railway.app)

---

## What Paper Trail is

Plain-language articles from real academic papers (arXiv + PubMed), AI-translated via OpenRouter, always sourced, always with caveats, **never auto-published**.

- Public reading stays free.
- **Paper Trail Pro** (Stripe) unlocks unlimited chat, markdown export, larger library quotas, and priority suggestions — checkout is off until Stripe keys are set.
- Admin + cron pipeline create **drafts**; humans publish.

See `README.md`, `SETUP.md`, and `HANDOVER.md` (Aug 2026 go-live history).

---

## What’s done at tip (`bc80e36`)

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

## Live Railway vs this tip (honest gap)

As of **5 October 2026 BST**, production health is up:

```json
{"status":"ok","db":"connected","openrouter":true,"openrouter_mode":"free","email":"log"}
```

…but the **running image still lacks tip routes**:

| Path | Live |
|------|------|
| `/` | 200 |
| `/account` | 200 |
| `/pricing` | **404** |
| `/library` | **404** |
| `/topics` | **404** |
| `/authors` | **404** |
| `/today` | **404** |
| `/verify-email` | **404** |
| `/newsletter/confirm` | **404** |

`email: "log"` — Resend is **not** wired on live (verify/reset/digest will not send real mail).

**Action:** redeploy tip `bc80e36` (or newer `main`) to Railway (`railway up` or GitHub source → branch `main`), then smoke `/pricing`, `/library`, `/topics`, `/authors`, `/today`, `/verify-email`.

---

## Remaining launch blockers

1. **Redeploy tip to Railway** so live matches Pro / library / email-confirm UI (see gap above).
2. **Resend** — set `RESEND_API_KEY` + `NEWSLETTER_FROM` on a verified sending domain. Until then, auth verify / newsletter stay log-mode (`email: "log"` on health).
3. **DNS** — `papertrailresearch.co.uk` does **not** resolve (GoDaddy / registrar still pending). Keep using the Railway domain, or finish DNS + set `NEXT_PUBLIC_SITE_URL` and redeploy.
4. **Secret rotation** — rotate any secrets exposed in prior ops history (OpenRouter API key, `CRON_SECRET`, admin password / `ADMIN_PASSWORD_HASH`) and update Railway.
5. **Stripe keys (optional)** — Pro checkout stays off without `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, and webhook secret on `POST /api/billing/webhook`. Comp Pro via `BILLING_GRANT_EMAILS` or admin grant without Stripe.

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
