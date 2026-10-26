## ▶ START HERE (2026-10-26)

**Agents have stalled since the 2026-10-25 evening review. Do not wait for further instructions — start now.**

- **Next task:** **M2 deps** — clear the remaining `npm audit --omit=dev` advisories (`postcss`, `tar`, via the Next toolchain). Try a Next.js minor/patch bump first.
- **Done when:** `npm audit --omit=dev --audit-level=high` exits 0 **and** the gate is green.
- **Gate (run before every commit):** `npm ci && npm run lint && npm run typecheck && npm test && npm run build`
- **Then continue down the "Next up for agents" list below (M4.3 → M4.2 → M4.4 → M7.2 → M7.3 → M7.1) without stopping.** After each item: gate green → PROGRESS entry → commit → push (per AGENTS.md §0 lanes: VS Code agents push to `vscode/work` and open/update a `vscode-agent` PR). Only stop if an item is BLOCKED; log the error and move to the next one.
- If an item is already marked in progress/done in `agents/grokbot/LOG.md`, skip it and take the next unclaimed one.

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

- [open] 2026-10-20 M0 — Atlas was reachable on the read-only smoke below (`db connected`). Vercel cron-job.org schedules and Railway deletion are still owner work.
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

### 2026-10-26 15:05 — M8.4 (partial), M10.1, DB text-index fix
- Agent: Grok Bot (branch grokbot/work)
- Commit(s): 20c4951 (M8.4 partial), f1cd6ca (M10.1), 5da1980 (fix db)
- Change: `/api/posts/published` probe sends `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` (503 is no-store) and uses an `_id`-only existence query; trending and editor-picks lists project `LIST_PROJECTION` (no article body). ISR/revalidate for public pages NOT done: they are force-dynamic and read the session cookie, and the build has no DB; left open. `docs/launch-checklist.md` lists every launch item with its proof command. **Bug fix:** Stable API strict mode (the default) made `createIndex(text)` fail with APIStrictError 323 and the fallback then dropped the existing text index; `$text` queries are also rejected in strict mode. Now strict is off by default (`MONGODB_STABLE_API_STRICT=true` to opt in) and only index-conflict errors (85/86) trigger a drop.
- Checks run: tests/post-probe-cache.test.ts; integration 10/10 (projections, publishedSlugExists, text index present + $text works). Gate below.
- Follow-ups: owner can confirm on Atlas that `articles_text_search_v2` exists after this deploys (launch checklist). M8.4 ISR still open.

### 2026-10-26 14:45 — M7.1 — Sentry gated on SENTRY_DSN
- Agent: Grok Bot (branch grokbot/work)
- Commit(s): f733836
- Change: `lib/sentry.ts` + `instrumentation.ts` (register + onRequestError, nodejs runtime). With `SENTRY_DSN` unset nothing is imported or initialised. When set: `sendDefaultPii: false`, `beforeSend`/`beforeBreadcrumb` scrub user, cookies, headers, body, emails and tokens; `log.error` forwards to Sentry. No client-side SDK (CSP unchanged). Env documented in AGENTS.md §4 and .env.example.
- Checks run: `tests/sentry.test.ts` (no-op without DSN: loader never called; PII off; scrub). Gate: lint, typecheck, unit 101/101, sandbox 543/543, build.
- Follow-ups: owner creates a Sentry project and sets SENTRY_DSN in Vercel (M7.5).

