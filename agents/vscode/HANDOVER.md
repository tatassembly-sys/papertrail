# VS Code agents — HANDOVER (Paper Trail)

**Repo:** `tatassembly-sys/papertrail` only. Do not touch TrailShare-app, healthmatch, ProcureAI, or DiasporaBridge.
**Written:** 2026-10-27 20:18 Europe/London by Grok Bot (orchestrator).
**Default branch:** `main`. **Your branch:** `vscode/work` only.
**Audience:** Henry's VS Code CLI coding agents (Claude Code, Codex, Copilot, Cursor CLI).

> **START HERE.** Read this whole file, then `AGENTS.md` §0, then claim the first open VS task in `agents/vscode/LOG.md`. Work this repo alone.

---

## Standing instructions (always)

1. **Branch:** work only on `vscode/work`. Create with `git fetch origin && git checkout -B vscode/work origin/main` if missing. Rebase/merge `origin/main` before every push.
2. **Never** push to `main`, `master`, or any `grokbot/*` branch. **Never** force-push. **Never** edit `.github/workflows/*` (put YAML under `docs/ci/` only).
3. **PRs:** open or update one PR from `vscode/work` → `main`, label **`vscode-agent`**. Title like `[vscode-agent] VS1–VSn: <summary>`.
4. **Log:** every claim and finish goes in `agents/vscode/LOG.md` (newest first) and a matching `PROGRESS.md` entry (Europe/London times: `TZ=Europe/London date '+%Y-%m-%d %H:%M'`).
5. **Lane hygiene:** before starting, read `agents/grokbot/LOG.md` and open `grok-bot` PRs; skip anything marked in progress or done there.
6. **Sub-agents / parallel workers:** if your tool supports sub-agents, Task tools, or parallel workers, **use them** to run independent VS tasks (e.g. one worker on e2e specs, one on hardening tests, one on docs) so the plan finishes faster. Keep commits on `vscode/work` only; do not split across repos.
7. **Do not stop** until every milestone VS1…VSn below is complete, verified, and recorded. If blocked on an `[OWNER]` item, mark it in PROGRESS BLOCKERS and continue with the next agent-doable task.
8. **Self-check before ticking:** a milestone/task is done only when (a) its verify command exits 0, (b) the full gate exits 0, (c) there is a commit hash **on `vscode/work`** that implements it, (d) LOG + PROGRESS are updated. Do not tick on hope.
9. **After each milestone (and when the whole plan finishes):** push `vscode/work`, append a dated note under [Handover notes](#handover-notes) below (what was done, tests + results, what's left, risks), then open or update the `vscode-agent` PR.
10. **Only Grok Bot** (or the owner) squash-merges into `main`. You open/update the PR; you do not merge it.

**Gate (before every commit):**
```bash
npm ci && npm run lint && npm run typecheck && npm test && npm run test:integration && npm run build
```

**Out of scope for this plan:** new accounts, API keys, live payments, cron-job.org, Sentry projects, branch protection, copying into `.github/workflows`, production dashboard changes, other repos.

---

## Current state (as of 2026-10-27 20:18 Europe/London)

### What shipped recently (merged `grok-bot` PRs)
- **#6** self-hosted fonts via `next/font/local` so builds need no Google Fonts network (`77ac5dc`).
- **#5** M10.2 production read-only checks; post a11y skips fast when no posts (`c9740df`).
- **#4** M9.3 bulk admin, M9.2 onboarding, M8.4 ISR, M4.3 coverage ≥60%, M10.6 CHANGELOG (`caad5bb`).
- **#3–#1** a11y/Lighthouse/SEO polish, logger + health cron info, integration/coverage, cleared prod advisories.

### Where the product is
Paper Trail is largely **code-complete for pre-launch**. Remaining agent work is **real tests, journey coverage, flake fixes, edge/error states, hardening, and docs** — not new product features that need owner accounts. Production Vercel is up; published posts and schedulers are still owner work (BLOCKERS). Existing e2e: `e2e/smoke.spec.ts`, `e2e/a11y.spec.ts`. Queued but unfinished: account journeys, admin a11y/mobile, font no-network guard.

### Read before coding
- `PROGRESS.md` → Review 2026-10-27 (morning) and BLOCKERS
- `MILESTONES.md` (M0–M10; most `[AGENT]` boxes ticked)
- `CHANGELOG.md`, `docs/launch-checklist.md`
- `AGENTS.md` (commands, DoD, conventions)

---

## Milestone plan for VS Code agents

Work top-down. Each task lists **Verify** — run that command; it must exit 0.

### VS1 — Main user-flow e2e (account lifecycle)

**Goal:** Prove register → verify → login → export → delete against in-memory Mongo + local prod build, twice in a row without flakes.

| ID | Task | Acceptance | Verify |
|---|---|---|---|
| VS1.1 | Add `e2e/account.spec.ts`: register a unique user, capture verify link from log-mode mail (or seeded token helper), login, open `/account`, download export, delete account. Prefer extending helpers in `e2e/`; do not add live email. | Spec exists; uses unique email per run; cleans up. | `npx playwright test e2e/account.spec.ts` |
| VS1.2 | Wire the account journey into `npm run test:e2e` (or document the exact Playwright project invocation in the spec header). | `package.json` / config runs it with the other e2e suite. | `npm run test:e2e` (or documented subset) exits 0 |
| VS1.3 | Flake hunt: run the account spec **twice in a row** on a cold `npm run build` + `db:memory`. Fix waits/selectors; no `waitForTimeout` longer than needed. | Two consecutive green runs logged in PROGRESS. | `npx playwright test e2e/account.spec.ts && npx playwright test e2e/account.spec.ts` |
| VS1.4 | Error states: unverified login, bad reset token, delete confirmation cancel — assert user-visible messages, no stack traces. | Specs cover at least those three negatives. | `npx playwright test e2e/account.spec.ts` |

**Testing section (VS1)**
- **Unit:** none required unless you extract a mail-link parser — then `npm run test:unit`.
- **Integration:** if account APIs change, `npm run test:integration`.
- **E2E:** Playwright account journey (above).
- **Accessibility:** axe not required on every step here (see VS2).
- **Performance:** N/A.
- **Security:** confirm delete/export require auth; unsigned delete → 401/redirect. Spot-check with Playwright assertions.
- **Coverage target:** keep `npm run test:coverage` ≥60% lines on `lib/` if you touch `lib/`.

**Self-check:** gate green; LOG + PROGRESS; append Handover note; push + update PR.

---

### VS2 — Admin a11y, mobile, and public a11y regression

**Goal:** Admin screens and key public pages have no serious/critical axe issues; 360px layout does not overflow.

| ID | Task | Acceptance | Verify |
|---|---|---|---|
| VS2.1 | Add `e2e/admin-a11y.spec.ts`: seeded admin session; axe wcag2a/aa on `/admin`, `/admin/status`, and the bulk-select article list; assert no serious/critical. | Spec green. | `npx playwright test e2e/admin-a11y.spec.ts` |
| VS2.2 | Same pages: viewport 360×640, assert `document.documentElement.scrollWidth <= viewport width` (no horizontal overflow). | Assertions pass. | `npx playwright test e2e/admin-a11y.spec.ts` |
| VS2.3 | Extend public `e2e/a11y.spec.ts` if needed so `/`, `/register`, `/about` stay clean after font self-host. | Existing + new checks green. | `npx playwright test e2e/a11y.spec.ts` |
| VS2.4 | If serious/critical axe failures need component fixes, fix them on `vscode/work` with the smallest change and a unit/smoke assertion. | Gate green; no serious/critical left. | `npm run test:e2e` |

**Testing section (VS2)**
- **Unit:** contrast/helpers if extracted → `npm run test:unit`.
- **Integration:** N/A unless admin APIs change.
- **E2E / a11y:** Playwright + axe (above).
- **Performance:** optional `npm run lighthouse` on `/` and `/about` if you change CSS (scores ≥0.9 where already asserted).
- **Security:** admin routes still redirect when unsigned — assert in smoke or admin-a11y setup.
- **Coverage:** no regression on gate.

---

### VS3 — Font / offline-build guard and smoke hardening

**Goal:** Guard PR #6; harden smoke against empty content and error pages.

| ID | Task | Acceptance | Verify |
|---|---|---|---|
| VS3.1 | Playwright (or extend smoke/a11y): loading `/` and `/about` makes **no** request to `fonts.googleapis.com` / `fonts.gstatic.com`; `document.fonts` reports Fraunces and Inter loaded. | Spec green. | `npx playwright test e2e/a11y.spec.ts` (or dedicated `e2e/fonts.spec.ts`) |
| VS3.2 | Document offline build check in spec header / HANDOVER note. | Comment includes the proxy command. | `rg -n "fonts.googleapis\|HTTPS_PROXY" e2e agents/vscode/HANDOVER.md` |
| VS3.3 | Smoke: missing post/topic/author still 404; home 200 with zero posts. Extend `e2e/smoke.spec.ts` if gaps. | Spec green on db:memory. | `npx playwright test e2e/smoke.spec.ts` |
| VS3.4 | Build with Google Fonts blocked still succeeds (regression of #6). | Exit 0. | `HTTPS_PROXY=http://127.0.0.1:9 npm run build` |

**Testing section (VS3)**
- **Unit:** `tests/fonts-images.test.ts` stays green → `npm run test:unit`.
- **E2E:** font + smoke specs.
- **Performance / a11y:** no regression via `npm run test:e2e`.
- **Security:** N/A.
- **Coverage:** unchanged unless lib touched.

---

### VS4 — Edge cases, error states, and non-flaky suites

**Goal:** Rate limits, bad input, and empty states are covered without flakes.

| ID | Task | Acceptance | Verify |
|---|---|---|---|
| VS4.1 | Unit/integration: newsletter subscribe with invalid email; duplicate subscribe; unauthenticated `/api/me`. Prefer `tests/*.test.ts` or integration. | New/extended tests pass. | `npm run test:unit && npm run test:integration` |
| VS4.2 | Search suggest empty query / no-match topic hints (M9.5 behaviour) have a stable unit or e2e assertion. | Assertion exists and passes. | `npm run test:unit` or targeted Playwright |
| VS4.3 | Cron/admin unsigned calls remain 401 — keep or extend smoke/`smoke:prod` local run. | Exit 0. | `npm run smoke:prod -- http://127.0.0.1:3000` (against local `next start`) **or** existing unit covering auth gate |
| VS4.4 | Eliminate known flakes: no shared mutable clocks without freeze; unique emails; no reliance on production having posts. | Two full `npm run test:e2e` runs green. | `npm run test:e2e && npm run test:e2e` |

**Testing section (VS4)**
- **Unit / integration / e2e:** as above.
- **Security:** authz on cron + account mutations.
- **Coverage:** `npm run test:coverage` still ≥60% if `lib/` changed.

---

### VS5 — Docs, launch checklist evidence, and lane hygiene

**Goal:** Docs match reality; VS lane is easy for the next agent.

| ID | Task | Acceptance | Verify |
|---|---|---|---|
| VS5.1 | Update `docs/launch-checklist.md` Quality section with the exact e2e commands added in VS1–VS3 (still `[ ]` until evidence exists). | Commands match package scripts. | `rg -n "account.spec\|admin-a11y\|fonts" docs/launch-checklist.md` |
| VS5.2 | Ensure `agents/vscode/LOG.md` lists every VS task claim/done with hash. | Log complete for finished work. | `rg -n "VS[0-9]" agents/vscode/LOG.md` |
| VS5.3 | Final gate + tree clean; append final Handover note; push; ensure PR labelled `vscode-agent`. | Gate 0; PR open. | Gate command above; `gh pr view --json labels,url` |

**Testing section (VS5)**
- Full gate + `npm audit --omit=dev --audit-level=high` (exit 0 expected on mainline deps).

---

## Handover notes

<!-- VS Code agents: append dated notes here after each milestone and when finished. -->

### Template
```markdown
### YYYY-MM-DD HH:MM Europe/London — after VSn
- Done: …
- Tests: `<cmd>` → …
- Commit(s) on vscode/work: …
- Left: …
- Risks: …
```

### 2026-10-27 20:18 Europe/London — plan published (Grok Bot)
- Published VS1–VS5 plan for Paper Trail only. No VS Code implementation yet in this commit.
- Baseline tip: `origin/main` at publish time. Recent merges #1–#6 as summarised above.
- Tests run for this docs PR: see PR checks / local gate on the grok-bot branch.
- Left for VS Code agents: entire VS1–VS5.
- Risks: production still has no published posts (owner cron); do not block on that — use `db:memory`.
