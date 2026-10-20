# Paper Trail — milestones to market launch

Rewritten 20 October 2026 after a fresh code audit (see `PROGRESS.md` → Baseline audit). This replaces the MR0–MR5 plan; MR0 hosting detail is kept in M0 and in the appendix.

**How to use this file (agents):** follow the loop in [`AGENTS.md`](AGENTS.md) §7. Work top-down. Take the first unchecked `[AGENT]` task in the lowest open milestone. Tick `[x]` with the short commit hash when Definition of Done is met. Never tick an `[OWNER]` task yourself — record in `PROGRESS.md` what you prepared for it.

**Tags:** `[AGENT]` = a coding agent can do it fully in the repo. `[OWNER]` = Henry only (accounts, dashboards, secrets, DNS, legal sign-off, money, production data, workflow files). `[AGENT→OWNER]` = agent prepares (code/runbook/YAML in `docs/`), owner applies.

**Gate** (must pass for every task): `npm ci && npm run typecheck && npm test && npm run build`

**Hosting target:** Vercel Hobby (Next.js, region `lhr1`) + MongoDB Atlas M0 (EU region) + cron-job.org for frequent cron ticks.  No custom domain yet — use the `*.vercel.app` / `*.onrender.com` URLs everywhere and keep the domain configurable via env.

## Milestone index

- **M0** — Hosting cut-over: Railway → Vercel + MongoDB Atlas
- **M1** — Release truth and CI hardening
- **M2** — Security hardening
- **M3** — Correctness and known bugs
- **M4** — Tests and CI depth
- **M5** — Legal and compliance (UK GDPR, PECR)
- **M6** — Payments readiness (Stripe, Paper Trail Pro — optional)
- **M7** — Observability and operations
- **M8** — Performance, accessibility and SEO
- **M9** — UX polish and content operations
- **M10** — Launch checklist and go-live

---

## M0 — Hosting cut-over: Railway → Vercel + MongoDB Atlas

**Goal:** The site runs on `https://<project>.vercel.app` backed by Atlas M0, cron ticks arrive from an external scheduler, Railway is gone.

**Why:** Railway hit its spending cap; production is down. Nothing else matters until users can load the site.

### Tasks
- [ ] **M0.1** `[OWNER]` Create Atlas M0 cluster (EU region, e.g. `eu-west-2`/`eu-west-1`), DB user, Network Access `0.0.0.0/0`; put SRV string in Vercel `MONGODB_URI`, set `MONGODB_DB`. If old data matters: `mongodump` from Railway Mongo before it is deleted, `mongorestore` into Atlas.
- [ ] **M0.2** `[OWNER]` Vercel → import `tatassembly-sys/papertrail` (Next.js preset). Set all env vars from AGENTS.md §4 for Production. Set `NEXT_PUBLIC_SITE_URL=https://<project>.vercel.app`.
- [x] **M0.3** `[AGENT]` Add `scripts/ensure-indexes.mjs` (or extend existing) that calls the index definitions in `lib/indexes.ts` idempotently; document `node scripts/ensure-indexes.mjs` in `SETUP.md`. Must refuse to run unless `CONFIRM_INDEXES=yes` is set. (`3e92d68`)
- [x] **M0.4** `[AGENT]` Replace Railway fallbacks: in `lib/` site-URL helpers, prefer `NEXT_PUBLIC_SITE_URL`, then `https://${VERCEL_PROJECT_PRODUCTION_URL}`, then `VERCEL_URL`; keep `RAILWAY_*` only as last fallback. Unit test in `tests/site-url.test.ts`. (`0998658`)
- [x] **M0.5** `[AGENT]` Write `docs/runbooks/cron-job-org.md`: each cron URL, cadence, header `Authorization: Bearer <CRON_SECRET>`, expected 200 body, and how to see the last run on `/admin/status`. (`147edf9`)
- [ ] **M0.6** `[OWNER]` Create the cron-job.org jobs from `docs/runbooks/cron-job-org.md`.
- [x] **M0.7** `[AGENT]` Add `scripts/smoke-prod.mjs <baseUrl>`: GET `/`, `/api/health` (expects `status: ok`), a missing post slug (expects 404), unsigned `/api/process-queue` (expects 401), `/sitemap.xml`, `/robots.txt`. Exit non-zero on any mismatch. npm script `smoke:prod`. (`26f3bf3`)
- [ ] **M0.8** `[OWNER]` Run `npm run smoke:prod -- https://<project>.vercel.app`; paste output into PROGRESS.md. Then delete the Railway service.
- [ ] **M0.9** `[AGENT]` After M0.8 is logged: delete `railway.toml`/`.railwayignore`, remove Railway wording from README/SETUP/STATUS. — BLOCKED (see PROGRESS)

### Acceptance criteria (all verifiable)
- `node scripts/smoke-prod.mjs http://localhost:3000` passes against `npm run build && npm start` with a local Mongo (or is documented as skipped).
- `npm run test:unit` includes `tests/site-url.test.ts` and passes.
- `rg -n RAILWAY lib app` shows only the documented last-resort fallback (after M0.9: no matches).
- The gate passes: `npm ci && npm run typecheck && npm test && npm run build`

