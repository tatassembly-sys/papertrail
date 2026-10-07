# Paper Trail — milestones to market-ready

This is the working plan for coding agents (VS Code / Cursor) and the human owner. Do one milestone at a time, top to bottom.
Milestones here are numbered **MR1–MR5** ("market-ready track"). They restart from today. The older "Milestone 1/2/9" names in `STATUS.md` and `PAPERTRAIL_MARKET_READINESS.md` map like this: old Milestone 1 = closed, old Milestone 2 (email/domain) = **MR2** below, old Milestone 9 (market decision) = **MR4** below.

Tags: **[AGENT]** = a coding agent can do it. **[HUMAN]** = needs the owner (secrets, DNS, legal, vendor accounts, payments, production dashboards).

---

## Audit snapshot

| | |
|---|---|
| Audit date | 7 October 2026, ~14:00 BST (Europe/London) |
| Default branch | `main` |
| Tip audited | `bc83db9ab84dbd8c20586d6a004c2e067c6bb252` ("Record Milestone 9 market readiness as NO-GO.") |
| Commits since 5 Oct | 6 (all 6 Oct): M1 record, stale-note cleanup, unsubscribe links + honest email failures (`e9a15bf`), cron/admin secret rotation record, production check of `91f12539`, market-readiness NO-GO |
| CI on tip | **None.** There is no `.github/workflows` directory. No check runs or statuses exist on the tip. |
| Production | https://papertrail-production-71d6.up.railway.app |
| Market decision in repo | **NO-GO** (`PAPERTRAIL_MARKET_READINESS.md`) |

### Verified by this audit
- Local on the tip: `npm test` passed (520 sandbox scenarios + 13 unit tests). `npm run typecheck` passed.
- Live `GET /api/health`: `status ok`, `db connected`, `email "log"`, `billing "off"`, OpenRouter key present (presence only, not a translation proof).
- Live unsigned `GET /api/process-queue` → 401. `POST /api/billing/checkout` → 503 (Stripe off, as intended).
- `papertrailresearch.co.uk` and `www.` → **NXDOMAIN** (no zone at `.uk` registry). Matches the docs.
- **Open FAIL confirmed:** `GET /posts/<missing-slug>` returns **HTTP 200** with the not-found page. Likely cause (spot check): `app/posts/[slug]/loading.tsx` makes the route stream, so the 200 status is sent before `notFound()` runs in `page.tsx`.
- Quick history grep for live-looking keys (`sk_live_`, `sk-or-v1-`, `re_`, `whsec_`) found only commented placeholders.

### Claimed in docs but not confirmed by this audit
- Which commit production runs. `/api/health` does not report a commit, and there are no GitHub deployment records. `STATUS.md` says runtime `4f25f06` on deployment `91f12539`; `PAPERTRAIL_MARKET_READINESS.md` says `54ab66a` on deployment `e7cfcf6a`. The two docs disagree (both are docs-only differences from the code, but the deploy ids should be reconciled).
- `CRON_SECRET` and admin password rotation (Railway-side; not visible from the repo). Cron with a valid bearer was not re-run.
- OpenRouter key is **still the previously exposed key** (docs say so). Needs rotation by the owner.
- Email flows in an inbox — cannot be confirmed; Resend is not configured.

### Problems found
1. No CI at all on GitHub. Nothing stops a broken push reaching `main`.
2. Missing article returns 200 instead of 404 (SEO + correctness).
3. Production commit is not observable from outside (no SHA in health).
4. Email delivery and the custom domain are blocked on the owner (Resend + DNS).
5. Exposed OpenRouter key not yet rotated.

---

## MR1 — Engineering hygiene and observable deploys

**Goal:** every push is tested, production reports which commit it runs, and the known 404 FAIL is fixed.

Tasks
- [x] [AGENT] Fix missing-post status: `/posts/<missing>` must return HTTP 404. Start with `app/posts/[slug]/loading.tsx` (remove it or move the lookup so `notFound()` runs before streaming). Add a unit/sandbox test for the lookup path.
- [x] [AGENT] Add the running commit to `GET /api/health` (e.g. `commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? null`). No secrets in the response.
- [x] [AGENT] Add `.github/workflows/ci.yml`: `npm ci`, `npm run typecheck`, `npm test`, `npm run build` on push/PR to `main`. If the push is rejected because the token lacks the `workflow` scope, leave the file committed on a branch and note it for the owner.
- [x] [AGENT] Reconcile deploy ids in `STATUS.md` and `PAPERTRAIL_MARKET_READINESS.md` so both name the same verified deployment.
- [ ] [HUMAN] Confirm Railway deploys from GitHub `main` automatically (or redeploy after the agent pushes).
- [ ] [HUMAN] Add an external uptime monitor on `/api/health` (UptimeRobot, Better Stack, etc.) with alerts to your email/phone.

