# CLAUDE.md

**Read [`AGENTS.md`](AGENTS.md) first — it is the operating manual and wins over this file.**

**Agent lanes (AGENTS.md §0):** VS Code agents work on branch `vscode/work`, open PRs to `main` labelled `vscode-agent`, log in `agents/vscode/LOG.md`, never push to `main` or `grokbot/*`, and check `agents/grokbot/LOG.md` to avoid duplicating Grok Bot items.

Essentials (duplicated so they are never missed):
- Work queue: `MILESTONES.md` → take the first unchecked `[AGENT]` task in the lowest open milestone. Skip `[OWNER]`.
- Gate before every commit (must exit 0):
  ```bash
  npm ci && npm run typecheck && npm test && npm run build
  ```
- Loop: sync (`git pull --rebase origin main`) → implement → gate → self-review diff → fix → tick checkbox + `PROGRESS.md` entry → small Conventional Commit → `git push origin HEAD:vscode/work` + PR labelled `vscode-agent` → next task.
- Never: commit secrets, force-push, edit `.github/workflows/*` (put YAML in `docs/ci/`), run destructive DB ops, touch production or hosting dashboards, enable live payments, touch other repos.
- Blocked? Log it under `## BLOCKERS` in `PROGRESS.md`, mark the task `— BLOCKED`, move on.

**VS Code handover:** read `agents/vscode/HANDOVER.md` (VS1..VSn). Work on `vscode/work` only; never push to `main` or `grokbot/*`; label PRs `vscode-agent`; log in `agents/vscode/LOG.md`. Use sub-agents if available. Do not stop until all milestones are verified. After each milestone, push, append a Handover note, update the PR. Only Grok Bot merges.