### Self-check before closing M0
1. Every `[AGENT]` box in M0 is `[x]` with a commit hash, or marked `— BLOCKED` with a `PROGRESS.md` entry.
2. Re-run every acceptance command above from a clean shell; paste results into the M0 summary in `PROGRESS.md`.
3. `git log --oneline origin/main -20` shows your commits; `git status` is clean.
4. Re-read the diff of the whole milestone (`git diff <first-commit>^..HEAD`) for leftovers, secrets and unrelated changes.
5. Update the milestone line in `STATUS.md`.

### Agent prompt (copy-paste)
```text
You are working in tatassembly-sys/papertrail. Read AGENTS.md fully, then MILESTONES.md section M0 ("Hosting cut-over: Railway → Vercel + MongoDB Atlas") and PROGRESS.md (BLOCKERS).
Sync with `git pull --rebase origin main`. Work through the unchecked [AGENT] tasks of M0 in order using the loop in AGENTS.md §7:
reproduce -> smallest fix -> add/extend a test -> run the task's acceptance commands -> run the gate `npm ci && npm run typecheck && npm test && npm run build` ->
self-review `git diff` -> tick the box with the commit hash -> add a PROGRESS.md entry -> Conventional Commit tagged [M0.N] -> push (never force).
Skip [OWNER] tasks but prepare everything reversible for them (runbooks in docs/, proposed CI YAML in docs/ci/). Do not edit .github/workflows.
If blocked, log it under BLOCKERS in PROGRESS.md and continue. When all tasks are done, run the M0 self-check and write the milestone summary.
Report: tasks completed (with hashes), tasks blocked (why), and the gate output.
```

---

## M1 — Release truth and CI hardening

**Goal:** Anyone can tell which commit is live, and CI blocks bad code.

**Why:** Earlier audits could not prove what production ran. A launch needs traceable releases.

### Tasks
- [x] **M1.1** `[AGENT]` `lib/running-commit.ts`: read `VERCEL_GIT_COMMIT_SHA` first, then `RAILWAY_GIT_COMMIT_SHA`; also expose `VERCEL_ENV`. Extend `tests/mr1.test.ts`. (`5a96c9f`)
- [x] **M1.2** `[AGENT]` Add ESLint (`next lint` / flat config with `eslint-config-next`), make `npm run lint` run ESLint (keep `typecheck` separate). Fix or explicitly disable (with comment) existing violations. (`33a3e3b`)
- [x] **M1.3** `[AGENT→OWNER]` Write `docs/ci/proposed-ci.yml` adding: `npm run lint`, `npm audit --omit=dev --audit-level=high`, gitleaks secret scan, Node 22 matrix. Owner copies into `.github/workflows/ci.yml`. (`e93f575`)
- [ ] **M1.4** `[OWNER]` Enable branch protection on `main`: require the `check` job. — BLOCKED (see PROGRESS)
- [x] **M1.5** `[AGENT]` Remove committed noise: `git rm --cached tsconfig.tsbuildinfo tree.txt`, add to `.gitignore`. (`c46c980`)
- [x] **M1.6** `[AGENT]` Add `CHANGELOG.md` entry convention and a `npm run release:notes` script that prints commits since last tag. (`a021c75`)

### Acceptance criteria (all verifiable)
- `curl -s localhost:3000/api/health | jq .commit` is non-null when `VERCEL_GIT_COMMIT_SHA=abc npm start`.
- `npm run lint` runs ESLint and exits 0.
- `git ls-files | rg 'tsbuildinfo|tree.txt'` returns nothing.
- The gate passes: `npm ci && npm run typecheck && npm test && npm run build`

### Self-check before closing M1
1. Every `[AGENT]` box in M1 is `[x]` with a commit hash, or marked `— BLOCKED` with a `PROGRESS.md` entry.
2. Re-run every acceptance command above from a clean shell; paste results into the M1 summary in `PROGRESS.md`.
3. `git log --oneline origin/main -20` shows your commits; `git status` is clean.
4. Re-read the diff of the whole milestone (`git diff <first-commit>^..HEAD`) for leftovers, secrets and unrelated changes.
5. Update the milestone line in `STATUS.md`.

### Agent prompt (copy-paste)
```text
You are working in tatassembly-sys/papertrail. Read AGENTS.md fully, then MILESTONES.md section M1 ("Release truth and CI hardening") and PROGRESS.md (BLOCKERS).
Sync with `git pull --rebase origin main`. Work through the unchecked [AGENT] tasks of M1 in order using the loop in AGENTS.md §7:
reproduce -> smallest fix -> add/extend a test -> run the task's acceptance commands -> run the gate `npm ci && npm run typecheck && npm test && npm run build` ->
self-review `git diff` -> tick the box with the commit hash -> add a PROGRESS.md entry -> Conventional Commit tagged [M1.N] -> push (never force).
Skip [OWNER] tasks but prepare everything reversible for them (runbooks in docs/, proposed CI YAML in docs/ci/). Do not edit .github/workflows.
If blocked, log it under BLOCKERS in PROGRESS.md and continue. When all tasks are done, run the M1 self-check and write the milestone summary.
Report: tasks completed (with hashes), tasks blocked (why), and the gate output.
```

---

## M2 — Security hardening

**Goal:** No known exploitable weakness in auth, admin, cron, uploads or headers.

**Why:** Public launch exposes admin, LLM spend and user accounts to the internet.

