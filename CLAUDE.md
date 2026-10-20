# CLAUDE.md

**Read [`AGENTS.md`](AGENTS.md) first — it is the operating manual and wins over this file.**

Essentials (duplicated so they are never missed):
- Work queue: `MILESTONES.md` → take the first unchecked `[AGENT]` task in the lowest open milestone. Skip `[OWNER]`.
- Gate before every commit (must exit 0):
  ```bash
  npm ci && npm run typecheck && npm test && npm run build
  ```
- Loop: sync (`git pull --rebase origin main`) → implement → gate → self-review diff → fix → tick checkbox + `PROGRESS.md` entry → small Conventional Commit → `git push origin HEAD:main` → next task.
- Never: commit secrets, force-push, edit `.github/workflows/*` (put YAML in `docs/ci/`), run destructive DB ops, touch production or hosting dashboards, enable live payments, touch other repos.
- Blocked? Log it under `## BLOCKERS` in `PROGRESS.md`, mark the task `— BLOCKED`, move on.
