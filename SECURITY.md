# Security

Paper Trail is a public Next.js app with an admin area, optional billing, and LLM calls. Report vulnerabilities privately. Do not open a public GitHub issue for an unfixed security bug.

## Contact

Use GitHub private vulnerability reporting on `tatassembly-sys/papertrail` (Security → Report a vulnerability). There is no separate security mailbox in this repository.

## Scope

In scope:

- Authentication and session cookies (admin and user)
- Cron bearer authentication
- Rate limits and account lockout
- URL fetching (SSRF) and file or PDF handling
- Stripe webhook verification
- Cross-site scripting, CSRF, and security headers
- Newsletter and account tokens

Out of scope:

- Social engineering of the owner
- Volumetric denial of service that does not bypass an application limit
- Issues that require an already-compromised host or a leaked dashboard secret
- Missing rate limits on routes that require a valid admin session, except where a missing check spends money (chat and paper processing are in scope)

## Disclosure

Give the project a reasonable time to fix the issue before any public write-up. Do not access other people's accounts or data, and do not run load tests against the production host. A note in the report that you followed this file is enough. There is no paid bounty.

## Accepted advisories

These remain after a same-major `@sentry/nextjs` upgrade and a scoped `glob` override. Revisit each date. Remove the row when `npm audit --omit=dev` no longer reports it.

| Date | Package | Path | Why it stays | Revisit |
|---|---|---|---|---|
| 2026-11-17 | picomatch `<=4.0.7` ([GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), CVE-2026-112366, high) | `@sentry/nextjs` → `@rollup/plugin-commonjs` → `@rollup/pluginutils` / `fdir` → `picomatch` | No patched release exists (latest npm is 4.0.7). `npm audit fix --force` would downgrade `@sentry/nextjs` to 8.x. Picomatch compiles globs inside the Sentry bundler plugin. Paper Trail does not pass request data to it. The app calls `@sentry/nextjs` only when `SENTRY_DSN` is set. | 2026-12-17, or sooner if picomatch publishes a fix |

`glob` 14.0.6 and `minimatch` 11.0.9 are forced under `@sentry/bundler-plugins` so GHSA-3g3m-2fjr-6pw4 and GHSA-g3hv-75wg-m249 are not in the production tree.

## Secrets

Never commit API keys, webhook secrets, or password hashes. If you find a committed secret, do not copy it into an issue. Tell the owner so it can be rotated in the host dashboard.