### Tasks
- [ ] **M2.1** `[OWNER]` Rotate the previously exposed `OPENROUTER_API_KEY`, `CRON_SECRET`, `AUTH_SECRET`, admin password hash; set only in Vercel. — BLOCKED (see PROGRESS)
- [x] **M2.2** `[AGENT]` Audit every `app/api/**/route.ts`: list method, auth requirement, rate limit, input validation in `docs/security/route-matrix.md`. Any public POST without rate limit or schema validation gets fixed + test. (`17480b0`)
- [x] **M2.3** `[AGENT]` CSP in `next.config.ts`: remove `unsafe-eval`; move inline scripts to nonces/hashes where feasible; add `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`. Test headers in `tests/headers.test.ts` (import config and assert). (`f2915ae`)
- [x] **M2.4** `[AGENT]` Cookies: assert `HttpOnly`, `Secure` (prod), `SameSite=Lax` on all session cookies; constant-time compare for `CRON_SECRET` (`crypto.timingSafeEqual`). Tests. (`af28a79`)
- [x] **M2.5** `[AGENT]` SSRF: `lib/url-safety` must block private IPs, `localhost`, link-local and non-http(s) for submitted URLs/PDF fetches, including after redirects. Extend `tests/url-safety.test.ts`. (`58a47ea`, `e9da806`)
- [x] **M2.6** `[AGENT]` Password policy: min 10 chars, reject top common passwords list (small bundled list), lockout already in `lib/loginAttempts.ts` — add test for user accounts too. (`226d52a`)
- [x] **M2.7** `[AGENT]` LLM abuse: per-user and per-IP daily caps on `articles/[id]/chat` and `process-paper`; prompt-injection guard text in `lib/prompts.ts`; tests. (`4c6e4cb`)
- [x] **M2.8** `[AGENT]` Add `SECURITY.md` (contact, scope, disclosure). (`e885751`)

### Acceptance criteria (all verifiable)
- `npm test` includes headers, cookie, url-safety, rate-limit tests, all pass.
- `docs/security/route-matrix.md` lists every file from `ls app/api/**/route.ts`.
- `rg -n "unsafe-eval" next.config.ts` returns nothing.
- The gate passes: `npm ci && npm run typecheck && npm test && npm run build`

### Self-check before closing M2
1. Every `[AGENT]` box in M2 is `[x]` with a commit hash, or marked `— BLOCKED` with a `PROGRESS.md` entry.
2. Re-run every acceptance command above from a clean shell; paste results into the M2 summary in `PROGRESS.md`.
3. `git log --oneline origin/main -20` shows your commits; `git status` is clean.
4. Re-read the diff of the whole milestone (`git diff <first-commit>^..HEAD`) for leftovers, secrets and unrelated changes.
5. Update the milestone line in `STATUS.md`.

### Agent prompt (copy-paste)
```text
You are working in tatassembly-sys/papertrail. Read AGENTS.md fully, then MILESTONES.md section M2 ("Security hardening") and PROGRESS.md (BLOCKERS).
Sync with `git pull --rebase origin main`. Work through the unchecked [AGENT] tasks of M2 in order using the loop in AGENTS.md §7:
reproduce -> smallest fix -> add/extend a test -> run the task's acceptance commands -> run the gate `npm ci && npm run typecheck && npm test && npm run build` ->
self-review `git diff` -> tick the box with the commit hash -> add a PROGRESS.md entry -> Conventional Commit tagged [M2.N] -> push (never force).
Skip [OWNER] tasks but prepare everything reversible for them (runbooks in docs/, proposed CI YAML in docs/ci/). Do not edit .github/workflows.
If blocked, log it under BLOCKERS in PROGRESS.md and continue. When all tasks are done, run the M2 self-check and write the milestone summary.
Report: tasks completed (with hashes), tasks blocked (why), and the gate output.
```

---

## M3 — Correctness and known bugs

**Goal:** Public pages return correct HTTP status and content; pipelines are idempotent.

**Why:** SEO and trust depend on correct 404s, canonical URLs and no duplicate posts.

### Tasks
- [ ] **M3.1** `[AGENT]` Status codes: missing post/topic/author/list → 404 (all four), add tests mirroring `tests/mr1.test.ts`. Verify `notFound()` is called before any streaming boundary.
- [ ] **M3.2** `[AGENT]` Cron idempotency: running `cron-fetch`/`process-queue` twice concurrently must not create duplicate articles (unique index on source id + lock doc). Test in sandbox.
- [ ] **M3.3** `[AGENT]` Scheduled posts: timezone handling in Europe/London incl. DST change dates; test with fixed clock.
- [ ] **M3.4** `[AGENT]` Canonical URLs + `sitemap.ts` only list published posts; exclude unpublished/missing; test.
- [ ] **M3.5** `[AGENT]` Unsubscribe/verify links: tokens expire, single-use; test in `tests/email-links.test.ts`.
- [ ] **M3.6** `[AGENT]` Grep for TODO/FIXME; turn each into a task here or fix it.

### Acceptance criteria (all verifiable)
- `npm test` passes with new 404/idempotency/DST tests.
- `curl -s -o /dev/null -w '%{http_code}' localhost:3000/topics/does-not-exist` → 404 (local run).
- The gate passes: `npm ci && npm run typecheck && npm test && npm run build`

