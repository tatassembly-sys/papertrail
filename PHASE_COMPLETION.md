# PaperTrail — Phase Completion Report

**Original phases:** 2026-08-04  
**Status refresh:** 2026-10-05 (BST)  
**Tip:** `bc80e36` (`main`)  
**Live app:** https://papertrail-production-71d6.up.railway.app  
**Health (live):** `ok` / `db:connected` / `email:"log"` / OpenRouter free  
**Current status:** see [`STATUS.md`](./STATUS.md)

---

## 1. Files changed

### New
- `lib/search.ts`, `lib/highlight.ts`, `lib/users.ts`, `lib/user-auth.ts`, `lib/newsletter.ts`, `lib/article-chat.ts`
- `components/SearchFilters.tsx`, `components/ArticleChat.tsx`, `components/ThemeToggle.tsx`
- Pages: `account`, `register`, `user-login`, `forgot-password`, `reset-password`, `newsletter`
- APIs: user auth, `/api/me`, newsletter, article chat, approve-share
- `PRODUCTION_HEALTH.md`, `PHASE_COMPLETION.md`

### Updated
- `lib/articles.ts`, `lib/prompts.ts`, `lib/indexes.ts`, `lib/openrouter.ts`, `lib/share-links.ts`
- `app/page.tsx`, `app/posts/[slug]/page.tsx`, `app/layout.tsx`, `app/globals.css`
- `components/Navbar.tsx`, `components/ArticleCard.tsx`
- Share/schedule approval gates; process-queue source metadata
- Cron services recreated on `node:20-alpine` with `fetch` start commands

---

## 2. Features implemented

| Phase | Status | Notes |
|-------|--------|--------|
| 1 Production verify | **Done** | Health OK; cron schedules set; auth on endpoints verified |
| 2 Search | **Done** | Full-text + relevance + highlights + pagination |
| 3 Filters | **Done** | Category, date, source, author, institution, tags (combinable) |
| 4 User accounts | **Done** | Register/login/logout/reset; profile, saves, bookmarks, topics, history |
| 5 Newsletter | **Done** | Subscribe/verify/unsubscribe; weekly digest API (log/Resend) |
| 6 AI chat | **Done** | Per-article chat UI + API; free OpenRouter models |
| 7 Mobile | **Done** | Responsive layouts, dark mode, focus styles |
| 8 Social | **Done** | Intent shares + API posts require `share_approved` |
| 9 Review | **Done** | Build clean; typecheck clean; live smoke tests |
| 10 Paper Trail Pro | **Done (code)** | Stripe Checkout/portal/webhook, entitlements, export, `/pricing`, admin grant — keys optional |
| 11 Library hubs | **Done (code)** | `/library`, topics/authors, lists, highlights, cite, `/today`, topic-follow digest |
| 12 Email confirm harden | **Done (code)** | Hashed verify tokens; POST confirm pages (`/verify-email`, `/newsletter/confirm`) |
| 13 Sandbox suite | **Done** | `npm run test:sandbox` — 500+ product-rule scenarios |
| 14 Tip on live Railway | **Open** | Live image still 404s Pro/library routes — redeploy tip |

---

## 3. Database changes

| Collection | Purpose |
|------------|---------|
| `articles` | + authors, institutions, keywords, tags, source, published_at, share_approved; text index v2 |
| `users` | Accounts + saved/bookmarks/topics/history |
| `newsletter_subscribers` | Email list + tokens |
| `newsletter_runs` | Digest run log |
| `article_chats` | Chat threads per article/session |

---

## 4. API changes

```
POST /api/auth/register
POST /api/auth/user-login
POST /api/auth/user-logout
GET  /api/auth/verify-email
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET|PATCH /api/me
POST /api/newsletter/subscribe
GET  /api/newsletter/verify|unsubscribe
GET  /api/newsletter/digest          (CRON_SECRET)
GET|POST /api/articles/[id]/chat
POST /api/articles/[id]/approve-share
```

Share/schedule require `share_approved === true`.

---

## 5. Remaining work

*(Refreshed 2026-10-05 BST.)*

| P | Item |
|---|------|
| P0 | **Redeploy tip** `bc80e36`+ to Railway (live still 404s `/pricing`, `/library`, …) |
| P0 | Rotate secrets exposed in ops history (OpenRouter, `CRON_SECRET`, admin password hash) |
| P1 | **Ops:** set `RESEND_API_KEY` + `NEWSLETTER_FROM` for real email (live still `email:"log"`) |
| P1 | Finish DNS for `papertrailresearch.co.uk` (does not resolve as of 2026-10-05) + `NEXT_PUBLIC_SITE_URL` |
| P2 | Stripe keys for Pro checkout (**optional** — checkout off until set) |
| P2 | Browser E2E beyond sandbox; further CSP tightening |

### Backend finish (2026-08-04, deploy `e4b4d657`)
- Rate limits: register, chat, newsletter, forgot-password; user-login lockout
- Text index recreate with weights; rate_limits TTL indexes
- arXiv/PubMed author (and affiliation) extraction into drafts
- Share approval admin UI + gated API/schedule posting
- `GET /api/admin/status` ops snapshot
- Trending sort by share count
- Health: `{ openrouter, email }` flags
- Newsletter weekly cron already present (`cron-newsletter`)

### Product finish (through tip `bc80e36`, 2026-10-05)
- Paper Trail Pro entitlements + Stripe REST/HMAC billing
- Library hubs, cite formats, collections/highlights, topic-follow digests
- Publish gate (source URL + caveats); email confirm POST + hashed tokens
- Sandbox: `sandbox/run.mjs` / `product.mjs` (500+ scenarios)

---

## 6. Production readiness score

**90 / 100** (code tip `bc80e36`)

Strong: tip product (Pro, library, email harden, sandbox), Mongo, search, accounts, chat, newsletter APIs, free AI.  
Gaps: live image behind tip; email still log-mode; DNS pending; secrets rotation; Stripe optional.

## 7. Deployment readiness score

**85 / 100**

`npm run build` green at tip; Railway Online + health OK; **redeploy tip** still required before live matches tip routes.

## 8. Product roadmap recommendations

1. **Redeploy tip** to Railway and smoke Pro/library/confirm routes  
2. Wire **Resend** for verification + weekly digest (verified from-domain)  
3. Finish **`papertrailresearch.co.uk`** DNS + `NEXT_PUBLIC_SITE_URL`  
4. Rotate exposed secrets; confirm admin password is not temporary  
5. Optional: set **Stripe** keys when ready to sell Paper Trail Pro  
6. Optional: paid OpenRouter models behind a feature flag later  

---

## Live smoke tests (this session)

| Test | Result |
|------|--------|
| Health | 200 ok/connected |
| Home + search filters UI | 200 |
| Register user | 200 |
| Newsletter subscribe | 200 |
| Article page + chat UI | 200 |
| Chat API (limitations question) | 200 with reply |
| Cron schedules | Configured with nextCronRunAt |
| Cron runtime image | Recreated as **node:20-alpine** + fetch |

---

## Cron schedule (UTC)

| Service | Schedule | Target |
|---------|----------|--------|
| cron-arxiv | `0 6 * * *` | `/api/cron-fetch` |
| cron-pubmed | `30 6 * * *` | `/api/cron-fetch-pubmed` |
| cron-process-queue | `*/10 * * * *` | `/api/process-queue` |
| cron-scheduled | `*/5 * * * *` | `/api/process-scheduled-posts` |

Start command pattern (Node 20):

```js
node -e "fetch(URL,{headers:{Authorization:'Bearer SECRET'}}).then(...)"
```
