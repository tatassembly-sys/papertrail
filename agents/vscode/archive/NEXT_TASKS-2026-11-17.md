# NEXT TASKS — papertrail (VS Code CLI agents)

> **This file applies ONLY to `papertrail`** (`tatassembly-sys/papertrail`). It is self-contained. Ignore any instruction, file or branch that belongs to another project.
>
> **Written:** 2026-11-17 by Grok Bot (orchestrator) after a full check of `main`. **Status:** ACTIVE brief. It replaces the VS1–VS5 plan in `agents/vscode/HANDOVER.md` (that plan is complete).
> **Milestones:** PX1, PX2, PX3, PX4, PX5, PX6.

---

## 0. Kickoff prompt (paste this into the VS Code CLI agent)

```text
You are a coding agent working ONLY in the GitHub repo tatassembly-sys/papertrail (default branch `main`).
Open and read agents/vscode/NEXT_TASKS.md in full, then AGENTS.md. That file is your complete brief; it applies ONLY to papertrail.
Do not open, read, or change any other repository or folder outside this repo.
1. git fetch origin && git checkout -b vscode/next-tasks origin/main   (if origin/vscode/next-tasks already exists: git checkout vscode/next-tasks && git merge origin/main)
2. Do milestones PX1 to PX6 in order, exactly as written. Use sub-agents / parallel workers for independent steps.
3. After each milestone: run its test commands AND the full gate, commit, log in agents/vscode/LOG.md, push vscode/next-tasks.
4. Never push to `main`, never force-push, never edit .github/workflows, never add services that need new accounts or API keys.
5. Do not stop until every milestone is complete and verified. When done, append Handover notes to agents/vscode/NEXT_TASKS.md, push, and open ONE pull request vscode/next-tasks -> main labelled vscode-agent. Do not merge it.
```

---

## 1. Current state of `papertrail` (checked 2026-11-17)

**Product:** Paper Trail (Next.js App Router + MongoDB). Pre-launch and code-complete for agent work. Production hosting (Vercel + Atlas), email, crons and legal are owner items (see section 5).

