# NEXT TASKS — papertrail (VS Code CLI agents) — round 3, 2026-11-24

> **This file is ONLY for `papertrail`** (`tatassembly-sys/papertrail`, default branch `main`). Do not edit, open or clone any other repository. It is self-contained; ignore anything that belongs to another project.
>
> **Written:** 2026-11-24 by Grok Bot (orchestrator) for Henry. **Status:** ACTIVE brief. The previous brief (2026-11-17) is complete and archived at `agents/vscode/archive/NEXT_TASKS-2026-11-17.md`.
> **Milestones:** PY1, PY2, PY3, PY4, PY5, PY6, PY7. **Test target:** see section 4 (minimum 500 passing automated tests in total).

---

## 0. Kickoff prompt (Henry pastes this into the VS Code CLI agent)

```text
You are a coding agent working ONLY in the GitHub repo tatassembly-sys/papertrail (default branch `main`).
This task is ONLY for papertrail. Do not open, read, clone or change any other repository or folder outside this repo.
Read agents/vscode/NEXT_TASKS.md in full, then AGENTS.md. NEXT_TASKS.md is your complete brief.
1. git fetch origin. If origin/vscode/next-tasks exists: git checkout vscode/next-tasks && git merge origin/main. Otherwise: git checkout -b vscode/next-tasks origin/main.
2. Do milestones PY1 to PY7 as written. Use sub-agents in parallel (one per milestone or test area, see section 3), and keep going until every milestone is complete and verified.
3. Grow the automated test suite to AT LEAST the target in section 4 (never below 500 passing tests in total for this repo). Write real, meaningful tests. No padding or trivial duplicates. Run the FULL suite and record the exact counts in agents/vscode/LOG.md.
4. After each milestone: run its checks plus the full gate, commit, log in agents/vscode/LOG.md, push vscode/next-tasks.
5. Never push to main, never force-push, never edit .github/workflows, nothing that needs new accounts, API keys, live payments, crons or deploys.
6. When done: append Handover notes to agents/vscode/NEXT_TASKS.md, push, and open or update ONE PR vscode/next-tasks -> main labelled vscode-agent. Do not merge it.
```

---

## 1. Current state of `papertrail` (audited 2026-11-24)

**Product:** Paper Trail — Next.js 15 App Router + MongoDB research-digest site. Pre-launch (NO-GO until the M10 launch checklist passes). Hosting (Vercel + Atlas), email, crons, Stripe and legal are owner items.

