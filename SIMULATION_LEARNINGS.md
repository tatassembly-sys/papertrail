# Simulation learnings — Paper Trail production

**Date:** 2026-08-04  
**Target:** https://papertrail-production-71d6.up.railway.app  
**Script:** `node scripts/sim-smoke.mjs [baseUrl]`

---

## What we simulated

| Flow | Result |
|------|--------|
| Health / home / search / category | Pass |
| Login / register / submit / newsletter pages | Pass |
| Feed + sitemap | Pass (canonical host = papertrailresearch.co.uk) |
| Admin unauth | **307** to `/login` (middleware OK) |
| Bad admin/user login | **401** correct messages |
| Weak register | **400** |
| Register + user-login + `/api/me` + save paper | Pass |
| Newsletter invalid/valid | Pass |
| Submit invalid/valid + honeypot | Pass (honeypot silent 201) |
| Cron without auth | **401** |
| Cron **with** `CRON_SECRET` | process-queue **200**, cron-fetch **200** (1700 found) |
| Article page + chat UI | Pass UI |
| Chat API | **502** → root cause OpenRouter **401 User not found** |
| Queue AI processing | Retries pending — same invalid OpenRouter key |
| Missing post HTTP status | **200** with 404 UI (soft 404) — segment `not-found` added |

---

## Feedback → actions taken

1. **OpenRouter API key invalid on Railway**  
   - Evidence: queue errors `User not found` code 401; chat 502.  
   - **Ops action required:** create a new key at https://openrouter.ai/keys and set `OPENROUTER_API_KEY` on the `papertrail` service (trim whitespace).  
   - Code: trim key; clearer 401 error; chat one retry on 429/5xx; shorter default chat tokens.

2. **Cron auth false-negative in ad-hoc tests**  
   - Secret with `/` is fine in Bearer header; use JSON env export when testing.  
   - Code: trim `Authorization` header before compare.

3. **Missing posts returned HTTP 200**  
   - UI correctly shows “not on file”.  
   - Code: added `app/posts/[slug]/not-found.tsx` for segment-level 404.

4. **Smoke suite reusable**  
   - Added `scripts/sim-smoke.mjs` for repeatable production checks.

---

## What is healthy

- Public site, SEO (robots/feed/sitemap), auth gates, validation, rate-limit surfaces, Mongo, enqueue pipeline, user accounts/saves.
- Pipeline is **blocked only at AI translation** until the OpenRouter key is fixed.

---

## Recommended next ops steps

1. Replace `OPENROUTER_API_KEY` on Railway → redeploy or restart.  
2. Manually hit `GET /api/process-queue` with Bearer cron secret → drafts should appear.  
3. Re-run: `node scripts/sim-smoke.mjs`  
4. Optional: set `RESEND_API_KEY` for real mail (still log mode).  
5. Complete GoDaddy DNS for papertrailresearch.co.uk.  
