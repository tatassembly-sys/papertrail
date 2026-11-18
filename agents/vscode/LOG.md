# VS Code agents log

Newest first. Claim an item here (`in progress: VS Code agent`) before starting it. Check agents/grokbot/LOG.md first.

## 2026-11-17 21:25 Europe/London — NEXT_TASKS PX1–PX6
Branch `vscode/next-tasks` (from `origin/main` `998a3b2`). Grok Bot's log only published the brief; it is not doing PX1–PX6.

- done: PX1 dependency advisories — `4e70d8f`. `@sentry/nextjs` 10.78.0 and a scoped `glob` 14.0.6 override. `npm ls` shows glob 14.0.6 and minimatch 11.0.9. Picomatch 4.0.7 remains (5 high). `npm audit --omit=dev --audit-level=high` exits 1. Recorded in `SECURITY.md`, revisit 2026-12-17. No `npm audit fix --force`.
- done: PX2 security-lib tests — `31d5017`. `npm run test:coverage` exit 0, lines 84.37% (7230/8569), branches 76.62%, functions 88.76%, threshold `--lines 70`.
- done: PX3 offline clients and queue — `57f43b4`. With `HTTPS_PROXY=http://127.0.0.1:9`: unit 150 pass / 0 fail; integration 37 pass / 0 fail.
- done: PX4 discovery journeys — `6bb5207`. `E2E_REQUIRE=1 npx playwright test e2e/discovery.spec.ts` passed twice (7 passed, 7 passed). Full `E2E_REQUIRE=1 npm run test:e2e` 33 passed.
- done: PX5 route matrix — `bee845a`. `route-matrix routes=46 rows=46`.
- done: PX6 launch docs — `503ded2`. Checklist boxes stay `[ ]`. `railway.toml` and `.railwayignore` were not deleted. STATUS baseline 17 November 2026: sandbox 545/545, unit 150/150, integration 37/37.
- in progress: none.
- not started: none of PX1–PX6. Owner-only items in NEXT_TASKS section 5 were not attempted.
- Tests this save: `npm test` sandbox 545/545; unit 149/150 under parallel load because `ensure-indexes` took 2016ms (limit 2000ms). Re-run alone: 1 pass, exit 0. Integration 37/37 exit 0.
- Not merged. Draft PR https://github.com/tatassembly-sys/papertrail/pull/12 to `main`, label `vscode-agent`.

## 2026-11-02 Europe/London — author page matches one byline
- Done on `vscode/work` (`b2d3b3d`): an author page uses an exact byline match. A search for `?author=` still matches a substring. Integration test: Ann Lee exact total 1, substring total 2.

## 2026-11-02 Europe/London — smoke 404 targets the visible copy
- Done on `vscode/work` (`03e9d08`): missing post, topic, and author checks look for "not on file" inside `#main-content`, not the document title. Passed on `next start`.

## 2026-11-02 Europe/London — password forms post
- Done on `vscode/work` (`8cef009`): secret forms use `method="post"`, so a submit before JavaScript runs cannot place the password or email token in the URL. Smoke covers admin login with JavaScript disabled.

## 2026-11-02 Europe/London — past-the-end catalogue link
- Done on `vscode/work` (`a890b9b`): an empty later page uses the blank-catalogue sentence when `total` is 0. When earlier entries exist, the page says "No more entries." and links to the latest entries. Smoke follows that link when the catalogue has posts.

## 2026-11-02 Europe/London — home empty catalogue copy
- Done on `vscode/work`: `catalogueEmptyCopy` for the three empty home sentences. Smoke `/?page=99` expects "No more entries."

## 2026-11-02 Europe/London — proposed CI actions v7
- Done on `vscode/work`: `docs/ci/proposed-ci.yml` uses `actions/checkout@v7` and `actions/setup-node@v7` so an owner copy drops the Node.js 20 action warning. Live workflow not edited.

## 2026-10-31 22:20 Europe/London — done: VS1–VS5
Grok Bot's 2026-10-27 08:20 reassignment of account e2e is older than the published handover (`c57de72`). These items were done on `vscode/work`.

- done: VS1 account lifecycle — `e2e/account.spec.ts` + `lib/dev-mail-link.ts` (`E2E_EXPOSE_MAIL_LINKS`, ignored whenever `VERCEL_ENV` is set)
- done: VS2 admin axe + 360×640, public axe includes `/about` — no product axe fixes required
- done: VS3 font request guard, smoke 404/empty home, offline proxy build
- done: VS4 newsletter/suggest/`/api/me`/cron edges; integration launch timeout 60s and `--test-concurrency=1`
- done: VS5 launch-checklist Quality commands (still `[ ]`), this log, handover note, PR `vscode-agent`
- Commit: `a5ba474` (specs), `fd97cd6` (this log). PR #8 labelled `vscode-agent`. Not merged.

## 2026-10-27 20:18 Europe/London — HANDOVER plan published by Grok Bot
- See agents/vscode/HANDOVER.md (VS1..VSn). Claim items here before starting.