**Recent merges on `main`:**
- `c355bf1` (#10) exact-author search, author RSS byline, public index cap of 80 (`lib/search.ts`, `app/authors/**`, `app/feed/route.ts`, `app/topics/**`).
- `486294c` (#8) VS1–VS5: account e2e, admin a11y, self-hosted fonts guard, edge tests. Earlier: #1–#7 (fonts self-hosted, production checks, bulk admin, ISR, coverage ≥60%, CHANGELOG, handover plan).

**Check results on `main` @ `c355bf1` (2026-11-17, Grok Bot box, Node 22):**

| Check | Result |
|---|---|
| `npm run lint` | ✔ no warnings or errors |
| `npm run typecheck` | exit 0 |
| `npm test` (sandbox + unit) | sandbox 545/545, unit pass, exit 0 |
| `npm run test:integration` | 24/24 pass |
| `npm run test:coverage` (`lib/**`) | lines **68.66%**, branches 74.38%, functions 84.36% (threshold is only 60%) |
| `npm run build` | exit 0 |
| `npm audit --omit=dev` | **5 moderate** (`glob` / `minimatch` via `@sentry/nextjs` → `@sentry/bundler-plugins`), 0 high |
| Open PRs / issues | none |
| e2e (`npm run test:e2e`) | not run in this check (needs `npm run build && npm start` + `npm run db:memory`) |

**Real gaps found:**
1. Moderate advisories in the production dependency tree (`@sentry/nextjs` pulls vulnerable `glob`/`minimatch`).
2. Security-sensitive `lib/` modules with **0% unit coverage**: `url-fetch.ts` (SSRF guard), `origin.ts`, `safe-error.ts`, `auth-credentials.ts`, `auth-server.ts`, `share-links.ts`, `cite.ts`, `export-note.ts`, `reading-time.ts`.
3. External-API client modules with 0–38% coverage: `pubmed.ts`, `paper-extract.ts`, `reddit.ts`, `x.ts`, `facebook.ts`, `instagram.ts`, `social.ts`, `xai.ts` (18.75%), `article-chat.ts` (17.9%), `queue.ts` (33%), `openrouter-health.ts` (38%).
4. The #10 features (exact-author search, author RSS, index cap) have unit tests but no browser/e2e coverage; the RSS feed has no XML well-formedness/escaping test.
5. `docs/security/route-matrix.md` is not enforced by a test (new API routes could be added without an auth decision).
6. Launch docs need the new commands, and the post-cut-over Railway removal (M0.9) needs a ready-to-run checklist.

**Branches:** `origin/vscode/work` is **stale** (21 pre-squash commits not on `main`, 3 behind). `origin/grokbot/work` and `origin/grokbot/author-search-rss` belong to Grok Bot. Do not use any of them.


---

## 2. Rules (always follow — read before writing any code)

1. **Scope.** Work only inside this repository. Do not open, clone, read or change any other repository.
2. **Branch.** Work on **`vscode/next-tasks`**, created fresh from `origin/main`:
   ```bash
   git fetch origin
   git checkout -b vscode/next-tasks origin/main
   ```
   - Do **not** use `vscode/work`: it holds stale pre-squash history (21 commits already squashed into `main`). Do not push to it or delete it.
   - If `origin/vscode/next-tasks` already exists (an earlier session pushed it), check it out and run `git merge origin/main`; do not rebase commits that are already pushed.
   - Before your **first** push you may `git rebase origin/main`. After that, bring in new `main` commits with `git merge origin/main` only.
3. **Never** push to `main` or to any `grokbot/*` branch. **Never** force-push (`--force`, `--force-with-lease`, `+refs`). **Never** delete remote branches.
4. **Never edit `.github/workflows/*`.** The token has no workflow scope and the owner applies CI by hand. Put any CI change in `docs/ci/proposed-ci.yml` (or another file under `docs/ci/`) only.
5. **No new accounts, API keys, paid services, live payments, cron jobs or deploys.** Use offline mocks, in-memory/embedded databases, and local servers. If a step genuinely needs an owner account, mark it `BLOCKED (owner)` in `agents/vscode/LOG.md`, skip it, and continue with the next step.
6. **Secrets.** Never commit `.env*` values, tokens or keys. Use obviously fake test values (e.g. `test-secret-0123456789abcdef`).
7. **Log everything** in `agents/vscode/LOG.md` (newest first) with Europe/London time (`TZ=Europe/London date '+%Y-%m-%d %H:%M'`): `claimed`, `done (<commit hash>)`, or `BLOCKED (<reason>)`, plus the exact test command and its result line.
8. **Lane hygiene.** Read `agents/grokbot/LOG.md` and any open PRs labelled `grok-bot` first. If Grok Bot is already doing an item, skip it and note that in your log.
9. **Sub-agents.** If your tool supports sub-agents, Task tools or parallel workers, use them for independent steps (for example: one worker on tests, one on docs, one on dependency checks). All commits still land on `vscode/next-tasks` in this repo only.
10. **Small, reviewable commits.** One logical change per commit, message format: `[vscode-agent] <ID>: <summary>` (e.g. `[vscode-agent] PX1.2: add tests for <area>`).
11. **No behaviour changes without a test.** Any app-code change must come with a test that fails before and passes after. Do not weaken, skip or delete existing tests or assertions to make things pass. Do not lower coverage thresholds.
12. **No fake completion.** A step is done only when (a) its test commands exit 0 on your machine, (b) the full gate below exits 0, (c) the change is committed on `vscode/next-tasks`, and (d) `agents/vscode/LOG.md` names the commit and the result line. Paste real output lines, not summaries you expect.
13. **Do not stop** until every milestone below is complete, verified and logged — or explicitly marked `BLOCKED (owner)` with the reason. Then do the final handover step.
14. **Only Grok Bot (or the owner) merges** into `main`. You open or update the PR; you never merge it.

### Full gate (run before every push; must exit 0)

```bash
npm ci && npm run lint && npm run typecheck && npm test && npm run test:integration && npm run build && npm audit --omit=dev --audit-level=high && git status --porcelain
```

---

## 3. Milestones (do them in this order)

Overview:
1. **PX1 — Dependency advisories** — clear the 5 moderate production advisories without breaking changes
2. **PX2 — Tests for security-sensitive lib modules** — unit tests for SSRF guard, origin, safe errors, auth helpers; raise coverage threshold
3. **PX3 — Offline tests for external-API clients and the queue** — mocked-fetch tests for PubMed, paper extract, social, xAI, chat, queue
4. **PX4 — Browser journeys for search, authors and RSS** — e2e for exact-author search, author pages, topic pages, feed, 404, keyboard
5. **PX5 — Enforce the API route matrix** — a test that fails when an API route has no documented auth decision
6. **PX6 — Launch docs and cut-over prep** — launch checklist commands, Railway-removal checklist, CHANGELOG, STATUS

### PX1 — Dependency advisories

**Goal:** `npm audit --omit=dev` reports 0 moderate/high/critical, or every remaining advisory is justified in writing.

**Files:** `package.json`, `package-lock.json`, `SECURITY.md`.

**Steps:**
1. `npm audit --omit=dev --json > /tmp/audit.json` and `npm ls glob minimatch` — record which parent pulls each vulnerable version (expected: `@sentry/nextjs` → `@sentry/bundler-plugins` → `glob@13`/`minimatch@10`).
2. Check for a newer **same-major** `@sentry/nextjs` (`npm view @sentry/nextjs versions --json`) whose tree has patched `glob`/`minimatch`. Upgrade with `npm install @sentry/nextjs@<version>`.
3. If no such release exists, try an npm `overrides` entry pinning the patched `glob`/`minimatch` **only for that subtree**, then run the full gate. Keep it only if the gate and `npm run build` pass.
4. Never run `npm audit fix --force`. Never bump a major version of `next`, `react` or `mongodb` in this milestone.
5. If an advisory cannot be cleared safely, add a dated row to `SECURITY.md` ("Accepted advisories": package, path, why it is build-time only or unreachable, revisit date).

**Acceptance:** gate green; `npm audit --omit=dev --audit-level=moderate` exits 0 **or** each remaining item is documented in `SECURITY.md`.

**Test commands:**
```bash
npm audit --omit=dev --audit-level=moderate; echo "audit exit=$?"
npm run build && npm test && npm run test:integration
```

**Self-check:** paste the audit summary line before and after into `agents/vscode/LOG.md`. Confirm `npm ls @sentry/nextjs` shows the version you intended.

---

### PX2 — Tests for security-sensitive lib modules

**Goal:** every security-relevant helper in `lib/` has direct unit tests; `lib/**` line coverage rises from 68.66% to **≥ 75%** and the threshold in `test:coverage` is raised from 60 to **70**.

**Files:** new `tests/url-fetch.test.ts`, `tests/origin.test.ts`, `tests/safe-error.test.ts`, `tests/auth-credentials.test.ts`, `tests/share-links.test.ts`, `tests/cite.test.ts`, `tests/export-note.test.ts`, `tests/reading-time.test.ts`; `package.json` (`test:coverage` `--lines`).

**Steps:**
1. `lib/url-fetch.ts` (`hostnameResolvesPublic`, `fetchPublicHttp`): stub DNS (`node --experimental-test-module-mocks` `mock.module("dns/promises", …)`, already enabled in `test:coverage`/`test:integration`) and stub `global.fetch`. Cover: private/loopback/link-local IPv4 + IPv6 literals blocked; hostname resolving to any private address blocked; DNS failure → false; public → allowed; a 30x redirect to a private address is refused; the hop limit (4) stops redirect loops; non-http(s) schemes refused.
2. `lib/origin.ts`: same-origin check accepts the site origin, rejects foreign/missing/`null` origins (CSRF guard).
3. `lib/safe-error.ts`: messages shown to users never include stack traces, Mongo error text or secrets.
4. `lib/auth-credentials.ts` / `lib/auth-server.ts`: wrong password, unknown user, unverified user, locked/rate-limited user paths (mock the DB layer or use `npm run db:memory`-style in-memory Mongo via existing integration helpers in `tests/integration/`).
5. `lib/share-links.ts`, `lib/cite.ts`, `lib/export-note.ts`, `lib/reading-time.ts`: pure-function tests including escaping of titles with `&`, `<`, quotes and non-ASCII names.
6. If a test exposes a real bug, fix it in the smallest way and keep the failing-then-passing test.
7. Run `npm run test:coverage`; once lines ≥ 75%, change `--lines 60` to `--lines 70` in the `test:coverage` script.

**Acceptance:** all new tests pass; `npm run test:coverage` exits 0 with lines ≥ 75% and threshold 70; gate green.

**Test commands:**
```bash
npm run test:unit
npm run test:integration
npm run test:coverage
```
New files under `tests/*.test.ts` are picked up by `test:unit` automatically; files that need module mocks may live in `tests/integration/` (which runs with `--experimental-test-module-mocks`).

**Self-check:** paste the c8 `Lines` summary line before and after into the log. Each module listed above must appear in the coverage table above 0%.

---

### PX3 — Offline tests for external-API clients and the queue

**Goal:** every external client fails safely without keys or network and parses real-shaped responses; no test touches the internet.

**Files:** `lib/pubmed.ts`, `lib/paper-extract.ts`, `lib/reddit.ts`, `lib/x.ts`, `lib/facebook.ts`, `lib/instagram.ts`, `lib/social.ts`, `lib/xai.ts`, `lib/article-chat.ts`, `lib/queue.ts`, `lib/openrouter-health.ts`; new tests under `tests/` or `tests/integration/`.

**Steps:**
1. Stub `global.fetch` per test (restore after). Use small fixture JSON/XML that mirrors the real API shape (write fixtures under `tests/fixtures/`, no real data scraping).
2. For each client cover: key/env missing → feature reports disabled and does **not** call fetch; HTTP 429/500 → handled error, no throw to the user; malformed body → handled error; timeout/abort → handled error; success → parsed fields.
3. `lib/queue.ts`: cover claim → process → complete, failure → retry count/back-off, last-error recording (`queue-last-error.ts`), idempotency when the same job is processed twice (use the in-memory Mongo helpers already used by `tests/integration/`).
4. Never put a real key in tests. Use `test-key-not-real`.

**Acceptance:** each listed module ≥ 60% lines in `npm run test:coverage`; gate green; `rg -n "https?://" tests/ | rg -v "example|localhost|127.0.0.1|fixtures"` shows no live endpoints actually fetched.

**Test commands:**
```bash
npm run test:unit && npm run test:integration && npm run test:coverage
```

**Self-check:** temporarily disable networking for the run if your tool allows (or set `HTTPS_PROXY=http://127.0.0.1:9`) and confirm the suites still pass — proving nothing reaches the internet.

---

### PX4 — Browser journeys for search, authors and RSS

**Goal:** the #10 features and core reading paths are covered end-to-end against a local production build.

**Files:** new `e2e/discovery.spec.ts`; maybe `e2e/support.ts`; new `tests/feed.test.ts`.

**How to run the app locally (no accounts):**
```bash
npm run db:memory            # terminal 1: in-memory Mongo (prints the MONGODB_URI to use)
npm run build && npm start   # terminal 2: with MONGODB_URI from terminal 1 and test env values
E2E_REQUIRE=1 npm run test:e2e   # terminal 3: fails (instead of skipping) when no server is listening
```
Use Playwright against `next start`, not `next dev` (CSP blocks `unsafe-eval` in dev). Never set `E2E_EXPOSE_MAIL_LINKS` anywhere except your local shell.

**Steps:**
1. Seed 2–3 posts with distinct authors (reuse the seeding approach in existing specs/helpers).
2. Spec: search by exact author name → only that author's posts; `ActiveFilters` shows the author chip and clearing it restores results.
3. Spec: `/authors` lists authors; `/authors/<slug>` shows posts and links to the author RSS feed; `/topics` and `/topics/<tag>` render and stay within the index cap (≤ 80 items).
4. Spec: `/feed` (and the author feed) returns `200`, `content-type` contains `xml`, and the body parses as XML.
5. Unit test `tests/feed.test.ts`: titles/authors containing `&`, `<`, `"` and emoji are escaped; dates are RFC 822; bylines present.
6. Spec: unknown post `/posts/does-not-exist` → 404 page with `noindex`, no redirect to login.
7. Keyboard-only: Tab from the top of `/` to search, submit with Enter, open the first result with Enter; visible focus ring at each step; axe (wcag2a/aa) has no serious/critical violations on `/authors`, `/topics`, and a search results page.

**Acceptance:** `E2E_REQUIRE=1 npx playwright test e2e/discovery.spec.ts` passes **twice in a row**; full `E2E_REQUIRE=1 npm run test:e2e` passes; gate green.

**Test commands:**
```bash
E2E_REQUIRE=1 npx playwright test e2e/discovery.spec.ts && E2E_REQUIRE=1 npx playwright test e2e/discovery.spec.ts
E2E_REQUIRE=1 npm run test:e2e
npm run test:unit
```

**Self-check:** the run must say `passed`, not `skipped`. If Playwright browsers are missing run `npx playwright install chromium`.

---

### PX5 — Enforce the API route matrix

**Goal:** every `app/api/**/route.ts` handler is listed in `docs/security/route-matrix.md` with its auth rule, and a test enforces it.

**Files:** `docs/security/route-matrix.md`, new `tests/route-matrix.test.ts` (may extend the existing `tests/public-writes.test.ts`).

**Steps:**
1. Walk `app/api/**/route.ts` (fs + glob in the test), collect each route path and exported HTTP methods.
2. Parse the route matrix markdown table; fail the test listing any route/method missing from the matrix, or any matrix row whose file no longer exists.
3. For every route marked public-write or cron in the matrix, assert the handler file references the expected guard (e.g. `cron-auth`, `origin`, `rate-limit`, admin session) — a static check, simple string/AST match is fine.
4. Fill in any missing matrix rows truthfully after reading the handler. If a route is unguarded and should not be, fix it with a test and log it.

**Acceptance:** `npm run test:unit` includes and passes the route-matrix test; deleting a row from the matrix makes it fail (try it locally, then revert).

**Test commands:**
```bash
npm run test:unit
```

**Self-check:** record in the log the number of routes discovered vs. rows in the matrix.

---

### PX6 — Launch docs and cut-over prep

**Goal:** the owner can launch by following docs only; no code needs to change on cut-over day.

**Files:** `docs/launch-checklist.md`, new `docs/runbooks/railway-removal.md`, `CHANGELOG.md` (Unreleased), `STATUS.md`, `README.md`.

**Steps:**
1. `docs/launch-checklist.md` Quality section: add the exact new commands from PX2–PX5 (leave boxes `[ ]`; the owner ticks them with evidence).
2. Write `docs/runbooks/railway-removal.md` for M0.9: the exact files and wording to delete **after** the owner confirms Vercel + Atlas is live (`railway.toml`, `.railwayignore`, Railway mentions in README/SETUP/STATUS — find them with `rg -n -i railway`). **Do not delete them now.**
3. `CHANGELOG.md`: add an `Unreleased` section listing this brief's changes.
4. `STATUS.md`: update the "current as of" line and test numbers (coverage, test counts) with the real figures from your final gate.
5. Check every command written in docs exists in `package.json` (`npm run <name>` must be a real script).

**Acceptance:** docs updated; a script-name check passes:
```bash
node -e "const s=require('./package.json').scripts;const t=require('fs').readFileSync('docs/launch-checklist.md','utf8');const m=[...t.matchAll(/npm run ([\w:-]+)/g)].map(x=>x[1]).filter(n=>!s[n]);if(m.length){console.error('missing',m);process.exit(1)}console.log('ok')"
```

**Self-check:** no file other than docs/CHANGELOG/STATUS/README changed in this milestone (`git diff --stat`).

---

## 4. Final handover (required — do this last)

1. Run the full gate one final time on a clean tree; `git status --porcelain` must print nothing.
2. Append a dated entry under **Handover notes** below using the template, covering every milestone: what was done, the commits, the exact test commands with their result lines (pass/fail counts, coverage numbers, audit summary), anything `BLOCKED (owner)`, open issues and risks.
3. Add a matching newest-first entry to `agents/vscode/LOG.md` and a short entry in `PROGRESS.md`.
4. Push: `git push -u origin vscode/next-tasks` (normal push, never forced).
5. Open ONE pull request (or update the existing one):
   ```bash
   gh pr create --base main --head vscode/next-tasks --label vscode-agent \
     --title "[vscode-agent] Next tasks: <short summary>" \
     --body-file <file with: milestones done, test results, blocked items, risks>
   ```
   If the `vscode-agent` label is missing, create it with `gh label create vscode-agent --color 1D76DB` (labels are allowed; nothing else in repo settings is).
6. Do not merge. Grok Bot reviews and squash-merges.

---

## 5. Owner-only items (do NOT attempt — listed so you skip them)

- MongoDB Atlas cluster, Vercel project and env vars (M0.1, M0.2); then M0.9 Railway removal (agents do it only after the owner says cut-over is done).
- cron-job.org jobs (M0.6) and production smoke (M0.8).
- Branch protection on `main` and copying `docs/ci/proposed-ci.yml` into `.github/workflows` (M1.4).
- Rotate `OPENROUTER_API_KEY`, `CRON_SECRET`, `AUTH_SECRET`, admin password hash (M2.1).
- Resend key, `EMAIL_FROM`/`NEWSLETTER_FROM`, DNS for `papertrailresearch.co.uk` (M10.3).
- Stripe account (M6.4) — checkout must stay 503 until then.
- UptimeRobot / Sentry project / Atlas alerts (M7.5); Google Search Console (M10.4).
- Legal review, ICO registration, GO decision, `v1.0.0` tag (M5.7, M10.5).

---

## Handover notes

<!-- VS Code agents: append dated notes here, newest first, after each milestone and when finished. -->

### Template
```markdown
### YYYY-MM-DD HH:MM Europe/London — after <ID(s)>
- Done: …
- Commits on vscode/next-tasks: …
- Tests: `<command>` → <result line>; …
- Blocked (owner): …
- Open issues / risks: …
- PR: <url> (label vscode-agent, not merged)
```

### 2026-11-17 21:25 Europe/London — after PX1–PX6
- Done: PX1 glob/minimatch cleared, picomatch high accepted; PX2 security tests and 70% line gate; PX3 offline clients and queue; PX4 discovery e2e; PX5 route matrix 46/46; PX6 launch docs and Railway runbook (files not deleted).
- Commits on vscode/next-tasks: `4e70d8f`, `31d5017`, `57f43b4`, `6bb5207`, `bee845a`, `503ded2`, `9a995b1`.
- Tests: `npm run test:coverage` → lines 84.37% (7230/8569), exit 0; `HTTPS_PROXY=http://127.0.0.1:9` unit 150/150 and integration 37/37; discovery spec 7 passed twice; `E2E_REQUIRE=1 npm run test:e2e` → 33 passed; sandbox 545/545; `npm run lint` exit 0; `npm run typecheck` exit 0; `npm audit --omit=dev --audit-level=high` → exit 1, 5 high picomatch.
- Blocked (owner): Atlas, Vercel env, cron-job.org, M0.8 smoke, branch protection, copying proposed CI, secret rotation, Resend, DNS, Stripe, Sentry/uptime, legal, v1.0.0. M0.9 deletion stays blocked.
- Open issues / risks: picomatch 4.0.7 has no patched release (revisit 2026-12-17). `ensure-indexes` must refuse in under 2000ms; one loaded run took 2016ms and passed on a solo re-run. `npm ci` hung with no child process during this save, so the combined gate was run as separate commands on the already-installed tree.
- PR: https://github.com/tatassembly-sys/papertrail/pull/12 (draft, label vscode-agent, not merged)