### 2026-10-26 14:20 — M4.2 / M4.3 / M4.4 / M7.2 / M7.3 — tests, coverage, logger, health
- Agent: Grok Bot (branch grokbot/work)
- Commit(s): e8e2724 (M4.2), 072dc5a (M4.3), 2f4d57c (M4.4), 12eb9e8 (M7.2), 7fa5da2 (M7.3)
- Change: `npm run test:integration` (tests/integration, mongodb-memory-server, random port): users register/dup/password/verify single-use/reset single-use + token_version bump/delete; submissions create/priority sort/dedupe/IP rate limit; rate-limit window, undo, 10 concurrent hits atomic; cron health summary. `npm run test:coverage` (c8 --all over lib/, unit + integration). Proposed CI runs both. `lib/log.ts` JSON logger (level, msg, route, requestId; redacts emails, bearer, JWT, hex tokens, Stripe keys, secret-looking keys; no stacks); all 33 `console.*` in app/api replaced. `/api/health` adds `cron_last_run` {at, ok, stale} per job and `queue_depth` (pending fetch_queue); failure there never fails health. `isCronStale` = last run older than 2x cadence (cadences from docs/runbooks/cron-job-org.md); /admin/status shows STALE in red.
- Coverage baseline (lib/, c8 --all, unit+integration): **Statements/Lines 37.91%**, Branches 75.49%, Functions 61.1%. Below 60% (with unit-only numbers): articles 11, auth 44, cron-lock 56, entitlements 51, extract-draft 57, highlight 18, indexes 13, json-body 24, mongodb 23, newsletter 14, openrouter 21, rate-limit 23 (now covered by integration), request-ip 41, search 52, stripe 56, user-auth 30, user-export 59, users 23 (now covered by integration), xai 19, plus files never imported by tests (0%). Target 60% not reached yet.
- Checks run: `rg "console\.(log|error|warn)" app/api` → empty. unit 98/98, integration 8/8, sandbox 543/543, lint, typecheck, build.
- Finding: in-memory Mongo logs `text indexes cannot be created with apiStrict: true` from lib/indexes.ts (articles_text_search_v2). With MONGODB_STABLE_API strict (the default) a fresh Atlas DB will not get the text index. Follow-up: create that index with a non-strict client or document MONGODB_STABLE_API=false.
- Follow-ups: raise lib coverage to 60%.

### 2026-10-26 13:45 — M2 deps — clear postcss + tar advisories
- Agent: Grok Bot (branch grokbot/work)
- Change: npm `overrides`: `postcss` → `$postcss` (8.5.x, same major; Next pinned 8.4.31) and `@mapbox/node-pre-gyp` → ^2.0.3 (tar 7.5.22; reached via unpdf → canvas). No Next major bump.
- Checks run: `npm audit --omit=dev --audit-level=high` → found 0 vulnerabilities, exit 0. Gate: lint clean, typecheck pass, `npm test` sandbox all + unit 91/91, build pass.
- Follow-ups: none.

## Review 2026-10-26 (08:00 Europe/London)

Reviewer: Grok Bot (owner audit). Range reviewed: 9f011cb..9f011cb (`git log --since="2026-10-25 22:33"`): **0 agent commits**. Agents have stalled since the 2026-10-25 review, so the next-up list below still stands.

- Ticks: no MILESTONES.md changes since the last review. Those ticks were already spot-checked on 2026-10-25. No false ticks.
- Gate on a clean `npm ci` at 9f011cb: `npm run lint` PASS (no warnings), `npm run typecheck` PASS, `npm test` PASS (sandbox all passed + unit 91/91), `npm run build` PASS. Tree clean after the gate.
- CI: the last 5 runs are green (latest 40240701703 on 9f011cb).
- `npm audit --omit=dev`: still 4 advisories (postcss high, tar critical, both through the Next toolchain). This is task 1 below.
- Fixes made: none needed.
- Blockers: no new ones. The existing owner items stand (Railway deletion / M0.9, OpenRouter + Resend, branch protection, CI workflow copy).