Exit criteria (checkable)
- `curl -s -o /dev/null -w '%{http_code}' $APP/posts/does-not-exist` → `404` on production.
- `curl -s $APP/api/health` includes `commit` equal to `git rev-parse origin/main` (or the last code commit if the tip is docs-only).
- GitHub Actions run on the tip of `main` is green.
- Uptime monitor exists and has sent one test alert.

## MR2 — Email delivery, custom domain, key rotation

**Goal:** account and newsletter mail reach real inboxes from the real domain.

Tasks
- [ ] [HUMAN] Register or restore `papertrailresearch.co.uk`; create the DNS zone.
- [ ] [HUMAN] Add Railway records: apex CNAME `6mp7haey.up.railway.app`, `www` CNAME `su8i7gl4.up.railway.app`, plus the `_railway-verify` TXT records from `railway domain status`.
- [ ] [HUMAN] Create a Resend account, add the domain, publish SPF/DKIM (and a DMARC record), wait for "verified".
- [ ] [HUMAN] Set `RESEND_API_KEY`, `NEWSLETTER_FROM`, `EMAIL_FROM` on the Railway service. Never paste them into the repo or chat logs.
- [ ] [HUMAN] Rotate the exposed OpenRouter key in the OpenRouter dashboard and update Railway.
- [ ] [HUMAN] After the domain resolves with TLS, switch `NEXT_PUBLIC_SITE_URL` to `https://www.papertrailresearch.co.uk` (or apex) and redeploy.
- [ ] [AGENT] Once the owner says env is set: verify end to end with an inbox the owner provides — register → verify email, password reset, newsletter subscribe → confirm → unsubscribe link, one digest send to a test list. Record results in `STATUS.md`.
- [x] [AGENT] Make sure every link in mail uses `NEXT_PUBLIC_SITE_URL` (grep for hard-coded `up.railway.app`). Add a test for link building.
- [x] [AGENT] Update `PAPERTRAIL_MARKET_READINESS.md` blockers 1–3.

Exit criteria
- `/api/health` shows `email` not equal to `"log"`.
- Public DNS resolves both apex and `www`; HTTPS works on both.
- A confirmation, a reset, and a digest email arrive in a real inbox; the unsubscribe link works.
- OpenRouter key rotated (owner confirms in `STATUS.md`, no key value written).

## MR3 — Content operations steady state

**Goal:** daily ingest → draft → human publish runs for a week without firefighting, and data is recoverable.

Tasks
- [x] [AGENT] Add a cron health view or log line per cron run (job name, status, duration); make failures visible in `/admin/status`.
- [ ] [AGENT] Add Playwright smoke tests (home, article, pricing, login, 404) and run them in CI against a local build.
- [x] [AGENT] Write `docs/RUNBOOK.md`: redeploy, rollback, rotate secrets, restore Mongo, re-run a cron safely.
- [ ] [HUMAN] Turn on MongoDB backups (Atlas or Railway volume snapshots) and do one restore into a scratch database.
- [ ] [HUMAN] Run the editorial loop daily for 7 days (publish at least one article a day from drafts).
- [ ] [AGENT] Fix any ingest/publish bugs found during those 7 days; keep the publish gate (source URL + caveats) enforced with tests.

Exit criteria
- 7 consecutive days: every scheduled cron returned 200 and no HTTP 5xx in Railway logs.
- At least 7 articles published through the human gate.
- Restore drill documented with date and outcome.
- Playwright smoke green in CI.

## MR4 — Legal and public launch (free product)

**Goal:** launch the free reading product publicly on the custom domain.

Tasks
- [ ] [HUMAN] Review `/privacy` and `/terms` (UK GDPR, PECR for newsletter and cookies). Decide who is the data controller and add contact details.
- [ ] [HUMAN] Register with the ICO if required (data protection fee) and add the registration number to `/privacy`.
- [x] [AGENT] Check cookie/analytics usage; add a consent banner only if non-essential cookies exist.
- [ ] [AGENT] Accessibility pass (headings, contrast, keyboard) and SEO pass (sitemap, canonical URLs on the custom domain, correct 404s).
- [ ] [AGENT] Update `PAPERTRAIL_MARKET_READINESS.md` with evidence for every blocker, and propose GO.
- [ ] [HUMAN] Make the GO decision.

Exit criteria
- `PAPERTRAIL_MARKET_READINESS.md` says **GO** for the free product, signed by the owner.
- No open FAIL rows in `STATUS.md`.

## MR5 — Paper Trail Pro (optional, Stripe)

**Goal:** paid Pro tier works safely. Only start if the owner decides to charge.

Tasks
- [ ] [HUMAN] Create Stripe account, products and prices (monthly/yearly), webhook endpoint `POST /api/billing/webhook`; set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, webhook secret on Railway (test mode first).
- [ ] [AGENT] Test-mode end to end: checkout → webhook → Pro entitlements → portal cancel → entitlements removed. Add tests for duplicate and out-of-order webhooks.
- [ ] [HUMAN] Review pricing page, refund policy, VAT handling.
- [ ] [HUMAN] Switch to live keys; do one real purchase and refund.

