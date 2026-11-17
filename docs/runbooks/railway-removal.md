# Remove Railway after Vercel and Atlas are live (M0.9)

Do not follow this runbook until the owner has logged M0.8: `npm run smoke:prod`
against the Vercel URL passed, and the owner has said the Vercel project and
the Atlas cluster are the live host. Until then, leave every file below in the
tree. Railway is a rollback path, not the deploy target.

This runbook does not delete anything by itself.

## Confirm first

1. `curl -s https://<project>.vercel.app/api/health` returns `"status":"ok"` and `"db":"connected"`.
2. The health `commit` matches the git revision that was deployed.
3. Unsigned `GET /api/process-queue` returns 401.
4. A missing post returns 404.
5. Atlas holds the data you mean to keep. If the old Railway Mongo still has rows you need, dump it from a machine that can reach it (`mongodump`) and restore into Atlas before the Railway credit lapses. Do not drop the Railway database from this repo.

## Delete these files

- `railway.toml` — Nixpacks build (`npm run build`), start (`npm run start`), healthcheck `/api/health`.
- `.railwayignore` — deploy exclude list (dependencies, `.env*`, local notes).

## Strip Railway wording

Search with `rg -n -i railway`. After the cut-over, the only `RAILWAY_*` reads that may stay are the last-resort site URL fallback in `lib/site-url.ts` and `lib/running-commit.ts` (`RAILWAY_GIT_COMMIT_SHA` after `VERCEL_GIT_COMMIT_SHA`). M0.9 acceptance in `MILESTONES.md` says `rg -n RAILWAY lib app` should show only that fallback. Remove the product docs, not those two readers, unless the owner also wants the fallback gone.

Update these, and do not rewrite history sections just to hide an old URL:

| File | What to change |
|---|---|
| `README.md` | Hosting row, the `railway.toml` line in the tree, deploy step 6, and the sentence that keeps Railway steps in `SETUP.md`. |
| `SETUP.md` | The pre-launch note at the top, the "after verification, remove the Railway service" lines, and the whole "Deploying to Railway (legacy)" section, including the cron curl example that uses `*.up.railway.app`. |
| `STATUS.md` | The current-as-of production line and the M0 row. Leave the dated history that records the old Railway URL. |
| `AGENTS.md` | The `railway.toml` row in the architecture map, and the "Legacy Railway" env names, once the files are gone. |
| `.env.example` | The comment that keeps `NEXT_PUBLIC_SITE_URL` on a Railway host. |
| `docs/launch-checklist.md` | Tick the owner line that says the Railway service is deleted and `railway.toml` is removed. |
| `MILESTONES.md` | Tick M0.9 only after the deletion commit exists. |

Other docs still name Railway as history (`HANDOVER.md`, `CHANGELOG.md`, `docs/RUNBOOK.md`, `PAPERTRAIL_MARKET_READINESS.md`, `PRODUCTION_*.md`, `PHASE_COMPLETION.md`). Point operators at this runbook from the current status. Do not bulk-delete those history files in the same commit.

## Dashboard (owner)

Deleting the files does not stop billing. In the Railway dashboard, remove the web service and any cron services, then the plugin database only after the dump is restored. Remove `RAILWAY_*` variables from the old service. Do not put those values into git.

## Check

```bash
rg -n -i railway README.md SETUP.md STATUS.md railway.toml .railwayignore
```

That command should find nothing after the deletion. `npm run build` still passes without `railway.toml`.