### Self-check before closing M3
1. Every `[AGENT]` box in M3 is `[x]` with a commit hash, or marked `— BLOCKED` with a `PROGRESS.md` entry.
2. Re-run every acceptance command above from a clean shell; paste results into the M3 summary in `PROGRESS.md`.
3. `git log --oneline origin/main -20` shows your commits; `git status` is clean.
4. Re-read the diff of the whole milestone (`git diff <first-commit>^..HEAD`) for leftovers, secrets and unrelated changes.
5. Update the milestone line in `STATUS.md`.

### Agent prompt (copy-paste)
```text
You are working in tatassembly-sys/papertrail. Read AGENTS.md fully, then MILESTONES.md section M3 ("Correctness and known bugs") and PROGRESS.md (BLOCKERS).
Sync with `git pull --rebase origin main`. Work through the unchecked [AGENT] tasks of M3 in order using the loop in AGENTS.md §7:
reproduce -> smallest fix -> add/extend a test -> run the task's acceptance commands -> run the gate `npm ci && npm run typecheck && npm test && npm run build` ->
self-review `git diff` -> tick the box with the commit hash -> add a PROGRESS.md entry -> Conventional Commit tagged [M3.N] -> push (never force).
Skip [OWNER] tasks but prepare everything reversible for them (runbooks in docs/, proposed CI YAML in docs/ci/). Do not edit .github/workflows.
If blocked, log it under BLOCKERS in PROGRESS.md and continue. When all tasks are done, run the M3 self-check and write the milestone summary.
Report: tasks completed (with hashes), tasks blocked (why), and the gate output.
```

---

## M4 — Tests and CI depth

**Goal:** Critical user journeys are covered by automated tests that CI runs.

**Why:** Agents will change a lot of code; only tests stop regressions.

### Tasks
- [ ] **M4.1** `[AGENT]` Add Playwright (`@playwright/test`) with `e2e/` smoke: home loads, post page, register form validation, admin login rejects bad password. `npm run test:e2e` (not in gate until stable).
- [ ] **M4.2** `[AGENT]` Integration tests against `mongodb-memory-server` for `lib/users.ts`, `lib/submissions.ts`, rate-limit; `npm run test:integration`.
- [ ] **M4.3** `[AGENT]` Coverage report (`c8`) for unit tests; record baseline % in PROGRESS.md; target ≥60% of `lib/`.
- [ ] **M4.4** `[AGENT→OWNER]` Add the new suites to `docs/ci/proposed-ci.yml` (services: none needed with memory server).

### Acceptance criteria (all verifiable)
- `npm run test:integration` passes offline.
- `npx playwright test` passes against `npm run build && npm start` (local Mongo) or is logged as skipped with reason.
- The gate passes: `npm ci && npm run typecheck && npm test && npm run build`

### Self-check before closing M4
1. Every `[AGENT]` box in M4 is `[x]` with a commit hash, or marked `— BLOCKED` with a `PROGRESS.md` entry.
2. Re-run every acceptance command above from a clean shell; paste results into the M4 summary in `PROGRESS.md`.
3. `git log --oneline origin/main -20` shows your commits; `git status` is clean.
4. Re-read the diff of the whole milestone (`git diff <first-commit>^..HEAD`) for leftovers, secrets and unrelated changes.
5. Update the milestone line in `STATUS.md`.

### Agent prompt (copy-paste)
```text
You are working in tatassembly-sys/papertrail. Read AGENTS.md fully, then MILESTONES.md section M4 ("Tests and CI depth") and PROGRESS.md (BLOCKERS).
Sync with `git pull --rebase origin main`. Work through the unchecked [AGENT] tasks of M4 in order using the loop in AGENTS.md §7:
reproduce -> smallest fix -> add/extend a test -> run the task's acceptance commands -> run the gate `npm ci && npm run typecheck && npm test && npm run build` ->
self-review `git diff` -> tick the box with the commit hash -> add a PROGRESS.md entry -> Conventional Commit tagged [M4.N] -> push (never force).
Skip [OWNER] tasks but prepare everything reversible for them (runbooks in docs/, proposed CI YAML in docs/ci/). Do not edit .github/workflows.
If blocked, log it under BLOCKERS in PROGRESS.md and continue. When all tasks are done, run the M4 self-check and write the milestone summary.
Report: tasks completed (with hashes), tasks blocked (why), and the gate output.
```

---

## M5 — Legal and compliance (UK GDPR, PECR)

**Goal:** Privacy notice, terms, cookie policy and consent are accurate for what the code actually does.

**Why:** UK GDPR/PECR apply from the first UK visitor; newsletter needs lawful consent; ICO fee may be due.

