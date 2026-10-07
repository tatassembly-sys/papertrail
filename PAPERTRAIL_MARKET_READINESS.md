# PaperTrail market readiness

**Date:** 7 October 2026  
**Milestone:** 9 — market readiness  
**Decision: NO-GO**

NO-GO until email delivery and the sending domain work in production. Milestone 1 is closed. Milestone 2 is not closed. Stripe stays off.

## Final status

| Item | Status |
|------|--------|
| Decision | **NO-GO** |
| Production SHA | `453ce63d13a6f5816a9917f3ab3a52a988c046eb` |
| Production URL | https://papertrail-production-71d6.up.railway.app |
| Deployment | SUCCESS `164aa857-7a3d-4c29-9508-d6f551111e15` |
| Monitoring | Health `ok`, database connected. No separate uptime monitor. |
| Payment | Stripe intentionally off. Checkout is 503 without keys. Must stay off. |
| Email | Log mode. `RESEND_API_KEY`, `NEWSLETTER_FROM`, and `EMAIL_FROM` are absent. Not delivering. |
| Milestone 1 | Closed |
| Milestone 2 | Not closed |

## Production

Latest verified deploy is SUCCESS deployment `164aa857-7a3d-4c29-9508-d6f551111e15` on commit `453ce63d13a6f5816a9917f3ab3a52a988c046eb`. Health `commit` on that deploy is the same SHA.

Live URL: https://papertrail-production-71d6.up.railway.app

Latest verified health: `ok`, database connected, email `log`, billing `off`, OpenRouter flag `true`. The flag means a key is present. It is not a live translation proof.

## Monitoring status

Railway healthcheck path is `/api/health` (`railway.toml`). The latest verified result on deployment `164aa857` is `ok` with the database connected and `commit` equal to `453ce63d13a6f5816a9917f3ab3a52a988c046eb`. There is no separate uptime monitor. This health result does not prove inbox delivery, DNS, or a live OpenRouter translation. GitHub Actions run `37684587745` succeeded for that commit.

## Payment status

Stripe is intentionally off. Checkout is 503 without keys. Billing stays `off` on health. This is optional for the free product and must stay off. Do not add Stripe keys to clear this milestone.

## Email status

Email is log mode. `RESEND_API_KEY`, `NEWSLETTER_FROM`, and `EMAIL_FROM` are absent on the production service. Confirmation, reset, and digest mail are not delivered to an inbox. The custom sending domain does not resolve (see blockers).

## Known blockers

1. **Email delivery.** `RESEND_API_KEY`, `NEWSLETTER_FROM`, and `EMAIL_FROM` are absent. Health stays email `log`. Inbox delivery does not work.
2. **Sending domain.** `papertrailresearch.co.uk` and `www` are NXDOMAIN. The name cannot be used for production mail or as the public site until a zone exists and resolves.
3. **OpenRouter key.** The production key is still the previously exposed key. It must be rotated in the OpenRouter dashboard and then updated on Railway. Health only shows that a key is present.
4. **Milestone 2.** Not closed. Market readiness stays NO-GO until email delivery and the sending domain work in production.

## Known non-blockers

1. **Stripe.** Intentionally off. Checkout 503 without keys is expected. Optional for the free product. Must stay off. Not a reason to turn billing on.
2. **Secrets in git.** None. `CRON_SECRET` and the admin password were rotated on Railway. Unsigned cron calls return 401.
3. **Milestone 1.** Closed. The latest verified production deploy is the SUCCESS deployment named above.
4. **OpenRouter flag `true`.** Key presence only. Not treated as proof that translation works, and not a clearance of the rotation blocker.

## Missing article

On deployment `164aa857`, `GET /posts/does-not-exist-mr1` returned HTTP 404 with “not on file” and `noindex`. A published article returned HTTP 200. An earlier deploy (`01aa7ed`) sent public articles to `/login`; that matcher is gone. Email and the domain stay the market blockers.

## What would change the decision

GO only after production email delivery works and `papertrailresearch.co.uk` (including `www`) resolves as the sending domain. Rotating the exposed OpenRouter key remains required before that key can be treated as safe. Stripe stays off.
