# Grok Bot log

Newest first. Items marked `in progress: Grok Bot` are claimed; other agents skip them.

- 2026-11-24 18:55 — NEXT-TASKS-R3 — done (#15 PY1–PY7; counted tests 229 (unit 156, integration 39, e2e 34) → target ≥520): Henry asked (2026-11-24) for a new extensive VS Code brief with sub-agents and a 500-test minimum. New agents/vscode/NEXT_TASKS.md for this repo only; 2026-11-17 brief archived at agents/vscode/archive/NEXT_TASKS-2026-11-17.md; agents/vscode/HANDOVER.md points to it. Counts measured on the Grok Bot box.
- 2026-11-24 18:40 — SHIP-LOCAL-NEXT — Henry approved (2026-11-24, "Every suggestion is a go"): pushed `grokbot/local-next-2026-11-23` as `grokbot/next-2026-11-23` and opened a grok-bot PR to `main` (next 15.5.29, ISR empty-list fix, `app/(home)/loading.tsx` removal shipped as is, export completeness fix). No rebase needed (0 behind main).
- 2026-11-23 03:20 — EXPORT-COMPLETE — done locally on `grokbot/local-next-2026-11-23` (not pushed; awaiting Henry): `5c15873` `/api/me/export` (Art. 15) no longer silently stops at 200 chats / 200 submissions / 50 billing inquiries (and 200 collections / 500 highlights); 10,000-row safety ceiling per section, reported via `complete` / `truncated`. Unit 154 → 156, integration 37 → 39, coverage lines 84.44% → 85.33%.
- 2026-11-23 02:31 — LOCAL-NEXT — done locally on `grokbot/local-next-2026-11-23` (not pushed; awaiting Henry): `62c6b4a` next 15.5.29 (prod audit 3 moderate → 0; picomatch high GHSA-fc5q-39xc-vjpf withdrawn upstream 2026-11-18, no override needed); `e3c10a2` ISR /authors and /topics no longer cache an empty page on a failed DB load (DB-less build → ƒ, DB build → ○ 5m); `3004074` removed app/(home)/loading.tsx — it made Next drop ~1 in 5 same-page search-param navigations (4/24, 6/24 stuck vs 0/24), new smoke regression test. Gate: lint/typecheck 0, sandbox 545/545, unit 154/154, integration 37/37, coverage 84.44%, build 0, audit 0; e2e 34/34 ×3 on fresh cold servers (was: discovery authors test failed on every fresh build).
- 2026-11-18 00:45 — review+merge — vscode #12 (PX1–PX6) verified milestone by milestone: coverage 84.38% (gate 70), integration 37/37, e2e 33/33 + discovery 7/7 ×3, route-matrix mutation check fails as expected, docs script check ok. Picomatch high (no upstream fix) documented. Squash-merged → main `f72b175`.
- 2026-11-17 12:20 — NEXT-TASKS — checked `main` (gate, coverage, audit, branches) and published `agents/vscode/NEXT_TASKS.md` (PX1–PX6) as the active VS Code brief; HANDOVER.md points to it; VS1–VS5 marked complete.
- 2026-11-16 11:55 — review+merge — kept vscode author-search/RSS/index-cap fixes (df95a1c, cfb663a, f7159f6) on a fresh branch from main; cherry-pick applied cleanly. Gate: lint/typecheck/sandbox 545/unit 127/integration 24/build green. No open vscode PR to close.
- 2026-11-03 23:16 — review+merge — verified vscode PR #8 (VS1–VS5): gate green, e2e 26/26 ×2; squash-merged → main `486294c`. Ticked VS1–VS5 in HANDOVER. No remaining agent-doable VS work; OWNER blockers stand.
- 2026-10-27 08:20 — review (orchestrator, morning) — no lane activity overnight; FONTS-LOCAL merged (#6, 77ac5dc); account e2e + admin a11y reassigned to grokbot; vscode gets the font-request guard spec.
- 2026-10-27 08:25 — done: FONTS-LOCAL — `next/font/google` → `next/font/local` (Fraunces 500–700, Inter 400–700, IBM Plex Mono 400–500 latin woff2 from @fontsource 5.3.0, OFL licences in `app/fonts/`), same CSS variables; build passes with proxy pointed at 127.0.0.1:9; fonts test asserts files + licences exist.
- 2026-10-26 20:25 — review (orchestrator, evening) — gate green at c9740df; #4/#5 verified (coverage 66.68% ≥ 60%); M4.3 hash → caad5bb; next: vscode e2e account + admin a11y (carried), grokbot self-hosted fonts.
- done: M10.2
- done: M10.2 (production read-only: smoke, axe, Lighthouse)
- done: M9.3 (model+cost, bulk UI), M9.2, M8.4 (ISR topics/authors), M4.3 (lines 66.7% ≥ 60%, re-ticked), M10.6
- 2026-10-26 14:20 — review (orchestrator) — gate green at 6f9fd39; M4.3 unticked (coverage 37.9% < 60% target); grokbot keeps PR #4 items (M4.3, M9.3, M8.4, M9.2, M10.6); vscode gets e2e account journeys + admin a11y specs (tests only).
- done: M9.4, M8.5; partial: M9.3 (API + retry button), M10.2 (smoke only)
- done: M9.1, M9.5, M8.3, M8.1
- done: M8.4 (partial: probe cache + projections), M10.1, fix text index under strict Stable API
- done: M7.1
- done: M4.2, M4.3, M4.4, M7.2, M7.3
- done: M2 deps (audit 0 prod advisories)
