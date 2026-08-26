# Production Hardening Report

**Date:** 2026-08-04  
**Deploy:** `7af900f5` SUCCESS  
**Live:** https://papertrail-production-71d6.up.railway.app  

---

## Scores (out of 100)

| Dimension | Score | Notes |
|-----------|------:|-------|
| Architecture | **86** | Clear App Router + `lib/` services; thin API routes |
| Security | **88** | JWT role checks, rate limits, headers/CSP, public errors |
| Performance | **82** | List projections, pooled Mongo, lean deploy ignores |
| Maintainability | **85** | Shared cookie helpers, removed dead UI, consistent tokens |
| Scalability | **78** | Single Node + Mongo pool; queue batch workers; free AI limits |
| Code Quality | **84** | TS strict, no dead SearchFilters/icon path; lean deps |
| **Production Readiness** | **87** | Live, healthy, crons, auth, search; email still log-mode |

---

## Files modified

- `lib/auth.ts` — admin role claim check; shared cookie options  
- `app/api/auth/login/route.ts`, `logout/route.ts` — use cookie helper  
- `next.config.ts` — CSP, `poweredByHeader: false`, API no-store  
- `lib/articles.ts` — list/feed/sitemap field projections  
- `app/api/me/route.ts` — JSON/slug/topic validation  
- `app/api/process-paper/route.ts` — safe public errors  
- `app/sitemap.ts`, `app/feed/route.ts` — published_at dates  
- `app/icon.tsx` — moved from `components/icon.tsx`  
- `.railwayignore`, `.gitignore` — zip/dev artifacts excluded  

## Removed

- `components/SearchFilters.tsx` (unused)  
- `components/icon.tsx` (moved to `app/icon.tsx`)  
- `atlas-test.js`  
- `paper-trail.zip` (local; ignored going forward)  

---

## Improvements by phase

1. **Code quality** — dead components/scripts removed; deploy payload leaner  
2. **Architecture** — favicon via App Router convention; auth cookie options centralized  
3. **Security** — admin JWT requires `role: admin`; CSP + no `X-Powered-By`; input bounds on `/api/me`  
4. **Database** — list queries omit large body fields; indexes already robust  
5. **Performance** — smaller list payloads; Railway ignore for large local files  
6. **UI/UX** — prior dark-mode token work retained; no redesign  
7. **API** — consistent validation/errors; process-paper no longer leaks internals  
8. **Railway** — health OK; crons unchanged; ignore file for upload size  
9. **Testing** — `tsc --noEmit` OK; smoke: health, home, robots, feed, sitemap, login, submit  

---

## Remaining technical debt

1. **Resend** not configured (`email: "log"`) — verification/digest need `RESEND_API_KEY`  
2. **DNS** for `papertrailresearch.co.uk` — Railway ready; GoDaddy records may still be pending  
3. **No automated E2E suite** — smoke is manual/HTTP  
4. **CSP** allows `'unsafe-inline'` scripts (Next FOUC theme bootstrap)  
5. **twitter-api-v2** dependency only for optional paid X posting  
6. **Local disk** on dev machine is tight — prefer Railway builds  

---

## Future recommendations

1. Wire Resend + verified from-domain for real mail  
2. Add Playwright smoke against staging  
3. Optional Redis rate limits if traffic grows past Mongo counters  
4. Tighten CSP with nonces when Next supports it cleanly  
5. Document secret rotation runbook (CRON_SECRET, AUTH_SECRET, OpenRouter)  

---

## Smoke results (post-deploy)

| Path | Status |
|------|--------|
| `/api/health` | 200 |
| `/` | 200 |
| `/robots.txt` | 200 |
| `/feed.xml` | 200 |
| `/sitemap.xml` | 200 |
| `/login` | 200 |
| `/submit` | 200 |
