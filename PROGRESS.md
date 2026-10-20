# PROGRESS.md — Paper Trail

Append-only log written by coding agents and the owner. Newest entries at the top of **Log**. Times are Europe/London.

## Entry template
```markdown
### YYYY-MM-DD HH:MM — <task id> — <short title>
- Agent: <Claude Code | Codex | Cursor | human>
- Commit(s): <short hash(es)>
- Change: <one or two lines>
- Checks run: `<command>` → <pass/fail + key line>
- Evidence: <test name, curl output, screenshot path>
- Follow-ups: <new task ids or none>
```

## BLOCKERS
Format: `- [open|resolved] YYYY-MM-DD <task id> — <what is blocked> — needs: <who/what> — tried: <...>`

- [open] 2026-10-20 M0 — Atlas cluster, Vercel project, cron-job.org schedules — needs: OWNER.
- [open] 2026-10-20 M0.9 — delete Railway files only after M0.8 production smoke is logged — needs: OWNER to run `npm run smoke:prod` on the Vercel URL and delete the Railway service.
- [open] 2026-10-20 M2 — OpenRouter key rotation, Resend domain — needs: OWNER.

## Baseline audit — 20 October 2026

Audited tip: `d1045eb` on `main`. Environment: Linux box, Node 22, clean `npm ci`, **no live databases** (DB-backed suites ran in their offline/mocked modes only).

### Baseline check results
| Check | Command | Result |
|---|---|---|
| Install | `npm ci` | ✅ pass |
| Typecheck | `npm run typecheck` | ✅ pass |
| Lint | `npm run lint` | ✅ pass (alias of typecheck; no ESLint configured) |
| Tests | `npm test` | ✅ pass — "All sandbox scenarios passed" (520) + unit 34/34 |
| Build | `npm run build` | ✅ pass |
| CI workflow | `.github/workflows/ci.yml` | present (typecheck, test, build on Node 22) |

### Findings (with evidence)
1. **CI now exists** (`.github/workflows/ci.yml`) — earlier "no CI" gap is closed. It has no ESLint, no dependency audit, no secret scan.
2. **Missing article 404 fixed in code**: commits `01aa7ed`, `696e424`, `453ce63`; `app/posts/[slug]/` has `page.tsx`, `not-found.tsx`, `opengraph-image.tsx` and no `loading.tsx`. Not re-verified on a live host (production down).
3. **Deploy commit not observable on Vercel**: `lib/running-commit.ts` reads only `RAILWAY_GIT_COMMIT_SHA`; `/api/health` returns `commit` → `null` on Vercel.
4. **Legacy Railway env reads** remain (`RAILWAY_PUBLIC_DOMAIN`, `RAILWAY_STATIC_URL`) — site URL fallback will be wrong on Vercel unless `NEXT_PUBLIC_SITE_URL` is set.
5. **CSP present** in `next.config.ts`; review for `unsafe-inline` before launch.
6. **No cookie policy page** (`app/cookies` absent); `privacy` and `terms` exist.
7. **Email still in "log" mode** (Resend not configured; no domain). Verification / reset / newsletter emails will not arrive in production.
8. **No error tracking** (no Sentry or equivalent); only `console.error`.
9. `tsconfig.tsbuildinfo` and `tree.txt` are committed noise.
10. Rate limiting is Mongo-backed (good for serverless); login lockout in `lib/loginAttempts.ts`.

### Top 3 risks
1. **Production is down and email is not wired** — even after Vercel cut-over, sign-up verification, password reset and newsletter confirmation cannot complete without Resend + a sending domain (owner).
2. **Exposed OpenRouter key not yet rotated** — anyone holding it can spend against the account; rotate before the new deploy goes public.
3. **Release truth on Vercel** — `/api/health` cannot report the running commit (Railway-only env), so nobody can prove which code is live; plus no error tracking to see failures.

## Log

### 2026-10-19 — M0.3 — confirmed index bootstrap
- Agent: Grok
- Commit(s): `3e92d68`
- Change: `CONFIRM_INDEXES=yes node scripts/ensure-indexes.mjs` applies `lib/indexes.ts` and refuses otherwise. Documented in `SETUP.md`.
- Checks run: `node scripts/ensure-indexes.mjs` without the flag → exit 1, stderr contains `CONFIRM_INDEXES=yes`, under 2s (`tests/ensure-indexes.test.ts`). With the flag against local `127.0.0.1:27017` → `Indexes ensured on papertrail.` twice.
- Evidence: unit test pass; local MongoDB 7 container only. Not run against Atlas.
- Follow-ups: owner runs it on Atlas after M0.1.

### 2026-10-19 — M0.4 — Vercel site URL order
- Agent: Grok
- Commit(s): `0998658`
- Change: `getSiteUrl` prefers `NEXT_PUBLIC_SITE_URL`, then `VERCEL_PROJECT_PRODUCTION_URL`, then `VERCEL_URL`. Railway hosts are the last fallback.
- Checks run: `npm run test:unit` → `tests/site-url.test.ts` pass. Sandbox site-url group 7/7.
- Evidence: explicit URL beats Vercel; Vercel production host beats Railway.
- Follow-ups: none.

### 2026-10-19 — M0.5 — cron-job.org runbook
- Agent: Grok
- Commit(s): `147edf9`
- Change: `docs/runbooks/cron-job-org.md` lists six jobs, cadences, the bearer header, expected 200, and `/admin/status`.
- Checks run: doc only. No scheduler was created.
- Evidence: file matches `CRON_JOBS` in `lib/cron-run.ts`.
- Follow-ups: M0.6 owner creates the jobs.

### 2026-10-19 — M0.7 — read-only production smoke
- Agent: Grok
- Commit(s): `26f3bf3`
- Change: `npm run smoke:prod` checks `/`, `/api/health` (`status: ok`), a missing post (404), unsigned `/api/process-queue` (401), `/sitemap.xml`, `/robots.txt`.
- Checks run: `node scripts/smoke-prod.mjs http://localhost:3000` against `npm run build && npm start` with local Mongo → `OK home 200`, `OK health 200`, `OK missing-post 404`, `OK unsigned-queue 401`, `OK sitemap 200`, `OK robots 200`.
- Evidence: that local run. Not run against Vercel (no project yet). Gate before these commits: `npm ci` (cleanup EPERM warning, install exit 0), `npm run typecheck` exit 0, `npm test` → 523/523 sandbox and 41/41 unit, `npm run build` exit 0.
- Follow-ups: M0.8 owner runs the same command on the Vercel URL.

### 20 October 2026 — setup — agent operating manual and launch milestones
- Agent: Grok Bot (audit)
- Change: added `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/agents.mdc`, `PROGRESS.md`; rewrote `MILESTONES.md` (M0..M10); refreshed `STATUS.md` header.
- Checks run: see Baseline check results above.
- Follow-ups: start at M0.


## Vercel deployment (2026-10-20)
- Production URL: https://papertrail-six-rho.vercel.app (Vercel project `papertrail`, scope `procureai1`, GitHub repo connected for auto-deploy from `main`).
- Env vars set (production): MONGODB_URI, MONGODB_DB, AUTH_SECRET, CRON_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD_HASH, NEXT_PUBLIC_SITE_URL. Email in log mode (no RESEND_API_KEY); OpenRouter/Stripe/social unset.
- Status: homepage 200, cron unsigned 401. /api/health 503 `db: unreachable` — Atlas rejects the TLS handshake (alert 80): add 0.0.0.0/0 to Atlas Network Access.
- TODO: Atlas network access; cron-job.org jobs with CRON_SECRET (stored in Vercel env); OPENROUTER_API_KEY for article generation.
