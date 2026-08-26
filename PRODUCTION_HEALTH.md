# Production health report — cron jobs

**Generated:** 2026-08-04  
**App:** https://papertrail-production-71d6.up.railway.app  
**Health:** `GET /api/health` → `{"status":"ok","db":"connected"}`

## Cron service configuration

| Service | Schedule (UTC) | Endpoint | Auth | Next run (at last check) |
|---------|----------------|----------|------|---------------------------|
| `cron-arxiv` | `0 6 * * *` daily 06:00 | `/api/cron-fetch` | Bearer `CRON_SECRET` | 2026-08-05 06:00 |
| `cron-pubmed` | `30 6 * * *` daily 06:30 | `/api/cron-fetch-pubmed` | Bearer `CRON_SECRET` | 2026-08-05 06:30 |
| `cron-process-queue` | `*/10 * * * *` | `/api/process-queue` | Bearer `CRON_SECRET` | every 10 min |
| `cron-scheduled` | `*/5 * * * *` | `/api/process-scheduled-posts` | Bearer `CRON_SECRET` | every 5 min |
| *(optional)* digest | manual / add cron | `/api/newsletter/digest` | Bearer `CRON_SECRET` | not scheduled by default |

## Authentication

- Production: missing/wrong `CRON_SECRET` → **401 Unauthorized**
- Verified: unauthenticated `process-queue` → 401; authenticated → 200

## Execution model

- Railway **cron services** run a one-shot command and exit (required by Railway).
- Start command uses **alpine + wget** with embedded Bearer token + absolute app URL
  (curl image entrypoint previously broke `sh -c 'curl…'` invocations).

## Manual verification results (session)

| Job | HTTP | Notes |
|-----|------|--------|
| arXiv fetch | 200 | found 1700, enqueued 0 on re-run (already queued) |
| PubMed fetch | 200 | found 30, enqueued 0 on re-run |
| Queue processor | 200 | drafts created when OpenRouter free models available |
| Scheduled posts | 200 | `Nothing due` when queue empty |

## Failures & retries

- App-level queue retries: up to **3 attempts** then `error` status; stuck `processing` reclaimed after **15 minutes**.
- OpenRouter free models may rate-limit; watch `process-queue` logs.
- Cron container failures appear in Railway service logs for each `cron-*` service.

## Operator checks

```bash
railway domain list --service papertrail
node scripts/verify-crons.mjs
railway logs --service cron-process-queue --lines 30
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://papertrail-production-71d6.up.railway.app/api/process-queue
```