### Tasks
- [ ] **M5.1** `[AGENT]` Data inventory `docs/legal/data-inventory.md`: every Mongo collection, fields with personal data, purpose, lawful basis, retention, processor (Atlas, Vercel, Resend, OpenRouter, Stripe).
- [ ] **M5.2** `[AGENT]` Update `app/privacy/page.tsx` from the inventory (controller identity placeholder, rights, retention, processors, international transfers — Vercel/Atlas US/EU, OpenRouter).
- [ ] **M5.3** `[AGENT]` Add `app/cookies/page.tsx`; list each cookie set by the app. If only strictly-necessary cookies, say so and do not add a banner; if any analytics is added later, add consent first.
- [ ] **M5.4** `[AGENT]` Account deletion + data export: `DELETE /api/me` and `GET /api/me/export` (auth, rate-limited), with tests; link from `/account`.
- [ ] **M5.5** `[AGENT]` Newsletter: double opt-in already — verify, log consent timestamp + source; unsubscribe in one click (List-Unsubscribe header).
- [ ] **M5.6** `[AGENT]` Copyright: article pages credit source paper, authors, licence and link; refuse to publish full text of non-open-licence papers. Test in sandbox.
- [ ] **M5.7** `[OWNER]` Legal review of privacy/terms/cookies; ICO registration decision; business name/address in footer.

### Acceptance criteria (all verifiable)
- `ls app/privacy app/terms app/cookies` all exist and are linked from the footer.
- Tests for `/api/me` delete/export pass.
- The gate passes: `npm ci && npm run typecheck && npm test && npm run build`

### Self-check before closing M5
1. Every `[AGENT]` box in M5 is `[x]` with a commit hash, or marked `— BLOCKED` with a `PROGRESS.md` entry.
2. Re-run every acceptance command above from a clean shell; paste results into the M5 summary in `PROGRESS.md`.
3. `git log --oneline origin/main -20` shows your commits; `git status` is clean.
4. Re-read the diff of the whole milestone (`git diff <first-commit>^..HEAD`) for leftovers, secrets and unrelated changes.
5. Update the milestone line in `STATUS.md`.

### Agent prompt (copy-paste)
```text
You are working in tatassembly-sys/papertrail. Read AGENTS.md fully, then MILESTONES.md section M5 ("Legal and compliance (UK GDPR, PECR)") and PROGRESS.md (BLOCKERS).
Sync with `git pull --rebase origin main`. Work through the unchecked [AGENT] tasks of M5 in order using the loop in AGENTS.md §7:
reproduce -> smallest fix -> add/extend a test -> run the task's acceptance commands -> run the gate `npm ci && npm run typecheck && npm test && npm run build` ->
self-review `git diff` -> tick the box with the commit hash -> add a PROGRESS.md entry -> Conventional Commit tagged [M5.N] -> push (never force).
Skip [OWNER] tasks but prepare everything reversible for them (runbooks in docs/, proposed CI YAML in docs/ci/). Do not edit .github/workflows.
If blocked, log it under BLOCKERS in PROGRESS.md and continue. When all tasks are done, run the M5 self-check and write the milestone summary.
Report: tasks completed (with hashes), tasks blocked (why), and the gate output.
```

---

## M6 — Payments readiness (Stripe, Paper Trail Pro — optional)

**Goal:** Pro can be switched on in test mode end to end; live switch is one owner action.

**Why:** Revenue path; must not charge anyone wrongly.

### Tasks
- [ ] **M6.1** `[AGENT]` Review `app/api/billing/*` + `lib/entitlements.ts`: webhook signature verify, idempotency on `event.id`, handles `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed`. Extend `tests/stripe.test.ts`.
- [ ] **M6.2** `[AGENT]` Write `docs/runbooks/stripe-go-live.md` (products/prices, tax, webhook URL `https://<vercel>/api/billing/webhook`, portal config, test cards, rollback = unset keys).
- [ ] **M6.3** `[AGENT]` Pricing page shows VAT-inclusive prices and links terms; checkout disabled cleanly (503 + friendly UI) when billing off.
- [ ] **M6.4** `[OWNER]` Stripe account activation, test-mode keys in Vercel Preview, live keys only at launch.

### Acceptance criteria (all verifiable)
- `npm run test:unit` stripe tests cover all 4 event types + bad signature + duplicate event.
- The gate passes: `npm ci && npm run typecheck && npm test && npm run build`

### Self-check before closing M6
1. Every `[AGENT]` box in M6 is `[x]` with a commit hash, or marked `— BLOCKED` with a `PROGRESS.md` entry.
2. Re-run every acceptance command above from a clean shell; paste results into the M6 summary in `PROGRESS.md`.
3. `git log --oneline origin/main -20` shows your commits; `git status` is clean.
4. Re-read the diff of the whole milestone (`git diff <first-commit>^..HEAD`) for leftovers, secrets and unrelated changes.
5. Update the milestone line in `STATUS.md`.

### Agent prompt (copy-paste)
```text
You are working in tatassembly-sys/papertrail. Read AGENTS.md fully, then MILESTONES.md section M6 ("Payments readiness (Stripe, Paper Trail Pro — optional)") and PROGRESS.md (BLOCKERS).
Sync with `git pull --rebase origin main`. Work through the unchecked [AGENT] tasks of M6 in order using the loop in AGENTS.md §7:
reproduce -> smallest fix -> add/extend a test -> run the task's acceptance commands -> run the gate `npm ci && npm run typecheck && npm test && npm run build` ->
self-review `git diff` -> tick the box with the commit hash -> add a PROGRESS.md entry -> Conventional Commit tagged [M6.N] -> push (never force).
Skip [OWNER] tasks but prepare everything reversible for them (runbooks in docs/, proposed CI YAML in docs/ci/). Do not edit .github/workflows.
If blocked, log it under BLOCKERS in PROGRESS.md and continue. When all tasks are done, run the M6 self-check and write the milestone summary.
Report: tasks completed (with hashes), tasks blocked (why), and the gate output.
```