### Next up for agents (unchanged from 2026-10-25; start at 1)
1. **M2 deps**: clear `postcss` and `tar`. Done when: `npm audit --omit=dev --audit-level=high` exits 0 and the gate is green.
2. **M4.3**: `npm run test:coverage` (c8) with the baseline % of `lib/` logged here. Verify: `npm run test:coverage`.
3. **M4.2**: `npm run test:integration` with mongodb-memory-server for users, submissions, and rate-limit. If the binary download fails, mark it BLOCKED with the error.
4. **M4.4**: add test:integration and coverage to `docs/ci/proposed-ci.yml` (not `.github/workflows`).
5. **M7.2**: `lib/log.ts` structured logger. Verify: `rg "console\.(log|error|warn)" app/api` is empty, plus a redaction unit test.
6. **M7.3**: `/api/health` reports `cron_last_run` and `queue_depth`. Unit-test the staleness rule (>2× cadence).
7. **M7.1**: Sentry gated on `SENTRY_DSN`, with a test that it is a no-op when unset.
Self-check after each: `npm ci && npm run lint && npm run typecheck && npm test && npm run build`.

## Review 2026-10-25

Reviewer: Grok Bot (owner audit), 22:xx GMT. Range reviewed: 6070b20..b92717f (31 commits). Gate on clean `npm ci`: lint, typecheck, `npm test` (543 sandbox + 91 unit), build all PASS. GitHub CI on b92717f: green.

- Agent work: M2.3–M2.8, M3.1–M3.5, M4.1, M5.1–M5.6, M6.1–M6.3, M8.2. I spot-checked the diffs for M3.2 (cron lock + idempotency test), M3.5 (single-use, expiring tokens), M6.1 (webhook dedupe + tests) and M4.1 (Playwright suite, kept out of the gate as specified). All real, with tests. No false ticks found. Commits are tagged and focused.
- Earlier findings: (1) the 3 test files do run: `npm run test:unit` reports 91 tests, and site-url (4), smoke-prod (2) and ensure-indexes (1) pass on their own; AGENTS.md says 91. FIXED. (2) Live smoke has been run and logged. I re-ran it today, `npm run smoke:prod -- https://papertrail-six-rho.vercel.app`: OK home 200, health 200, missing-post 404, unsigned-queue 401, sitemap 200, robots 200. `/api/health`: status ok, db connected, commit b92717f, env production, openrouter false (no key yet, expected).
- Reviewer commits: `0124051` M7.4 incident runbook; `5911170` npm audit fix (non-breaking), prod advisories 8 → 4 (still open: `postcss`, `tar`, including 1 critical through the Next toolchain; needs a major bump).

