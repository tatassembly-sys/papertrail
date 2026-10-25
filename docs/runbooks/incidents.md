# Incident runbook

Times in Europe/London. Live site: https://papertrail-six-rho.vercel.app (Vercel, Hobby, auto-deploys `main`).

First step for every incident:

```bash
curl -s https://papertrail-six-rho.vercel.app/api/health
npm run smoke:prod -- https://papertrail-six-rho.vercel.app
```

`/api/health` reports `status`, `db`, `openrouter`, `email`, `billing`, and the deployed `commit`. Never paste secrets into issues or PROGRESS.md.

## Database down (`db` is not `connected`)

1. Check MongoDB Atlas → cluster status, and Network Access still allows `0.0.0.0/0` (Vercel egress IPs are not fixed).
2. Check Vercel → Settings → Environment Variables: `MONGODB_URI` and `MONGODB_DB` exist for Production. If you rotated the DB password, update `MONGODB_URI` and redeploy.
3. Atlas M0 has connection limits. Many `MongoServerSelectionError` lines in Vercel → Logs usually mean the cluster is paused or at capacity.
4. Public pages degrade. Cron/queue routes fail and retry on the next tick, so no manual replay is needed.

## LLM quota or outage (`openrouter: false`, or processing errors)

1. Vercel Logs: look for 429/402 from OpenRouter/xAI.
2. The free tier (`openrouter/free`) is rate limited. Queue items stay pending and `lastError` is recorded (see `/admin/status`).
3. Daily per-user LLM caps (M2.7) protect spend. Don't raise them during an incident.
4. Once quota recovers, the next `process-queue` tick drains the backlog.

## Cron missed

1. cron-job.org → job history for `cron-fetch`, `process-queue`, etc. (see `cron-job-org.md`).
2. 401/503 responses mean `CRON_SECRET` doesn't match or is unset in Vercel. Fix the header or the env var.
3. You can run a job by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://…/api/process-queue` (in your own shell, without echoing the secret). Cron routes are idempotent (M3.2 lock), so re-running is safe.

## Email bounce / not sending (`email: log` means email isn't configured)

1. Check the provider dashboard for bounces/suppressions. Remove a hard-bounced address from the newsletter.
2. Check that sender domain DNS (SPF/DKIM/DMARC) still verifies.
3. Verify/unsubscribe links are single-use and expire (M3.5). If needed, the user can request a new one.

## Bad deploy: roll back on Vercel

1. Vercel → Project → Deployments → pick the last good deployment (match its commit with `/api/health` history) → **⋯ → Promote to Production** (instant, no rebuild).
2. Then `git revert <bad sha>` on `main` and push, so the next auto-deploy doesn't bring the bug back.
3. Re-run `npm run smoke:prod` and record the incident in PROGRESS.md (what, when, fix).