---

## M7 — Observability and operations

**Goal:** Failures are visible within minutes and there is a runbook for each.

**Why:** Free tiers fail silently (Atlas pauses, cron misses, LLM quota).

### Tasks
- [ ] **M7.1** `[AGENT]` Add Sentry (`@sentry/nextjs`) gated on `SENTRY_DSN` (no-op if unset); scrub PII; document env.
- [ ] **M7.2** `[AGENT]` Structured JSON logger `lib/log.ts` (level, route, requestId, no PII); replace `console.*` in API routes.
- [ ] **M7.3** `[AGENT]` `/api/health` adds `cron_last_run` per job and `queue_depth`; `/admin/status` shows stale cron (>2× cadence) in red.
- [ ] **M7.4** `[AGENT]` `docs/runbooks/incidents.md`: DB down, LLM quota, cron missed, email bounce, how to roll back on Vercel (Promote previous deployment).
- [ ] **M7.5** `[OWNER]` UptimeRobot (free) on `/api/health`; Sentry project; Atlas alerting email.

### Acceptance criteria (all verifiable)
- With `SENTRY_DSN` unset the build and tests pass and no network calls happen (test).
- `curl localhost:3000/api/health | jq 'has("cron_last_run")'` → true.
- The gate passes: `npm ci && npm run typecheck && npm test && npm run build`

### Self-check before closing M7
1. Every `[AGENT]` box in M7 is `[x]` with a commit hash, or marked `— BLOCKED` with a `PROGRESS.md` entry.
2. Re-run every acceptance command above from a clean shell; paste results into the M7 summary in `PROGRESS.md`.
3. `git log --oneline origin/main -20` shows your commits; `git status` is clean.
4. Re-read the diff of the whole milestone (`git diff <first-commit>^..HEAD`) for leftovers, secrets and unrelated changes.
5. Update the milestone line in `STATUS.md`.

### Agent prompt (copy-paste)
```text
You are working in tatassembly-sys/papertrail. Read AGENTS.md fully, then MILESTONES.md section M7 ("Observability and operations") and PROGRESS.md (BLOCKERS).
Sync with `git pull --rebase origin main`. Work through the unchecked [AGENT] tasks of M7 in order using the loop in AGENTS.md §7:
reproduce -> smallest fix -> add/extend a test -> run the task's acceptance commands -> run the gate `npm ci && npm run typecheck && npm test && npm run build` ->
self-review `git diff` -> tick the box with the commit hash -> add a PROGRESS.md entry -> Conventional Commit tagged [M7.N] -> push (never force).
Skip [OWNER] tasks but prepare everything reversible for them (runbooks in docs/, proposed CI YAML in docs/ci/). Do not edit .github/workflows.
If blocked, log it under BLOCKERS in PROGRESS.md and continue. When all tasks are done, run the M7 self-check and write the milestone summary.
Report: tasks completed (with hashes), tasks blocked (why), and the gate output.
```

---

## M8 — Performance, accessibility and SEO

**Goal:** Lighthouse ≥90 performance/accessibility/SEO on home and a post page.

**Why:** Organic search is the main acquisition channel for a research explainer site.

### Tasks
- [ ] **M8.1** `[AGENT]` Add `npm run lighthouse` (lighthouse-ci with `lighthouserc.json`, assertions ≥0.9) against a local prod build; record scores in PROGRESS.md.
- [ ] **M8.2** `[AGENT]` Structured data: `Article`/`ScholarlyArticle` JSON-LD on posts, `BreadcrumbList`; validate with a unit test of the generated object.
- [ ] **M8.3** `[AGENT]` Accessibility: run `@axe-core/playwright` in e2e on home/post/register; fix all serious/critical.
- [ ] **M8.4** `[AGENT]` Caching: ISR/`revalidate` for public pages, `Cache-Control` on `posts/published` API; Mongo projection to avoid sending full text in lists.
- [ ] **M8.5** `[AGENT]` Images/fonts: `next/font`, OG images cached; no layout shift.

### Acceptance criteria (all verifiable)
- `npm run lighthouse` passes assertions locally.
- axe e2e reports 0 serious/critical.
- The gate passes: `npm ci && npm run typecheck && npm test && npm run build`

### Self-check before closing M8
1. Every `[AGENT]` box in M8 is `[x]` with a commit hash, or marked `— BLOCKED` with a `PROGRESS.md` entry.
2. Re-run every acceptance command above from a clean shell; paste results into the M8 summary in `PROGRESS.md`.
3. `git log --oneline origin/main -20` shows your commits; `git status` is clean.
4. Re-read the diff of the whole milestone (`git diff <first-commit>^..HEAD`) for leftovers, secrets and unrelated changes.
5. Update the milestone line in `STATUS.md`.

