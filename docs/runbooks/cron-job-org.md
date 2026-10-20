# cron-job.org schedules

Paper Trail's frequent jobs are HTTP routes. Vercel Hobby can only run a cron
once a day, so create these jobs on cron-job.org (or another external
scheduler). Do this only after the Vercel project exists. A 200 runs the job.

## Every job

- Method: `GET`
- URL: `https://<project>.vercel.app` plus the path below
- Header: `Authorization: Bearer <CRON_SECRET>`
- `<CRON_SECRET>` is the Vercel environment variable. Do not put the value in
  the repo, this file, or the job title.
- An unsigned call must return HTTP 401. A wrong bearer returns 401. A missing
  `CRON_SECRET` on the server returns 503.
- A finished authorized run is stored. Open `/admin/status` (admin sign-in) and
  read the row for that job: `ok` or `failed`, the HTTP status, the duration,
  and the time. "No run recorded" means no authorized run has finished since
  logging was added. Unauthorized calls are not stored.

## Jobs

| Job on `/admin/status` | Path | Suggested cadence (UTC) | HTTP 200 body |
|---|---|---|---|
| `cron-fetch` | `/api/cron-fetch` | `0 6 * * *` (daily) | JSON. The sweep enqueues papers; it does not publish them. |
| `cron-fetch-pubmed` | `/api/cron-fetch-pubmed` | `30 6 * * *` (daily) | JSON. Enqueues PubMed items. |
| `process-queue` | `/api/process-queue` | `*/10 * * * *` | JSON with `success: true`. This drafts articles. It can take up to 120 seconds. |
| `process-scheduled-posts` | `/api/process-scheduled-posts` | `*/5 * * * *` | JSON with `success: true`. |
| `cron-publish-mix` | `/api/cron-publish-mix` | `0 8 * * *` (daily) | JSON with `success: true`. Publishes at most the daily field mix. |
| `newsletter-digest` | `/api/newsletter/digest` | `0 15 * * 0` (Sunday) | JSON with `success: true`. Sends only when Resend is configured. |

These cadences match the previous host. Change them in cron-job.org if the
owner wants a different clock. Do not also add the same paths to `vercel.json`
crons, or the jobs will run twice.

## After the first tick

1. Confirm the cron-job.org history shows HTTP 200.
2. Sign in at `/admin/status` and confirm that job's row is no longer "No run recorded".
3. If the row says `failed`, read the redacted error on that row. Do not paste
   secrets from the host logs into the repo.
