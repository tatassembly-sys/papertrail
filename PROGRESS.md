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

- [open] 2026-10-20 M0 — Atlas cluster, Vercel project, cron-job.org schedules — needs: OWNER.
- [open] 2026-10-20 M2 — OpenRouter key rotation, Resend domain — needs: OWNER.

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

### 20 October 2026 — setup — agent operating manual and launch milestones
- Agent: Grok Bot (audit)
- Change: added `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/agents.mdc`, `PROGRESS.md`; rewrote `MILESTONES.md` (M0..M10); refreshed `STATUS.md` header.
- Checks run: see Baseline check results above.
- Follow-ups: start at M0.