### Agent prompt (copy-paste)
```text
You are working in tatassembly-sys/papertrail. Read AGENTS.md fully, then MILESTONES.md section M8 ("Performance, accessibility and SEO") and PROGRESS.md (BLOCKERS).
Sync with `git pull --rebase origin main`. Work through the unchecked [AGENT] tasks of M8 in order using the loop in AGENTS.md §7:
reproduce -> smallest fix -> add/extend a test -> run the task's acceptance commands -> run the gate `npm ci && npm run typecheck && npm test && npm run build` ->
self-review `git diff` -> tick the box with the commit hash -> add a PROGRESS.md entry -> Conventional Commit tagged [M8.N] -> push (never force).
Skip [OWNER] tasks but prepare everything reversible for them (runbooks in docs/, proposed CI YAML in docs/ci/). Do not edit .github/workflows.
If blocked, log it under BLOCKERS in PROGRESS.md and continue. When all tasks are done, run the M8 self-check and write the milestone summary.
Report: tasks completed (with hashes), tasks blocked (why), and the gate output.
```

---

## M9 — UX polish and content operations

**Goal:** A first-time visitor understands the product in 10 seconds; the owner can run content daily in 15 minutes.

**Why:** Retention and owner time are the scaling limits.

### Tasks
- [ ] **M9.1** `[AGENT]` Empty/error/loading states for every public page (except `posts/[slug]` loading, see AGENTS.md).
- [ ] **M9.2** `[AGENT]` Onboarding: `/welcome` topic picks → personalised `/today`; newsletter CTA after 2nd article.
- [ ] **M9.3** `[AGENT]` Admin: bulk approve/reject queue, show LLM model used + cost estimate, retry failed items.
- [ ] **M9.4** `[AGENT]` Mobile layout pass at 360px; dark mode contrast check.
- [ ] **M9.5** `[AGENT]` Search: `search/suggest` debounced, keyboard accessible, empty-state suggestions.

### Acceptance criteria (all verifiable)
- Playwright mobile viewport smoke passes.
- Admin queue actions covered by sandbox scenarios.
- The gate passes: `npm ci && npm run typecheck && npm test && npm run build`

### Self-check before closing M9
1. Every `[AGENT]` box in M9 is `[x]` with a commit hash, or marked `— BLOCKED` with a `PROGRESS.md` entry.
2. Re-run every acceptance command above from a clean shell; paste results into the M9 summary in `PROGRESS.md`.
3. `git log --oneline origin/main -20` shows your commits; `git status` is clean.
4. Re-read the diff of the whole milestone (`git diff <first-commit>^..HEAD`) for leftovers, secrets and unrelated changes.
5. Update the milestone line in `STATUS.md`.

### Agent prompt (copy-paste)
```text
You are working in tatassembly-sys/papertrail. Read AGENTS.md fully, then MILESTONES.md section M9 ("UX polish and content operations") and PROGRESS.md (BLOCKERS).
Sync with `git pull --rebase origin main`. Work through the unchecked [AGENT] tasks of M9 in order using the loop in AGENTS.md §7:
reproduce -> smallest fix -> add/extend a test -> run the task's acceptance commands -> run the gate `npm ci && npm run typecheck && npm test && npm run build` ->
self-review `git diff` -> tick the box with the commit hash -> add a PROGRESS.md entry -> Conventional Commit tagged [M9.N] -> push (never force).
Skip [OWNER] tasks but prepare everything reversible for them (runbooks in docs/, proposed CI YAML in docs/ci/). Do not edit .github/workflows.
If blocked, log it under BLOCKERS in PROGRESS.md and continue. When all tasks are done, run the M9 self-check and write the milestone summary.
Report: tasks completed (with hashes), tasks blocked (why), and the gate output.
```

---

## M10 — Launch checklist and go-live

**Goal:** A signed-off, reversible public launch.

**Why:** Turns NO-GO into GO with evidence.

### Tasks
- [ ] **M10.1** `[AGENT]` Write `docs/launch-checklist.md` with every item below as a checkbox + the command that proves it.
- [ ] **M10.2** `[AGENT]` Run `npm run smoke:prod -- <url>`, lighthouse, e2e against production (read-only); paste results.
- [ ] **M10.3** `[OWNER]` Custom domain + Resend domain verified (SPF/DKIM/DMARC); update `NEXT_PUBLIC_SITE_URL`.
- [ ] **M10.4** `[OWNER]` Google Search Console + submit sitemap; X/Reddit app callback URLs updated.
- [ ] **M10.5** `[OWNER]` Final legal sign-off; flip `PAPERTRAIL_MARKET_READINESS.md` to GO with date.
- [ ] **M10.6** `[AGENT]` Tag release `v1.0.0` notes in `CHANGELOG.md` (tag push by owner).

### Acceptance criteria (all verifiable)
- Every box in `docs/launch-checklist.md` is ticked with evidence.
- `smoke:prod` against the production URL passes.
- The gate passes: `npm ci && npm run typecheck && npm test && npm run build`

### Self-check before closing M10
1. Every `[AGENT]` box in M10 is `[x]` with a commit hash, or marked `— BLOCKED` with a `PROGRESS.md` entry.
2. Re-run every acceptance command above from a clean shell; paste results into the M10 summary in `PROGRESS.md`.
3. `git log --oneline origin/main -20` shows your commits; `git status` is clean.
4. Re-read the diff of the whole milestone (`git diff <first-commit>^..HEAD`) for leftovers, secrets and unrelated changes.
5. Update the milestone line in `STATUS.md`.