**Recently merged / merging:** VS Code PX1–PX6 (#12, `f72b175`). Grok Bot PR #14 (`grokbot/next-2026-11-23`) is being merged now: Next 15.5.29, ISR empty-list fix for `/authors` and `/topics` (`lib/isr-fallback.ts`), removal of `app/(home)/loading.tsx` (fixed stuck query-only navigation; regression test in `e2e/smoke.spec.ts`), and GDPR `/api/me/export` 10k-per-section ceiling with `complete`/`truncated`. **Merge `origin/main` before you start and again before each push.**

**Measured 2026-11-24 (Grok Bot box, Node 22, tree = main + PR #14):**

| Suite | Command | Count |
|---|---|---|
| Unit | `npm run test:unit` | **156** pass |
| Integration (in-memory Mongo) | `npm run test:integration` | **39** pass |
| E2E (Playwright) | `npx playwright test --list` | **34** tests in 6 files |
| **Counted total** | | **229** |
| Sandbox scenarios (not counted) | `npm run test:sandbox` | 545/545 |
| Coverage `lib/**` | `npm run test:coverage` | lines 85.33%, branches 77.23%, functions 91.27% (gate 70) |

**Audit findings (real next work):**
1. `lib/` modules still under 80% lines: `cron-lock.ts` 56%, `stripe.ts` 56%, `json-body.ts` 60%, `billing.ts` 61%, `users.ts` 62%, `publish-mix.ts` 67% (branches 47%), `indexes.ts` 70%, `cron-run.ts` 72%, `mail.ts` 74%, `newsletter.ts` 77% (branches 59%), `extract-draft.ts` 79%, `articles.ts` 79%.
2. 47 API route handlers (`app/**/route.ts`) — only some have HTTP-level integration tests; auth/validation/error paths are not proven per route.
3. 33 React components in `components/` have **no** component tests (forms, dialogs, search, highlight tools, billing panel, admin list).
4. E2E covers smoke/a11y/account/admin-a11y/discovery/fonts only — no e2e for collections, highlights, cite/export, newsletter consent, mobile nav, error pages, admin bulk review.
5. No single command counts all tests; there is no test-count report.
6. Open issues/PRs: none besides Grok Bot #14.

---

## 2. Rules (read before writing any code)

1. **Scope.** Only this repository. Never open, clone, read or change another repo.
2. **Branch.** Work on **`vscode/next-tasks`**. If `origin/vscode/next-tasks` exists, check it out and `git merge origin/main`; otherwise `git checkout -b vscode/next-tasks origin/main`. Bring in new `main` commits with `git merge origin/main` (do it at the start and before every push — Grok Bot may merge to `main` while you work). Never rebase pushed commits.
3. **Never** push to `main` or to any `grokbot/*` branch. **Never** force-push. **Never** delete remote branches.
4. **Never edit `.github/workflows/*`** (the token has no workflow scope). CI changes go in `docs/ci/` only.
5. **Pre-launch, cost-free.** No new accounts, API keys, paid services, live payments, cron jobs, deploys or production calls. Use offline mocks, fake test values and local/in-memory databases. If a step truly needs an owner account, log `BLOCKED (owner)` and move on.
6. **Secrets.** Never commit `.env*` values, tokens or keys. Use obvious fakes (`test-secret-0123456789abcdef`).
7. **Log** in `agents/vscode/LOG.md`, newest first, Europe/London time: `claimed`, `done (<hash>)` or `BLOCKED (<reason>)`, with the exact command and its real result line.
8. **Lane hygiene.** Read `agents/grokbot/LOG.md` and open `grok-bot` PRs first. Skip anything Grok Bot has claimed. PR label: `vscode-agent`.
9. **No behaviour change without a test** that fails before and passes after. Never weaken, skip, `.only`, delete or loosen existing tests or assertions; never lower coverage thresholds.
10. **Real tests only.** Each new test must assert a distinct behaviour (input → output, status code, DB state, rendered text/ARIA, error path). Not allowed as "tests": loops generating near-identical cases to inflate counts, snapshot-only tests of static markup, `expect(true)`-style checks, tests that only assert a function exists. Table-driven tests are fine when every row covers a genuinely different case; count them honestly.
11. **Small commits:** `[vscode-agent] <ID>: <summary>`.
12. **No fake completion.** Done = checks exit 0, full gate exits 0, committed, logged with real output lines.
13. **Do not stop** until every milestone is done or `BLOCKED (owner)` with a reason, and the test target is met.
14. **Only Grok Bot (or Henry) merges** into `main`.
15. **Windows note.** Henry's machine is Windows. Use Git Bash (or make scripts cross-platform with Node); keep line endings as they are; do not mass-reformat files you did not change.

### Full gate (run before every push; must exit 0)

```bash
npm ci && npm run lint && npm run typecheck && npm test && npm run test:integration && npm run test:coverage && npm run build && npm audit --omit=dev --audit-level=high && git status --porcelain
```

---

## 3. How to use sub-agents (do this — it is required)

Use your tool's sub-agents / Task tool / parallel workers to speed this up. Suggested split:

- **Lead agent (you):** owns the branch, merges sub-agent results, runs the full gate, writes the log and handover. Only the lead commits and pushes, one milestone at a time, so commits stay reviewable.
- **One sub-agent per milestone or per test area** (see the per-area targets in section 4). Give each sub-agent: the milestone text from this file, the exact files/folders it may touch, and the command that proves it is done.
- Sub-agents must not edit the same files at the same time. Split by folder (e.g. one on `lib/` unit tests, one on API/integration tests, one on e2e, one on UI/accessibility, one on docs).
- Each sub-agent returns: changed files, new test names, the command it ran and its result line. The lead re-runs everything before committing — never trust a sub-agent's summary without re-running.
- Keep going: when a sub-agent finishes, start the next pending milestone or test area until all are done.

---

## 4. Test target — at least 500 passing automated tests (per-area plan)

**Baseline: 229 counted tests** (unit 156 + integration 39 + e2e 34). **Target: ≥ 520** (minimum 500).

| Area | Command | Now | Target | New (approx.) | Milestone |
|---|---|---|---|---|---|
| Unit — `lib/` gaps | `npm run test:unit` | 156 | 270 | +114 | PY2 |
| Unit — components | `npm run test:unit` (new `tests/components/*.test.tsx`) | 0 | 40 | +40 | PY4 |
| Integration — API routes + DB | `npm run test:integration` | 39 | 130 | +91 | PY3, PY6 |
| E2E — Playwright | `npm run test:e2e` | 34 | 80 | +46 | PY5 |
| **Total** | `npm run test:count` (PY1) | **229** | **≥ 520** | **+291** | |

**Counting rule (same for every area):** one test = one test case reported by a test runner (`node:test`, Vitest, Playwright) or one named check in this repo's own suite runners that prints `N passed`. Generated scenario matrices, benchmarks, load tests and probes are listed separately and are **not** counted toward the target.

**Required in your final log entry:** a table with each area's command, before count, after count, and the **TOTAL** (must be ≥ the target and ≥ 500), plus confirmation that the full suite ran in one session with 0 failures (and flake check: run the full suite twice; both runs must pass).

---

## 5. Milestones (in order; parallelise independent ones with sub-agents)

Overview:
1. **PY1 — One command that runs and counts every test** — `npm run test:count` runs all suites and prints the total
2. **PY2 — `lib/` coverage gaps (≈ +114 unit tests)** — test every weak `lib/` module to ≥ 85% lines
3. **PY3 — API route contract tests (≈ +80 integration tests)** — every `app/**/route.ts` has auth, validation and happy-path tests
4. **PY4 — Component tests (≈ +40 unit tests)** — test the interactive components in `components/`
5. **PY5 — E2E journeys, accessibility and mobile (≈ +46 Playwright tests)** — browser tests for journeys not yet covered
6. **PY6 — Hardening, performance and bug sweep** — fix real defects found while testing; add budgets
7. **PY7 — Docs and final test report** — docs match reality; final count ≥ 520

### PY1 — One command that runs and counts every test

**Goal:** Henry can run the whole suite and see one number.

**Steps:**
1. Add `scripts/test-count.mjs` (Node, cross-platform): runs unit, integration and e2e (e2e via the existing Playwright setup with `npm run db:memory` + built app, or `--skip-e2e` flag), parses each runner's pass/fail counts, prints a table and `TOTAL <n>`; exits 1 if any test fails or if `--min <n>` is given and the total is lower. Sandbox scenarios are printed separately as "not counted".
2. `package.json`: `"test:count": "node scripts/test-count.mjs --min 500"`.
3. Unit-test the parser in `tests/test-count.test.ts` (node:test TAP summary, Playwright list/summary, failure lines).
4. Add the command to `docs/ci/proposed-ci.yml` (docs only) and README "Testing".

**Acceptance:** `npm run test:count -- --min 0` prints the table with today's numbers (229 + sandbox line); parser tests pass.
**Self-check:** make one test fail locally → `test:count` exits 1; revert.

---

### PY2 — `lib/` coverage gaps (≈ +114 unit tests)

**Files:** `lib/cron-lock.ts`, `stripe.ts`, `json-body.ts`, `billing.ts`, `users.ts`, `publish-mix.ts`, `indexes.ts`, `cron-run.ts`, `mail.ts`, `newsletter.ts`, `extract-draft.ts`, `articles.ts`. New tests in `tests/*.test.ts` (use `--experimental-test-module-mocks` patterns already in the repo; mock Mongo/network, no real calls — run with `HTTPS_PROXY=http://127.0.0.1:9` to prove it).

**Cover per module:** happy path, every error branch, boundaries. Examples: `json-body` — empty body, invalid JSON, wrong content-type, oversize body, nested limits; `cron-lock` — acquire, held by another, expired lock takeover, release by non-owner; `stripe`/`billing` — billing OFF keeps checkout 503, webhook signature bad/old/duplicate, unknown event ignored; `users` — create/duplicate email/case-folding/password-reset token expiry; `publish-mix` — every branch of the mix selection (currently 47% branches); `newsletter` — consent required, unsubscribe token, double opt-in states; `mail` — log transport when no key, link building with `getSiteUrl()`.
**Bugs:** if a test exposes a bug, fix it in the same milestone with the failing test first.

**Acceptance:** every listed file ≥ 85% lines and ≥ 75% branches in `npm run test:coverage`; total lines ≥ 88%; raise the c8 `--lines` gate from 70 to 80 in `package.json`.
**Self-check:** paste the per-file coverage rows for the 12 files in the log.

---

### PY3 — API route contract tests (≈ +80 integration tests)

**Steps:**
1. List every route handler (`app/**/route.ts`, 47 files) and its methods into a table in `docs/security/route-matrix.md` (it already exists — extend it, don't duplicate) with: auth required (public / user / admin / cron bearer), body schema, expected statuses.
2. In `tests/integration/routes-*.int.test.ts` (in-memory Mongo via the existing preload), for each route: unauthenticated → 401/403 where protected; wrong method → 405; invalid body → 400 with a safe error (no stack, no internals); happy path → 2xx and the DB change; cron routes reject a missing/wrong bearer with constant-time compare.
3. Origin/CSRF check on state-changing routes; rate-limited routes return 429 after the limit.

**Acceptance:** `npm run test:integration` ≥ 120 passing; `tests/route-matrix.test.ts` fails if a new `route.ts` is added without a matrix row (extend the existing test if needed).
**Self-check:** temporarily remove an auth check from one admin route → a test fails; revert.

---

### PY4 — Component tests (≈ +40 unit tests)

**Setup:** add dev-only deps if needed (`@testing-library/react`, `happy-dom` or `jsdom`) — no accounts or services. Keep the runner `node:test` (`tests/components/*.test.tsx` included by `test:unit`), or document clearly if another runner is added and include it in `npm test` and `test:count`.

**Cover:** `SearchBar`/`SearchHotkey`/`ActiveFilters` (keyboard shortcut, clearing filters updates URL), `CiteButton`/`ExportNote` (formats, copy feedback), `CollectionSave`, `HighlightTools`, `SaveActions`, `FollowTopic`, `NewsletterNudge` (consent checkbox required), `LabInquiryForm`/`EditorForm`/`TokenActionForm` (validation messages, disabled while submitting, error display), `NavMenu`/`ThemeToggle` (ARIA expanded/pressed), `BillingPanel`/`CheckoutButtons` (billing off state), `AdminArticleList`/`RetryFailedQueue`.
Each test asserts accessible names/roles and behaviour, not snapshots.

**Acceptance:** ≥ 40 component tests passing in `npm test`; no network calls.

---

### PY5 — E2E journeys, accessibility and mobile (≈ +46 Playwright tests)

**Add specs** (offline: `npm run db:memory` + local build, same as existing e2e): collections (create/rename/delete/save article), highlights, cite + export note, newsletter sign-up consent + unsubscribe link page, account export download shows `complete: true`, account deletion confirm flow, admin bulk review (approve/reject/retry), 404/410/error pages with `noindex`, search with filters and back/forward history (regression for the removed `loading.tsx`), mobile viewport nav menu and keyboard-only navigation, axe scan on every public page (zero serious/critical).

**Acceptance:** `npm run test:e2e` ≥ 80 passing, run 3 times in a row with no flake (`--repeat-each` is not allowed as padding; count unique tests only).
**Self-check:** log the three result lines.

---

### PY6 — Hardening, performance and bug sweep

1. **Security:** CSP/security headers test for every page type; `url-fetch` SSRF guard covers IPv6, decimal/octal IPs, redirects to private ranges; safe-error never leaks stack in production mode; cookie flags (`Secure`, `HttpOnly`, `SameSite`) per cookie.
2. **Data:** GDPR export/delete — test the 10k ceiling path (`truncated` true) with a seeded large user (integration); deletion removes or anonymises every collection listed in the privacy notice.
3. **Performance:** add a local bundle/page-weight budget check (e.g. read `.next` build output; fail if first-load JS for `/` grows > 10% over today's value, recorded in the script) and run `npm run lighthouse` locally against the built app (no external services) — record scores.
4. **Bug sweep:** run the app locally, click through every page in the route list; file each defect in the log, fix it with a failing test first.

**Acceptance:** each fix has a regression test; budgets script in `npm run test:count` output or `npm test`; Lighthouse scores logged (perf/a11y/best-practices/SEO ≥ 90 on home, article, topic pages, or a logged reason).

---

### PY7 — Docs and final test report

1. README "Testing" section: every suite, how to run it offline, `npm run test:count`.
2. `STATUS.md` baseline line and `CHANGELOG.md` `Unreleased` updated with real final numbers.
3. `docs/ci/proposed-ci.yml` (docs only): add the new suites so the owner can copy them later.
4. Check every `npm run <x>` written in docs exists in `package.json`.

**Acceptance:** `npm run test:count` total ≥ 520, 0 failures, run twice; table pasted into the log and handover notes.

---

## 6. Final handover (do this last)

1. Merge `origin/main` once more, run the full gate and the full test count twice on a clean tree; `git status --porcelain` prints nothing.
2. Append a dated entry under **Handover notes** below (template) covering every milestone: commits, exact commands and result lines, the test-count table, coverage numbers, anything `BLOCKED (owner)`, risks.
3. Add a matching entry to `agents/vscode/LOG.md` and a short entry in `PROGRESS.md`.
4. `git push -u origin vscode/next-tasks` (normal push, never forced).
5. Open ONE PR (or update the existing one):
   ```bash
   gh pr create --base main --head vscode/next-tasks --label vscode-agent \
     --title "[vscode-agent] Round 3: PY1–PY7 + test suite to <N> tests" --body-file <summary file>
   ```
   If the label is missing: `gh label create vscode-agent --color 1D76DB`.
6. Do not merge. Grok Bot reviews and squash-merges.

---

## 7. Owner-only items (do NOT attempt)

- MongoDB Atlas, Vercel project + env vars, Railway removal (M0.x).
- cron-job.org schedules, production smoke (M0.8), branch protection, copying `docs/ci/proposed-ci.yml` into `.github/workflows` (M1.4).
- Secret rotation, Resend key + DNS for `papertrailresearch.co.uk`, Stripe (checkout stays 503), UptimeRobot/Sentry, Search Console.
- Legal review, ICO registration, GO decision, `v1.0.0` tag.

---

## Handover notes

<!-- VS Code agents: append dated notes here, newest first. -->

### Template
```markdown
### YYYY-MM-DD HH:MM Europe/London — after <ID(s)>
- Done: …
- Commits on vscode/next-tasks: …
- Test count: | area | command | before | after | … TOTAL: <n> (≥ target), full suite run twice, 0 failures
- Other checks: lint / typecheck / build / coverage / audit result lines
- Blocked (owner): …
- Open issues / risks: …
- PR: <url> (label vscode-agent, not merged)
```
