# Launch checklist — Paper Trail

Every box needs evidence (command output, commit hash, or a dated PROGRESS.md entry) before it is ticked.
Production URL below is `$URL` (today `https://papertrail-six-rho.vercel.app`; the custom domain after M10.3).
Owner-only items are marked `[OWNER]`.

## Code and CI
- [ ] Gate green on the release commit — `npm ci && npm run lint && npm run typecheck && npm test && npm run build`
- [ ] Integration tests green — `npm run test:integration`
- [ ] Coverage recorded (target ≥60% of `lib/`) — `npm run test:coverage`
- [ ] No high/critical prod advisories — `npm audit --omit=dev --audit-level=high` exits 0
- [ ] `[OWNER]` CI workflow copied from `docs/ci/proposed-ci.yml` and green — `gh run list -L 5`
- [ ] `[OWNER]` Branch protection on `main` requires `check` (M1.4) — GitHub settings screenshot

## Hosting and data
- [ ] `/api/health` is ok, db connected, commit = release SHA — `curl -s $URL/api/health`
- [ ] Production smoke passes — `npm run smoke:prod -- $URL`
- [ ] `[OWNER]` Railway service deleted (M0.8), then `railway.toml` removed (M0.9)
- [ ] `[OWNER]` Atlas backups/alerts on (M7.5) — Atlas UI
- [ ] Text search index present on Atlas (see PROGRESS 2026-10-26: strict Stable API blocks text index creation) — `db.articles.getIndexes()` shows `articles_text_search_v2`

## Secrets and security
- [ ] `[OWNER]` Exposed OpenRouter key, `CRON_SECRET`, `AUTH_SECRET`, admin hash rotated (M2.1)
- [ ] Cron routes reject unsigned calls — smoke `unsigned-queue 401`
- [ ] Security headers/CSP present — `curl -sI $URL | grep -i -E "content-security-policy|strict-transport"`
- [ ] gitleaks clean — `gitleaks detect` (CI step once the workflow is copied)

## Scheduler and email
- [ ] `[OWNER]` cron-job.org jobs created (M0.6); `/api/health` `cron_last_run` shows no `stale: true` after 24 h — `curl -s $URL/api/health`
- [ ] `[OWNER]` Resend domain verified (SPF/DKIM/DMARC) and `RESEND_API_KEY` set; health `email: "resend"` (M10.3)
- [ ] Sign-up verify, password reset and newsletter confirm emails arrive — manual test, record in PROGRESS

## Observability
- [ ] `[OWNER]` `SENTRY_DSN` set (optional) and a test error appears in Sentry (M7.1/M7.5)
- [ ] `[OWNER]` UptimeRobot on `/api/health` (M7.5)
- [ ] Logs are JSON with no PII — Vercel log sample

## Quality
- [ ] Lighthouse ≥0.9 on home and a post — `npm run lighthouse` (M8.1)
- [ ] No serious/critical axe issues — `npm run test:e2e` with axe (M8.3)
- [ ] e2e smoke against production (read-only) — `PLAYWRIGHT_BASE_URL=$URL npm run test:e2e` (M10.2)

## Legal, payments, discovery
- [ ] `[OWNER]` Legal review of privacy/terms/cookies; ICO decision; business details in footer (M5.7, M10.5)
- [ ] `[OWNER]` Stripe stays off unless activated (M6.4); health `billing: "off"` until then
- [ ] `[OWNER]` Custom domain; `NEXT_PUBLIC_SITE_URL` updated (M10.3)
- [ ] `[OWNER]` Search Console + sitemap submitted; X/Reddit callbacks updated (M10.4)

## Release
- [ ] `CHANGELOG.md` has `v1.0.0` notes (M10.6); `[OWNER]` pushes tag `v1.0.0`
- [ ] `[OWNER]` `PAPERTRAIL_MARKET_READINESS.md` flipped to GO with date (M10.5)