Exit criteria
- `/api/health` `billing` is not `"off"`; one live purchase and refund completed; duplicate webhook replay does not double-grant.

---

## Agent instructions (VS Code / Cursor)

1. Work on **one milestone at a time**, in order. Start with the first milestone that has unticked **[AGENT]** boxes.
2. **Pull first:** `git pull --rebase origin main`. Read `STATUS.md` and this file before changing anything.
3. After **each task**: run `npm run typecheck` and `npm test` (and `npm run build` when you touched pages/config). Re-read your diff and re-check your own work. If anything fails, fix it before moving on.
4. Tick the box in `MILESTONES.md` and add a short dated line to `STATUS.md` (what changed, commit, how verified). Commit small, push to `main` with a clear message. If someone pushed meanwhile, rebase; never force-push.
5. **Never commit secrets** (API keys, passwords, tokens, `.env` files). Use Railway variables. Do not print secret values in logs or docs.
6. When a task is **[HUMAN]** or you hit something that needs the owner (DNS, Resend, Stripe, OpenRouter, Railway dashboard, legal), stop that task and add a note under "Waiting on owner" in `STATUS.md`: what is needed, exact steps, and how you will verify it afterwards. Then continue with the other [AGENT] tasks.
7. Do not run tests or scripts against the production database. Do not turn on Stripe.
8. Keep going until every [AGENT] task in the current milestone passes its exit criteria (or is blocked on the owner and noted), then move to the next milestone.

---

## Copy-paste prompts

**MR1**
```
Paper Trail MR1 (engineering hygiene). Pull main first. Read MILESTONES.md and STATUS.md. Do every [AGENT] task in MR1: make /posts/<missing> return HTTP 404 (check app/posts/[slug]/loading.tsx), add the running commit SHA to /api/health, add a GitHub Actions CI workflow (typecheck, test, build), and reconcile deploy ids between STATUS.md and PAPERTRAIL_MARKET_READINESS.md. After each task run npm run typecheck and npm test, re-check your diff, fix failures. Tick boxes in MILESTONES.md, update STATUS.md, commit and push small commits. Never commit secrets. If something needs the owner (Railway redeploy, uptime monitor, workflow token scope), stop that task and write a clear note in STATUS.md. Keep going until MR1 exit criteria pass.
```

**MR2**
```
Paper Trail MR2 (email, domain, key rotation). Pull main first. Read MILESTONES.md and STATUS.md. The DNS, Resend, OpenRouter and Railway variable tasks are [HUMAN]; check whether the owner has marked them done. If not, write precise owner steps in STATUS.md and do the [AGENT] tasks you can: make every email link use NEXT_PUBLIC_SITE_URL, add tests for link building, prepare the verification checklist. When env is set, verify register/verify, reset, subscribe/confirm/unsubscribe and a digest against a test inbox the owner gives you. Run typecheck and tests after each change, fix failures, tick boxes, update STATUS.md and PAPERTRAIL_MARKET_READINESS.md. Never commit secrets. Keep going until MR2 exit criteria pass or only owner tasks remain.
```

**MR3**
```
Paper Trail MR3 (content ops). Pull main first. Read MILESTONES.md and STATUS.md. Add per-cron run logging and failures in /admin/status, add Playwright smoke tests to CI, write docs/RUNBOOK.md, and fix ingest/publish bugs while keeping the publish gate tested. Backups/restore drill and the 7-day editorial run are [HUMAN]; note what you need. Run typecheck and tests after every task, fix failures, tick boxes, update STATUS.md. Never commit secrets or touch the production database from tests. Keep going until MR3 exit criteria pass.
```

**MR4**
```
Paper Trail MR4 (legal and public launch). Pull main first. Read MILESTONES.md and STATUS.md. Do the accessibility and SEO passes, check cookies/analytics and add consent only if needed, then update PAPERTRAIL_MARKET_READINESS.md with evidence for every blocker and propose GO. Legal review, ICO registration and the GO decision are [HUMAN]; leave a clear note. Run typecheck and tests after every change, fix failures, tick boxes, update STATUS.md. Never commit secrets.
```

**MR5**
```
Paper Trail MR5 (optional Stripe Pro). Only start if the owner has confirmed they want to charge and has set Stripe TEST keys on Railway. Pull main first. Read MILESTONES.md and STATUS.md. Test checkout -> webhook -> Pro entitlements -> portal cancel in Stripe test mode, add tests for duplicate and out-of-order webhooks, fix failures. Live keys, pricing, VAT and refunds are [HUMAN]. Tick boxes, update STATUS.md. Never commit secrets.
```