### Next up for agents (in order; each must end with the gate green and a PROGRESS entry)
1. **M2 deps** — clear the remaining `npm audit --omit=dev` advisories (postcss, tar). Try a Next.js minor/patch bump first. Done when: `npm audit --omit=dev --audit-level=high` exits 0, gate green, smoke:prod OK after deploy.
2. **M4.3** — add `c8` coverage for `npm run test:unit` (`npm run test:coverage`) and record the baseline % of `lib/` here. Done when: the script exists and the baseline is logged (target ≥60%; list the files below it).
3. **M4.2** — integration tests with `mongodb-memory-server` for `lib/users.ts`, `lib/submissions.ts`, rate-limit (`npm run test:integration`). Note: the owner box blocks 27017, but the memory server picks a random port. If it can't download a binary, mark BLOCKED with the error.
4. **M4.4** — add test:integration/coverage to `docs/ci/proposed-ci.yml` (don't edit `.github/workflows`).
5. **M7.2** — `lib/log.ts` structured JSON logger (level, route, requestId, no PII). Replace `console.*` in `app/api/**`. Done when: `rg "console\.(log|error|warn)" app/api` returns nothing, and a unit test proves emails/tokens are redacted.
6. **M7.3** — `/api/health` adds `cron_last_run` per job + `queue_depth`, and `/admin/status` shows stale cron in red. Unit-test the staleness rule (>2× cadence).
7. **M7.1** — Sentry gated on `SENTRY_DSN` (no-op if unset, PII scrubbed). Test that it's a no-op without the DSN.
Self-check after each: `npm ci && npm run lint && npm run typecheck && npm test && npm run build`. After a push, wait for CI to go green, then run `npm run smoke:prod -- https://papertrail-six-rho.vercel.app`.

### 2026-10-19 — M4.1 — Playwright smoke
- Agent: Grok
- Commit(s): `e2cd41d`
- Change: `npm run test:e2e` runs `e2e/smoke.spec.ts` against an already running app. Home, a post, register validation, and a rejected admin login are covered. If nothing is listening, the suite skips and exits 0. It is not part of `npm test`.
- Checks run: file review. The suite was not executed here because Playwright browsers were not installed in this checkout, and `npm run build` on this tip had not finished.
- Evidence: `playwright.config.ts` does not start a server and does not send a cron bearer.
- Follow-ups: M4.2, M4.3, M4.4.

### 2026-10-20 — production smoke (read-only)
- Agent: Grok
- Commit(s): none (observation of the deployment already on origin, `9731a04`)
- Change: none.
- Checks run: `npm run smoke:prod -- https://papertrail-six-rho.vercel.app` → exit 0. `OK home 200`, `OK health 200`, `OK missing-post 404`, `OK unsigned-queue 401`, `OK sitemap 200`, `OK robots 200`.
- Evidence: `GET /api/health` body was `status ok`, `db connected`, `email log`, `billing off`, `env production`, `commit 9731a0420ad9b923cbb32bd9fd9faf0e8c795e30`. No bearer was sent. M0.8 stays owner work because it also includes deleting Railway. M0.9 stays blocked until that deletion is logged. Lighthouse and e2e were not run against production.
- Follow-ups: owner deletes Railway before M0.9. Repeat smoke after the next push, because production is still `9731a04`.

### 2026-10-19 — M8.2 — post structured data
- Agent: Grok
- Commit(s): `17c69dd`, `f357d0a`
- Change: A published note's JSON-LD is a ScholarlyArticle plus a BreadcrumbList (home, topic when the note has one, then the note).
- Checks run: `tests/json-ld.test.ts`, `tests/copyright.test.ts`, `tests/sitemap.test.ts`. Gate on this tip: `npm ci` (Playwright browser download skipped) exit 0, `npm test` 543/543 sandbox and 91/91 unit, `npm run build` exit 0 (36/36 pages). The Next build typecheck passed. One edge-runtime page skips static generation. That warning is not a failure.
- Evidence: A non-URL licence is omitted. `<` in a title is escaped for the script tag.
- Follow-ups: M8.1, M8.3, M8.4, M8.5.

### 2026-10-19 — M3 summary
- Agent: Grok
- Commit(s): `c6ea15d`, `50777cb`, `e145538`, `3441671`, `8d67770`, `a12942a`
- Change: Missing post, topic, author, and list pages call `notFound()` and there is still no `app/posts/[slug]/loading.tsx`. Concurrent cron-fetch and process-queue take a lock and file articles under a unique source id. Schedule input without a zone is Europe/London, including the March gap and the October overlap. The sitemap and canonical URL are published posts only. Verify and unsubscribe tokens expire and are single-use. Confirm still stores consent time. No `TODO` or `FIXME` in application source.
- Checks run: `npm run typecheck` exit 0. `npm test` → 543/543 sandbox (`cron-idempotency` 7) and 91/91 unit after the structured-data tests. `npm run build` exit 0 (36/36 pages).
- Evidence: Copyright credit on the post page stayed. Stripe event indexes stayed. Confirm uses `subscriptionConsentUpdate(source, now)` so the consent clock and the expiry clock are the same instant (`a12942a`).
- Follow-ups: none for the agent. M3 stays open in STATUS until this tip is pushed.

### 2026-10-19 — M3.1 — missing records are 404
- Agent: Grok
- Commit(s): `c6ea15d`
- Change: Topic, author, list, and post routes use `notFound()` before a streaming boundary.
- Checks run: `tests/public-404.test.ts`.
- Evidence: No `loading.tsx` under `app/posts/[slug]/`.
- Follow-ups: none.

### 2026-10-19 — M3.2 — cron idempotency
- Agent: Grok
- Commit(s): `50777cb`
- Change: A lock document plus a partial unique index on `source_id`. A duplicate source id returns the existing draft.
- Checks run: `tests/cron-idempotency.test.ts` and sandbox `cron-idempotency` 7/7.
- Evidence: Licence and source fingerprint from M5.6 are still passed into `insertDraftArticle` together with the source id.
- Follow-ups: none.

### 2026-10-19 — M3.3 — Europe/London schedules
- Agent: Grok
- Commit(s): `e145538`
- Change: Wall-clock schedule strings are Europe/London. A zoned instant is kept. The spring gap is rejected. The autumn overlap keeps the earlier instant.
- Checks run: `tests/london-time.test.ts` with a fixed clock.
- Evidence: Unit tests cover GMT, BST, the March gap, and the October overlap.
- Follow-ups: none.

### 2026-10-19 — M3.4 — published sitemap
- Agent: Grok
- Commit(s): `3441671`
- Change: `sitemap.ts` and canonical metadata include published posts only.
- Checks run: `tests/sitemap.test.ts`.
- Evidence: Unpublished and missing posts are dropped.
- Follow-ups: none.

### 2026-10-19 — M3.5 — expiring email links
- Agent: Grok
- Commit(s): `8d67770`, `a12942a`
- Change: Verify and unsubscribe tokens have an expiry and are cleared on use. Account reset links follow the same pattern. Consent fields are written on confirm.
- Checks run: `tests/email-links.test.ts` and `tests/newsletter-consent.test.ts`.
- Evidence: GET confirm still does not subscribe the reader.
- Follow-ups: none.

### 2026-10-19 — M3.6 — TODO and FIXME grep
- Agent: Grok
- Commit(s): none (search only)
- Change: No code change. Search of `*.ts`, `*.tsx`, `*.js`, `*.mjs`, `*.cjs`, `*.jsx`, and `*.css` found no `TODO` or `FIXME`.
- Checks run: repository search on this tip.
- Evidence: Remaining wording is in `MILESTONES.md`, `PROGRESS.md`, `STATUS.md`, and `AGENTS.md`, and those lines are owner instructions rather than unfinished code.
- Follow-ups: none.

### 2026-10-19 — M5 summary
- Agent: Grok
- Commit(s): `65f9a59`, `bf94ccc`, `5e6925d`, `6c58ab4`, `cddc03a`, `526867d`
- Change: Draft data inventory and privacy notice. Cookie page lists strictly necessary cookies and adds no banner. Signed-in readers can export their own rows (`me_export` 10/hour) without password hashes. Newsletter confirm stores `consent_at` and `consent_source`. Digest mail sends `List-Unsubscribe`. Closed-licence papers are credited and stored as a short excerpt, not the full text. CC BY, CC BY-SA, CC0, and public domain count as open. CC BY-NC and the arXiv non-exclusive licence do not.
- Checks run: After M3 was rebased on top, `npm run typecheck` exited 0. The later gate on this tip is `npm ci`, `npm test` 543/543 and 91/91, and `npm run build` exit 0.
- Evidence: Privacy page still says `[controller name and address — owner]`. This is not a legal sign-off. Market decision stays NO-GO.
- Follow-ups: M5.7 owner legal review, ICO decision, and the business name and address.

### 2026-10-19 — M5.1 — data inventory
- Agent: Grok
- Commit(s): `65f9a59`
- Change: `docs/legal/data-inventory.md` lists collections, personal fields, purpose, draft lawful basis, retention, and processors.
- Checks run: file review.
- Evidence: Lawful bases are draft labels for the owner.
- Follow-ups: M5.7.

### 2026-10-19 — M5.2 — privacy notice
- Agent: Grok
- Commit(s): `bf94ccc`
- Change: `/privacy` follows the inventory. Controller identity is a placeholder. Transfers name Vercel, Atlas, OpenRouter, Resend, and Stripe without claiming SCCs are signed.
- Checks run: page source.
- Evidence: placeholder `[controller name and address — owner]`.
- Follow-ups: M5.7.

### 2026-10-19 — M5.3 — cookie page
- Agent: Grok
- Commit(s): `5e6925d`
- Change: `/cookies` lists the session cookies the app sets. No consent banner.
- Checks run: `tests/cookies.test.ts`.
- Evidence: Footer links the page.
- Follow-ups: none.

### 2026-10-19 — M5.4 — account export
- Agent: Grok
- Commit(s): `6c58ab4`
- Change: `GET /api/me/export` requires a user session and `me_export` 10/hour. `DELETE /api/me` was already present. `/account` links to the export.
- Checks run: `tests/account-export.test.ts`.
- Evidence: Export omits `password_hash` and other people's rows.
- Follow-ups: none.

### 2026-10-19 — M5.5 — newsletter consent
- Agent: Grok
- Commit(s): `cddc03a`
- Change: Confirm writes `consent_at` and `consent_source`. GET does not confirm. Log-mode mail records that `List-Unsubscribe` is set and does not print the URL.
- Checks run: `tests/newsletter-consent.test.ts`.
- Evidence: sandbox confirm-get-safe still passes.
- Follow-ups: none.

### 2026-10-19 — M5.6 — source credit
- Agent: Grok
- Commit(s): `526867d`
- Change: Article pages show the source title, authors, licence, and link. Raw PDF text of a non-open paper is clipped to an excerpt. A model paste of that text is replaced with the excerpt before publish.
- Checks run: `tests/copyright.test.ts` and sandbox 536/536.
- Evidence: Open licences stay publishable up to the existing clip.
- Follow-ups: none.

### 2026-10-19 — M6 summary
- Agent: Grok
- Commit(s): `73bbaa7`, `2d3c8f5`, `af40405`
- Change: Stripe webhooks claim `event.id` in `stripe_events` before applying a plan change. Duplicate ids return 200 and do not sync again. Bad signatures are not stored. Handler failures release the claim. Pricing says prices include VAT and links to terms. Checkout and the portal return 503 before any database call when Stripe keys are unset.
- Checks run: `npm run typecheck` exit 0. `tests/stripe.test.ts` and `tests/pricing.test.ts` passed. Full `npm test` after M5 also passed (69/69 unit). Idempotency used a fake collection that throws Mongo duplicate-key 11000, not a live database.
- Evidence: No `stripe` npm package. No live keys. `docs/runbooks/stripe-go-live.md` is the owner checklist.
- Follow-ups: M6.4 owner. If a worker dies after the plan update and before the row is marked done, retries stay 500 until that row is deleted. The runbook says when that is safe.

### 2026-10-19 — M6.1 — webhook idempotency
- Agent: Grok
- Commit(s): `73bbaa7`
- Change: Signature check stays first. `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_failed` are applied once per event id.
- Checks run: `tests/stripe.test.ts`.
- Evidence: A bad signature leaves the event store empty. A failed handler can be retried once.
- Follow-ups: none.

### 2026-10-19 — M6.2 — Stripe go-live runbook
- Agent: Grok
- Commit(s): `2d3c8f5`
- Change: `docs/runbooks/stripe-go-live.md` covers inclusive GBP prices, tax, webhook `https://<vercel>/api/billing/webhook`, portal, test cards, and rollback by unsetting keys.
- Checks run: file review.
- Evidence: Placeholders only. No live key.
- Follow-ups: M6.4.

### 2026-10-19 — M6.3 — VAT-inclusive pricing
- Agent: Grok
- Commit(s): `af40405`
- Change: `/pricing` says “Prices include VAT” and still links to `/terms`. Unconfigured checkout and portal return HTTP 503 with the existing explanation.
- Checks run: `tests/pricing.test.ts`.
- Evidence: The 10/hour write limit still runs once billing is configured.
- Follow-ups: none.

### 2026-10-19 — M2 summary
- Agent: Grok
- Commit(s): `fcfe324`, `2c50f14`, `e7bdf6e`, `d12d2e2`, `305885f`, `478817e`, `390433f`, `e25e3de`
- Change: Public writes are rate limited and listed in `docs/security/route-matrix.md`. CSP test asserts no `unsafe-eval` plus `frame-ancestors`, `base-uri`, and `form-action`. `unsafe-inline` stays because Next’s bootstrap script needs it. Session cookies and cron compare are tested. Submitted URLs reject private hosts, and PDF fetch re-checks redirects. Passwords are at least 10 characters and not on the bundled common list. Chat and process-paper have daily per-IP and per-account caps. Prompts refuse instruction override. `SECURITY.md` is the disclosure policy.
- Checks run: `npm run typecheck` exit 0. `npm test` → 532/532 sandbox and 53/53 unit. `npx next lint` → no warnings or errors. First `npm run build` failed because webpack pulled `node:dns/promises` into the client via `lib/http-url.ts`. `305885f` moved that lookup to `lib/url-fetch.ts`. Rebuild after that commit: `npm run build` exit 0 (compiled, 35/35 pages; four pages retried once under load).
- Evidence: `rg unsafe-eval next.config.ts` returned nothing. User-login lockout was already covered by sandbox test "login rate limit after 5 fails"; the route test checks the real handler calls the same helpers.
- Follow-ups: M2.1 owner rotates OpenRouter, cron, auth, and admin secrets in Vercel.

### 2026-10-19 — M2.2 — route matrix and public POST limits
- Agent: Grok
- Commit(s): `fcfe324`
- Change: `tooManyPublicWrites` on verify, unsubscribe, logout, checkout, portal, highlights, collections, and `/api/me`. Matrix documents every route file.
- Checks run: `tests/public-writes.test.ts`.
- Evidence: Stripe webhook is signature-only so retries are not dropped.
- Follow-ups: none.

### 2026-10-19 — M2.3 — CSP assertions
- Agent: Grok
- Commit(s): `2c50f14`
- Change: `tests/headers.test.ts` imports `next.config` and checks the CSP. Directives were already set. `unsafe-inline` remains, with the comment in `next.config.ts`.
- Checks run: that unit test.
- Evidence: no `unsafe-eval` in `next.config.ts`.
- Follow-ups: none.

### 2026-10-19 — M2.4 — cookies and cron compare
- Agent: Grok
- Commit(s): `e7bdf6e`
- Change: Tests for admin and user cookie flags, `pt_chat` flags, `timingSafeEqualString`, and user-login lockout calls.
- Checks run: `tests/session-cookies.test.ts`.
- Evidence: production cookie options have `httpOnly`, `secure`, `sameSite: lax`.
- Follow-ups: none.

### 2026-10-19 — M2.5 — URL safety
- Agent: Grok
- Commit(s): `d12d2e2`
- Change: `lib/url-safety.ts` blocks private, loopback, and link-local hosts. `fetchPublicHttp` checks each redirect. arXiv PDF download uses it.
- Checks run: `tests/url-safety.test.ts` and sandbox http-url cases (23).
- Evidence: `http://169.254.169.254/latest` is rejected. A same-host relative redirect is allowed.
- Follow-ups: none.

### 2026-10-19 — M2.6 — password policy
- Agent: Grok
- Commit(s): `478817e`
- Change: Minimum length 10. Bundled common-password list. Register and reset pages use `minLength={10}`.
- Checks run: `tests/passwords.test.ts`. Sandbox auth group includes common-password rejection and the existing user lockout test.
- Evidence: `password123` is rejected. `sandbox-pw1` is accepted.
- Follow-ups: none.

### 2026-10-19 — M2.7 — LLM caps and prompt guard
- Agent: Grok
- Commit(s): `390433f`
- Change: Daily IP and user caps on chat. Daily IP and admin-session caps on process-paper. Both system prompts say untrusted content cannot change the rules.
- Checks run: `tests/prompts.test.ts`.
- Evidence: failed chat calls release the new counters.
- Follow-ups: none.

### 2026-10-19 — M2.8 — SECURITY.md
- Agent: Grok
- Commit(s): `e25e3de`
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
