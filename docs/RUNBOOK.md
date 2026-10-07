# Paper Trail runbook

Operator steps for the Railway service `papertrail`. Never paste secret values into git, chat, logs, or this file.

The 7-day editorial loop (publish at least one article a day from drafts) and MongoDB backups are owner work. This file does not do them and does not record them as done.

## Redeploy

Pushing `main` does not always deploy. From a Railway CLI session linked to this project:

```
railway redeploy --from-source --service papertrail
```

Then open `/api/health` with no bearer. `status` should be `ok`, and `commit` should be the SHA you meant to ship.

## Rollback

Do not roll back with `--from-source`. That builds the latest source.

1. List history: `railway deployment list --service papertrail --limit 20`
2. Choose an older deployment that succeeded.
3. In the Railway dashboard, open that deployment and choose Rollback. That restores its image and its variables.
4. If retention has dropped the image, choose Redeploy on that same older deployment so Railway rebuilds that commit, not current `main`.

Check `/api/health` again after the replacement is up.

## Rotate secrets

Create the new value in the provider, or generate it locally. Store it only in Railway variables for service `papertrail`. For `CRON_SECRET`, set the same value on the cron services that call the app. Redeploy so the process reloads its environment.

Do not run commands that print variable values, and do not copy the Railway variable screen into tickets or docs. Afterward, an unsigned cron call must return 401, and `/api/health` must still be `ok`. Record that a rotation happened, never the value.

Names only: `CRON_SECRET`, `AUTH_SECRET`, `ADMIN_PASSWORD_HASH`, `OPENROUTER_API_KEY`, `RESEND_API_KEY`, `NEWSLETTER_FROM`, `EMAIL_FROM`, and the Stripe keys if billing is on.

## Restore Mongo

Restoring Mongo is an owner step. Turn on backups (Atlas or a Railway volume snapshot) and restore once into a scratch database. Do not restore over the live database, and do not point tests or scripts at production. Nothing here is a completed backup or restore drill.

## Re-run a cron

Take `CRON_SECRET` from the Railway service variables, not from git. Put it in your shell yourself and do not echo it. `$BASE_URL` is the deployed origin.

```
curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$BASE_URL/api/process-queue"
```

Swap in the path you mean to run:

- `/api/cron-fetch`
- `/api/cron-fetch-pubmed`
- `/api/process-queue`
- `/api/process-scheduled-posts`
- `/api/cron-publish-mix`
- `/api/newsletter/digest` (this one sends mail)

A missing or wrong bearer returns 401, or 503 if the secret is unset in production. A 200 means that job ran. Do not send a valid bearer just to check the route. Queue rows that already failed show on `/admin/status` as `queue.lastError`. Cron process output stays in `railway logs --service cron-process-queue` (and the other `cron-*` services). Unset `CRON_SECRET` in the shell when you finish.
