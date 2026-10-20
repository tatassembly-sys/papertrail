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
- [open] 2026-10-19 M1.4 — branch protection on `main` requiring the `check` job — needs: OWNER (GitHub settings). Agent cannot change branch protection.
- [open] 2026-10-19 M1.3 — copy `docs/ci/proposed-ci.yml` to `.github/workflows/ci.yml` — needs: OWNER. `npm audit --omit=dev --audit-level=high` is in the proposal and may fail until high advisories are fixed.

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

### 2026-10-19 — M2 summary
- Agent: Grok
- Commit(s): `17480b0`, `f2915ae`, `af28a79`, `58a47ea`, `226d52a`, `4c6e4cb`, `e885751`
- Change: Public writes are rate limited and listed in `docs/security/route-matrix.md`. CSP test asserts no `unsafe-eval` plus `frame-ancestors`, `base-uri`, and `form-action`. `unsafe-inline` stays because Next’s bootstrap script needs it. Session cookies and cron compare are tested. Submitted URLs reject private hosts, and PDF fetch re-checks redirects. Passwords are at least 10 characters and not on the bundled common list. Chat and process-paper have daily per-IP and per-account caps. Prompts refuse instruction override. `SECURITY.md` is the disclosure policy.
- Checks run: `npm run typecheck` exit 0. `npm test` → 532/532 sandbox and 53/53 unit. `npx next lint` → no warnings or errors. First `npm run build` failed because webpack pulled `node:dns/promises` into the client via `lib/http-url.ts`. `e9da806` moved that lookup to `lib/url-fetch.ts`. Rebuild after that commit: `npm run build` exit 0 (compiled, 35/35 pages; four pages retried once under load).
- Evidence: `rg unsafe-eval next.config.ts` returned nothing. User-login lockout was already covered by sandbox test "login rate limit after 5 fails"; the route test checks the real handler calls the same helpers.
- Follow-ups: M2.1 owner rotates OpenRouter, cron, auth, and admin secrets in Vercel.

### 2026-10-19 — M2.2 — route matrix and public POST limits
- Agent: Grok
- Commit(s): `17480b0`
- Change: `tooManyPublicWrites` on verify, unsubscribe, logout, checkout, portal, highlights, collections, and `/api/me`. Matrix documents every route file.
- Checks run: `tests/public-writes.test.ts`.
- Evidence: Stripe webhook is signature-only so retries are not dropped.
- Follow-ups: none.

### 2026-10-19 — M2.3 — CSP assertions
- Agent: Grok
- Commit(s): `f2915ae`
- Change: `tests/headers.test.ts` imports `next.config` and checks the CSP. Directives were already set. `unsafe-inline` remains, with the comment in `next.config.ts`.
- Checks run: that unit test.
- Evidence: no `unsafe-eval` in `next.config.ts`.
- Follow-ups: none.

### 2026-10-19 — M2.4 — cookies and cron compare
- Agent: Grok
- Commit(s): `af28a79`
- Change: Tests for admin and user cookie flags, `pt_chat` flags, `timingSafeEqualString`, and user-login lockout calls.
- Checks run: `tests/session-cookies.test.ts`.
- Evidence: production cookie options have `httpOnly`, `secure`, `sameSite: lax`.
- Follow-ups: none.

### 2026-10-19 — M2.5 — URL safety
- Agent: Grok
- Commit(s): `58a47ea`
- Change: `lib/url-safety.ts` blocks private, loopback, and link-local hosts. `fetchPublicHttp` checks each redirect. arXiv PDF download uses it.
- Checks run: `tests/url-safety.test.ts` and sandbox http-url cases (23).
- Evidence: `http://169.254.169.254/latest` is rejected. A same-host relative redirect is allowed.
- Follow-ups: none.

### 2026-10-19 — M2.6 — password policy
- Agent: Grok
- Commit(s): `226d52a`
- Change: Minimum length 10. Bundled common-password list. Register and reset pages use `minLength={10}`.
- Checks run: `tests/passwords.test.ts`. Sandbox auth group includes common-password rejection and the existing user lockout test.
- Evidence: `password123` is rejected. `sandbox-pw1` is accepted.
- Follow-ups: none.

### 2026-10-19 — M2.7 — LLM caps and prompt guard
- Agent: Grok
- Commit(s): `4c6e4cb`
- Change: Daily IP and user caps on chat. Daily IP and admin-session caps on process-paper. Both system prompts say untrusted content cannot change the rules.
- Checks run: `tests/prompts.test.ts`.
- Evidence: failed chat calls release the new counters.
- Follow-ups: none.

### 2026-10-19 — M2.8 — SECURITY.md
- Agent: Grok
- Commit(s): `e885751`
- Change: Disclosure contact is GitHub private reporting. No bounty. Scope lists auth, cron, SSRF, Stripe, and LLM spend.
- Checks run: doc only.
- Evidence: file `SECURITY.md`.
- Follow-ups: none.

