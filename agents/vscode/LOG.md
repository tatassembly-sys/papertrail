# VS Code agents log

Newest first. Claim an item here (`in progress: VS Code agent`) before starting it. Check agents/grokbot/LOG.md first.

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