### Agent prompt (copy-paste)
```text
You are working in tatassembly-sys/papertrail. Read AGENTS.md fully, then MILESTONES.md section M10 ("Launch checklist and go-live") and PROGRESS.md (BLOCKERS).
Sync with `git pull --rebase origin main`. Work through the unchecked [AGENT] tasks of M10 in order using the loop in AGENTS.md §7:
reproduce -> smallest fix -> add/extend a test -> run the task's acceptance commands -> run the gate `npm ci && npm run typecheck && npm test && npm run build` ->
self-review `git diff` -> tick the box with the commit hash -> add a PROGRESS.md entry -> Conventional Commit tagged [M10.N] -> push (never force).
Skip [OWNER] tasks but prepare everything reversible for them (runbooks in docs/, proposed CI YAML in docs/ci/). Do not edit .github/workflows.
If blocked, log it under BLOCKERS in PROGRESS.md and continue. When all tasks are done, run the M10 self-check and write the milestone summary.
Report: tasks completed (with hashes), tasks blocked (why), and the gate output.
```

---

## Appendix A — previous MR0 hosting plan (kept verbatim; still valid detail for M0)

### (old) MR0 — Pre-launch hosting: move off Railway to Vercel (+ MongoDB Atlas) — TOP PRIORITY

**Why:** Railway spend is capped, so production is down. Paper Trail is a plain Next.js 15 app on the `mongodb` driver, so it fits Vercel Hobby and an Atlas M0 (free) cluster with no code rewrite.

**Fit assessment (12 Oct 2026):** Next.js App Router, no custom server, no websockets, no workers. DB = MongoDB (`MONGODB_URI`/`MONGODB_DB`), so **Atlas M0** is the right DB. Background work is HTTP cron routes (`/api/cron-fetch`, `/api/cron-fetch-pubmed`, `/api/process-queue`, `/api/process-scheduled-posts`, `/api/cron-publish-mix`) protected by `CRON_SECRET` bearer. Longest route `maxDuration = 120` (process-queue), within Vercel limits. Vercel Hobby crons run **at most once a day**, so frequent ticks need an external free scheduler (cron-job.org or similar) sending `Authorization: Bearer $CRON_SECRET`. Railway-only file: `railway.toml` / `.railwayignore` (keep until cut-over is verified, then delete). No file storage on disk (PDFs fetched and parsed in memory with `unpdf`). Stripe is off; webhook route is `/api/billing/webhook`.

### Tasks
- [ ] **[HUMAN]** Create a MongoDB Atlas M0 cluster (region near Vercel `lhr1`/`fra1`), a DB user, and Network Access `0.0.0.0/0` (Vercel has no fixed IPs). Copy the SRV string into `MONGODB_URI`. If the Railway Mongo data is needed, export it with `mongodump` from a local machine before Railway credit lapses and `mongorestore` into Atlas.
- [ ] **[HUMAN]** Vercel → Add New Project → import `tatassembly-sys/papertrail`, framework Next.js, defaults (build `npm run build`). Set env vars below for Production (and Preview if wanted).
- [ ] **[AGENT]** Re-create MongoDB indexes on Atlas using the documented index script/steps in `SETUP.md` (run only against the new, empty Atlas DB with the owner's go-ahead).
- [x] **[AGENT]** Replace Railway wording in `SETUP.md`, `README.md`, `STATUS.md` and comments (e.g. `cron-fetch` "Railway cron budget") with Vercel. Do not delete `railway.toml` until the Vercel deploy is verified. (Done 13 Oct 2026.)
- [x] **[AGENT]** Optional: add `vercel.json` with `"regions": ["lhr1"]` and one daily cron (e.g. `/api/cron-fetch-pubmed`) only if it does not clash with the external scheduler. (Done 13 Oct 2026: `regions: [lhr1]` only; no Hobby daily crons so they do not clash with cron-job.org.)
- [ ] **[HUMAN]** Set up the external scheduler (cron-job.org free): `GET https://<vercel-domain>/api/cron-fetch`, `/api/cron-fetch-pubmed`, `/api/process-queue`, `/api/process-scheduled-posts`, `/api/cron-publish-mix` with header `Authorization: Bearer <CRON_SECRET>`, same cadence as on Railway (see `SETUP.md` "Cron").
- [ ] **[HUMAN]** Update `NEXT_PUBLIC_SITE_URL` to the Vercel URL (or the custom domain once DNS exists: add the domain in Vercel → set `A 76.76.21.21` / `CNAME cname.vercel-dns.com`). Update X/Twitter app callback URLs if OAuth is used, and Resend domain links when MR2 lands.
- [ ] **[HUMAN]** Stripe (only when MR5 starts): webhook endpoint `https://<domain>/api/billing/webhook`.
- [ ] **[HUMAN]** After verification, remove the Railway service so it cannot bill again.

### Env vars (names only)
`MONGODB_URI`, `MONGODB_DB`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`, `OPENROUTER_API_KEY`, plus any Twitter/X, Resend and Stripe keys already used on Railway (copy the full Railway variable list; never commit values).

### Verification / exit criteria
- `GET https://<vercel-domain>/api/health` → `status ok`, `db connected`.
- Unsigned `GET /api/process-queue` → 401; signed (bearer) → 200.
- Home page, a post page, admin login work. One scheduled tick from cron-job.org shows in logs.
- `npm run typecheck`, `npm test`, `npm run build` pass locally.
