# AGENTS.md — operating manual for coding agents (Paper Trail)

> Read this whole file before you change anything. It applies to Claude Code, Codex, Cursor, Copilot and any other agent.
> `CLAUDE.md` and `.cursor/rules/agents.mdc` point here. If they ever disagree, **this file wins**.
> Work queue: [`MILESTONES.md`](MILESTONES.md). Log: [`PROGRESS.md`](PROGRESS.md). Snapshot for humans: [`STATUS.md`](STATUS.md).

Last full audit: 20 October 2026 (Europe/London). Default branch: `main`.

---

## 1. What this project is
Paper Trail turns research papers (arXiv RSS, PubMed, manual PDF/URL submissions) into plain-English articles using an LLM (OpenRouter free models, xAI fallback, extract-only fallback), publishes them on a public site (posts, topics, authors, lists, library, daily digest), runs a newsletter, optional social posting (X, Reddit, Facebook, Instagram) and an optional "Paper Trail Pro" subscription via Stripe (currently **off**). Admin area under `/admin` (username + bcrypt hash env). Single Next.js 15 App Router app, MongoDB native driver, no ORM.

## 2. Architecture map
| Path | What lives there |
|---|---|
| `app/` | App Router pages. Public: `(home)`, `posts/[slug]`, `topics/[tag]`, `authors/[slug]`, `lists/[id]`, `library`, `today`, `feed`, `newsletter/*`, `pricing`, `privacy`, `terms`, `about`. Users: `register`, `user-login`, `verify-email`, `forgot-password`, `reset-password`, `account`, `welcome`. Admin: `admin/*`, `login`. `sitemap.ts`, `robots.ts`, OG images. |
| `app/api/` | Route handlers: `auth/*`, `articles/[id]/*` (share, schedule, export, approve-share, chat), `collections`, `highlights`, `submissions`, `newsletter/*`, `billing/*` (checkout, portal, webhook, inquiry), `admin/*`, cron routes (`cron-fetch`, `cron-fetch-pubmed`, `process-queue`, `process-scheduled-posts`, `cron-publish-mix`) protected by `CRON_SECRET` bearer, `health`, `me`, `search/suggest`, `posts/published`. |
| `lib/` | Domain + infra: `mongodb.ts` (client/pool), `indexes.ts`, `rate-limit.ts` (Mongo-backed, hashed IP), `loginAttempts.ts`, `auth-credentials.ts`, `users.ts`, `mail.ts` (Resend or log), `entitlements.ts`/Stripe, `openrouter.ts`, `pubmed.ts`, `prompts.ts`, `submissions.ts`, `safe-error.ts`, `running-commit.ts`, `request-ip.ts`. |
| `components/` | React UI components. |
| `middleware.ts` | Edge middleware (admin gate / headers). |
| `next.config.ts` | Security headers incl. CSP; `X-Robots-Tag: noindex` on private routes. |
| `sandbox/run.mjs` | 532-scenario offline sandbox suite (`npm run test:sandbox`). |
| `tests/*.test.ts` | `node:test` unit tests via `tsx` (`npm run test:unit`). |
| `scripts/` | Ops scripts (index creation etc.). |
| `vercel.json` | `regions: ["lhr1"]`, no crons (external scheduler instead). |
| `railway.toml` | Legacy; delete after Vercel cut-over is verified (M0). |

## 3. Commands that work (verified 20 October 2026 on a clean `npm ci`)
| Purpose | Command | Notes |
|---|---|---|
| Install | `npm ci` | Node 22 (CI uses 22). |
| Dev server | `npm run dev` | needs `MONGODB_URI` + `AUTH_SECRET` (≥32 chars) in `.env.local`. |
| Typecheck | `npm run typecheck` | `tsc --noEmit`. |
| Lint | `npm run lint` | `next lint` with `eslint-config-next` (`next/core-web-vitals`). |
| Release notes | `npm run release:notes` | `git log` since the latest tag. |
| All tests | `npm test` | sandbox (532 scenarios) + unit (53 tests). No DB needed. |
| Unit only | `npm run test:unit` | `node --import tsx --test tests/*.test.ts` |
| Build | `npm run build` | `next build`; works without a live DB. |

**The gate.** Run this before every commit. It must exit 0:

```bash
npm ci && npm run typecheck && npm test && npm run build
```

CI (`.github/workflows/ci.yml`) runs `npm ci`, `typecheck`, `test`, `build` on Node 22 for pushes/PRs to `main`.

## 4. Environment variables (names only; never commit values)
Copy `.env.example` (or the example file named below) to `.env` / `.env.local` for local work. Production values live only in the host dashboards (Vercel / Render / Atlas / Neon).