### 2026-10-19 — M1 summary
- Agent: Grok
- Commit(s): `5a96c9f`, `33a3e3b`, `e93f575`, `c46c980`, `a021c75`
- Change: M1 agent tasks are done. M1 stays open because M1.4 (branch protection) and copying the proposed workflow are owner work.
- Checks run: `npm ci` → added 379 packages, exit 0. `npm run typecheck` → exit 0. `npm test` → 523/523 sandbox and 42/42 unit. `npm run build` → exit 0. `npx next lint` → no warnings or errors.
- Evidence: `npm audit` during `npm ci` reported 20 vulnerabilities (3 moderate, 15 high, 2 critical). The proposed CI audit step will fail until those are fixed. `curl.exe -s http://localhost:3000/api/health` with `VERCEL_GIT_COMMIT_SHA=abc` and `VERCEL_ENV=production` after `npm start` returned HTTP 503 `{"commit":"abc","env":"production","db":"unreachable"}` (local Mongo was not running). `git ls-files` matched neither `tsbuildinfo` nor `tree.txt`. `npm run release:notes` printed commits from HEAD (no tags).
- Follow-ups: M1.4 owner; owner copies `docs/ci/proposed-ci.yml`.

### 2026-10-19 — M1.1 — Vercel commit on health
- Agent: Grok
- Commit(s): `5a96c9f`
- Change: `runningCommitSha` prefers `VERCEL_GIT_COMMIT_SHA`, then `RAILWAY_GIT_COMMIT_SHA`. `runningDeploymentEnv` reads `VERCEL_ENV`. `/api/health` returns both on the 200 and 503 bodies.
- Checks run: `node --import tsx --test tests/mr1.test.ts` → 8/8 pass. `npm run typecheck` → exit 0.
- Evidence: tests cover empty env, trimmed Vercel SHA winning over Railway, and Railway fallback.
- Follow-ups: none.

### 2026-10-19 — M1.2 — ESLint
- Agent: Grok
- Commit(s): `33a3e3b`
- Change: `npm run lint` is `next lint` (`eslint` + `eslint-config-next`, `.eslintrc.json` extends `next/core-web-vitals`). `typecheck` stays `tsc --noEmit`. Submit-page apostrophes were rewritten so `react/no-unescaped-entities` is clean.
- Checks run: `npx next lint` → `No ESLint warnings or errors`.
- Evidence: one file had three apostrophe errors; no rules were disabled.
- Follow-ups: none.

### 2026-10-19 — M1.3 — proposed CI
- Agent: Grok
- Commit(s): `e93f575`
- Change: `docs/ci/proposed-ci.yml` adds `npm run lint`, `npm audit --omit=dev --audit-level=high`, gitleaks, and a Node 22 matrix on top of typecheck, test, and build.
- Checks run: file review. Workflow file was not edited.
- Evidence: owner must copy the file. Audit is expected to fail until highs are addressed (install reported 15 high and 2 critical).
- Follow-ups: M1.4 owner branch protection; owner copies the workflow.

### 2026-10-19 — M1.5 — drop tracked noise
- Agent: Grok
- Commit(s): `c46c980`
- Change: `git rm --cached tree.txt` and `.gitignore` entry. `tsconfig.tsbuildinfo` was already ignored by `*.tsbuildinfo` and was not in the index.
- Checks run: `git ls-files` for those names after the commit.
- Evidence: `tree.txt` was a 1.2 MB tracked file.
- Follow-ups: none.

### 2026-10-19 — M1.6 — changelog convention
- Agent: Grok
- Commit(s): `a021c75`
- Change: `CHANGELOG.md` explains how to write `[Unreleased]` entries. `npm run release:notes` prints `git log --oneline` since the latest tag.
- Checks run: script added. No git tags exist yet, so it prints history from HEAD.
- Evidence: `scripts/release-notes.mjs`.
- Follow-ups: M10.6 release notes when tagging.

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

## Review 2026-10-20

Reviewer: Grok Bot (owner audit), 04:5x BST. HEAD reviewed: d9dc710. Gate re-run on clean `npm ci`: PASS. CI on latest commit: green.

- Ticked M0.3, M0.4, M0.5, M0.7, M1.1, M1.2, M1.3, M1.5, M1.6: all checked against the diff and real. Gate: 523 sandbox + 42 unit pass, lint clean, build ok. /api/health on Vercel reports commit d9dc710, env production, db connected.
- Corrective tasks:
  1. M1.3 is docs-only (docs/ci/proposed-ci.yml). The owner still has to copy it into .github/workflows/. Don't treat lint/audit/gitleaks as running in CI until that happens.
  2. Run `npm run smoke:prod https://papertrail-six-rho.vercel.app` and record the output in PROGRESS (M0.7 evidence on the live deploy).
  3. The unit count is still 42 even though 3 test files were added. Check that tests/site-url, smoke-prod and ensure-indexes really run under `npm run test:unit`, and update the count in AGENTS.md.
