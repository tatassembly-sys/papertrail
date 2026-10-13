# Paper Trail

Dense academic research papers, translated into plain language for a general
audience — without losing scientific accuracy. Every article is AI-translated
from a real paper, always links back to its source, and always discloses the
study's limitations. Nothing publishes without a human editor's review.

> **Milestones / roadmap:** see [`MILESTONES.md`](MILESTONES.md) for the latest audit and the milestones to market-ready (agent-ready prompts included).

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Database | MongoDB |
| Hosting | Vercel (Hobby) + MongoDB Atlas (pre-launch; Railway kept until cut-over is verified) |
| AI translation | OpenRouter (Claude Sonnet by default) |
| Paper sources | arXiv (AI, space, physics, biology, economics) + PubMed (clinical/medical topics arXiv doesn't cover) |
| Auth | JWT-based single admin account, no third-party auth dependency |
| Design | Custom "field notes" identity — Fraunces + Inter + IBM Plex Mono, cool paper-grey + navy ink + a proofreader's-red accent |

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in the values — see SETUP.md for how
npm run dev
```

**→ For deployment, MongoDB indexes, social posting, cron jobs, and production
hardening, see [`SETUP.md`](./SETUP.md).** That file has a numbered deployment
checklist at the top; start there when you're ready to ship.

## What's here

- **Public site**: home feed with search + category filtering, article pages,
  RSS/sitemap, Open Graph images, and a public "suggest a paper" form
  (submissions require editor review before anything gets translated or published)
- **Paper Trail Pro**: optional Stripe subscription. Reading stays free; Pro
  unlocks unlimited paper chat, markdown export, a larger library, and
  priority suggestions. Labs can request a quote from `/pricing`. Checkout is
  off until Stripe keys are set.
- **Library & discovery**: author and topic pages, today's mix, reading lists,
  highlights, APA/MLA/Chicago/BibTeX cite (Zotero Highwire meta tags on
  articles), personalized Home ("For you"), and `/` to focus search.
- **Admin**: dashboard (search/filter/paginate), an editor per article (edit,
  publish, share to socials immediately or on a schedule), manual paper
  submission (URL or pasted text), and a queue for visitor suggestions
- **Ingestion pipeline**: two daily sweeps (arXiv + PubMed) that enqueue new
  papers, and a queue worker that does the actual AI translation — retried
  automatically on failure, capped at 3 attempts

## Project structure

```
app/              Routes (App Router) — public pages, /admin/*, /api/*
components/       Shared React components
lib/              Data access (Mongo), auth, AI translation, social posting,
                  paper extraction (arXiv/PubMed) — business logic
middleware.ts     Route protection for /admin/*
vercel.json       Vercel region (lhr1); keep railway.toml until cut-over is verified
railway.toml      Legacy Railway build/start + healthcheck (do not delete yet)
.env.example      All environment variables with generation notes
```

## Non-negotiables (enforced in code)

- Every published article requires a source URL — enforced server-side
  (`PATCH /api/articles/[id]` rejects publishing without one)
- Publishing is always a manual, authenticated action — auto-pulled papers
  and visitor submissions both land as **drafts**, never live automatically
- The "study limitations" (`caveats`) field is required in the AI output
  schema, not optional
- Cron HTTP endpoints require `CRON_SECRET` in production
- Admin routes are middleware-protected and re-checked on sensitive APIs

## Deploy (Vercel + Atlas)

Pre-launch target while Railway spend is capped. Full checklist: [`SETUP.md`](./SETUP.md) and **MR0** in [`MILESTONES.md`](./MILESTONES.md).

1. Create a MongoDB Atlas M0 cluster; set `MONGODB_URI` / `MONGODB_DB`
2. Import this repo in Vercel (framework Next.js, `npm run build`)
3. Copy vars from `.env.example` into Vercel Production env
4. Set `NEXT_PUBLIC_SITE_URL` to the Vercel URL (or custom domain later)
5. Schedule crons with an external free scheduler (cron-job.org) using `Authorization: Bearer $CRON_SECRET` — Vercel Hobby only runs declarative crons once a day
6. Keep `railway.toml` until the Vercel deploy is verified healthy, then remove the Railway service

Legacy Railway steps remain in `SETUP.md` for rollback only.