Required: `MONGODB_URI` (alias `MONGO_URL`), `MONGODB_DB`, `AUTH_SECRET` (≥32 chars; `JWT_SECRET` legacy), `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (bcrypt), `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`.
LLM: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_FREE_MODELS`, `OPENROUTER_MAX_TOKENS`, `OPENROUTER_CHAT_MAX_TOKENS`, `XAI_API_KEY`, `XAI_MODEL`.
Sources: `ARXIV_RSS_CATEGORIES`, `PUBMED_CONTACT_EMAIL`, `PUBMED_TOOL_NAME`.
Email: `RESEND_API_KEY`, `EMAIL_FROM`, `NEWSLETTER_FROM`.
Billing (off): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `STRIPE_AUTOMATIC_TAX`, `BILLING_MONTHLY_LABEL`, `BILLING_YEARLY_LABEL`, `BILLING_GRANT_EMAILS`.
Social (optional): `ENABLE_X_API_POSTING`, `REDDIT_*`, `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_ACCESS_TOKEN`, `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ACCOUNT_ID`.
Mongo tuning: `MONGODB_MAX_POOL_SIZE`, `MONGODB_MIN_POOL_SIZE`, `MONGODB_SERVER_SELECTION_TIMEOUT_MS`, `MONGODB_STABLE_API`.
Legacy Railway (remove in M0/M1): `RAILWAY_GIT_COMMIT_SHA`, `RAILWAY_PUBLIC_DOMAIN`, `RAILWAY_STATIC_URL`. Vercel provides `VERCEL_GIT_COMMIT_SHA`, `VERCEL_URL`, `VERCEL_ENV`.

If you add a new variable: add it to the example env file with a safe placeholder, to the list above, and to the hosting section of `MILESTONES.md` M0. Read it through the existing config module, not with scattered `process.env` calls.

## 5. Coding conventions
- TypeScript strict; import via `@/` alias. Route handlers declare `export const runtime = "nodejs"` when they use Mongo.
- All DB access goes through `lib/mongodb.ts` `getDb()`; add indexes in `lib/indexes.ts`, never ad-hoc.
- Public errors via `lib/safe-error.ts` (`publicErrorMessage`). Never return driver/TLS text.
- Rate limits via `lib/rate-limit.ts` (hashed IP keys). Any new public POST needs one.
- Cron/admin routes must check `CRON_SECRET` bearer / admin session first, before any work.
- Server components fetch data directly; client components only where interaction needs it.
- Tests: unit tests in `tests/<area>.test.ts` (`node:test` + `assert/strict`); scenario coverage in `sandbox/`.
- Keep changes small and focused. One concern per commit.
- Match the style already in the file you are editing. Do not reformat whole files you are not otherwise changing.
- Every bug fix gets a test that fails before the fix and passes after.
- Errors returned to clients must not leak stack traces, driver messages or secrets.
- No new runtime dependency without a one-line reason in the commit body. Prefer the platform/standard library.
- Dates and times shown to UK users: Europe/London. Money: integer minor units (pence/kobo/cents), never floats.

## 6. Definition of Done (a task is only "done" when ALL are true)
1. The code change does what the task says, and the task's **Acceptance** commands pass.
2. The gate (section 3) exits 0 locally.
3. New/changed behaviour has an automated test (unit, integration or scenario script) wired into an npm script that CI runs.
4. You re-read your own diff (`git diff --staged`) and fixed anything sloppy: debug logs, commented-out code, TODOs without a milestone id, secrets, unrelated changes.
5. Docs touched by the change are updated (README/SETUP/env example/this file).
6. The checkbox in `MILESTONES.md` is ticked `[x]` with the short commit hash, and a `PROGRESS.md` entry is added.
7. The commit is pushed and `git status` is clean.

## 7. The mandatory work loop
Repeat until you run out of `[AGENT]` tasks or time:

1. **Sync.** `git fetch origin && git pull --rebase origin main`. Never work on a stale tree.
2. **Pick.** Open `MILESTONES.md`. Take the **first unchecked `[AGENT]` task in the lowest-numbered open milestone**. Skip `[OWNER]` tasks and tasks listed under `BLOCKERS` in `PROGRESS.md`.
3. **Understand.** Read the files the task names, and their tests. Reproduce the problem (failing test, curl, script) before fixing it.
4. **Implement** the smallest change that meets the acceptance criteria.
5. **Check.** Run the task's Acceptance commands, then the full gate.
6. **Self-review.** `git diff` line by line. Ask: is it correct, safe, tested, minimal? Would a senior reviewer accept it? Fix and go back to 5.
7. **Record.** Tick the box in `MILESTONES.md` (`- [x] ... (abc1234)`; fill the hash in the next commit if needed). Add a `PROGRESS.md` entry using the template.
8. **Commit** with a Conventional Commit message: `type(scope): summary` — types `feat`, `fix`, `test`, `docs`, `refactor`, `perf`, `chore`, `ci`, `security`. Reference the task id, e.g. `fix(posts): return 404 for missing slug [M2.3]`.
9. **Push.** `git push origin HEAD:main`. If rejected: `git pull --rebase`, re-run the gate, push again. **Never** `--force`.
10. **Continue** with the next task. When a milestone's tasks are all ticked, run its **Self-check** list, write a milestone summary in `PROGRESS.md`, then move on.

## 8. Guardrails (non-negotiable)
- **No secrets** in code, tests, fixtures, logs, docs or commit messages. Use placeholders like `<set-in-dashboard>`. If you find one committed, stop, do not copy it anywhere, add an `[OWNER]` rotation task and a BLOCKERS entry.
- **No force-push**, no history rewrite, no `git reset --hard` on shared branches, no branch deletion.
- **Never edit `.github/workflows/*`.** The automation token has no `workflow` scope, so the push will be refused. Put the proposed YAML in `docs/ci/proposed-<name>.yml` and add an `[OWNER]` task to copy it in.
- **No destructive data operations** (drop, truncate, `prisma db push --accept-data-loss`, `migrate reset`, `deleteMany` with no filter, bulk deletes) against any remote database. Schema changes must be additive first; anything destructive needs a written backup step (`pg_dump`/`mongodump`) and an `[OWNER]` sign-off.
- **Do not touch production**: no deploys from a laptop, no changes in hosting dashboards, no writes to live databases, no sending real email/SMS/payments. Read-only `curl` against public URLs is fine.
- **Do not add tracking, analytics or third-party scripts** without updating the privacy/cookie pages in the same change.
- **Do not weaken security** to make a test pass (CSP, auth checks, rate limits, CORS, cookie flags).
- **Stay in this repository.** Never modify other repositories (and never touch `DiasporaBridge`).
- **Payments stay in test mode.** Never put live Stripe keys anywhere; live switch is `[OWNER]` only.

## 9. Stop-and-ask list (`[OWNER]` only — log it, do not do it)
Creating/changing accounts or dashboards (Vercel, Render, Atlas, Neon, Upstash, Cloudinary, Stripe, Resend, DNS registrar, Google/X apps); setting or rotating secrets; DNS records; buying anything; legal sign-off on privacy/terms/DPIA text; enabling live payments; production data migrations/restores; deleting hosted services; contacting real users or suppliers; editing GitHub workflows, branch protection or repo settings.

When a task needs one of these, finish everything reversible around it (code, docs, scripts, a step-by-step runbook in `docs/`), then record it as below.

## 10. Blockers
If you cannot finish a task (needs an `[OWNER]` step, missing credential, ambiguous spec, flaky external service, failing check you cannot fix in ~30 minutes):
1. Add an entry to the `## BLOCKERS` section of `PROGRESS.md`: date, task id, what you tried, exact error, what is needed and from whom.
2. Leave the checkbox unticked; append ` — BLOCKED (see PROGRESS)` to the task line.
3. Commit the partial safe work if it passes the gate; otherwise discard it.
4. Move to the next task. Do not stall, do not guess credentials, do not invent results.

## 11. Honesty rules for reporting
- Only write "verified" when you ran the command and saw the result. Paste the command and the key output line into `PROGRESS.md`.
- Never mark a task done because the code "should" work. Never claim production state you did not observe.
- If a check was skipped (no DB, no network), say so explicitly.

## 12. Repository-specific notes
- Missing articles: `app/posts/[slug]/` has **no** `loading.tsx` on purpose (a loading boundary makes Next stream a 200 before `notFound()`). Do not add one. Regression tests live in `tests/mr1.test.ts`.
- `lib/running-commit.ts` reads `VERCEL_GIT_COMMIT_SHA`, then `RAILWAY_GIT_COMMIT_SHA`. `/api/health` also returns `env` from `VERCEL_ENV` (including on the 503 path).
- Vercel Hobby crons run at most daily; frequent jobs are triggered by an external scheduler with `Authorization: Bearer $CRON_SECRET`. Keep cron handlers idempotent and under `maxDuration` (process-queue = 120 s).
- The OpenRouter key was previously exposed and must be rotated by the owner (M2).
