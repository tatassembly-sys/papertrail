# Paper Trail

Dense academic research papers, translated into plain language for a general
audience — without losing scientific accuracy. Every article is AI-translated
from a real paper, always links back to its source, and always discloses the
study's limitations. Nothing publishes without a human editor's review.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Database | MongoDB |
| Hosting | Railway |
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
railway.toml      Railway build/start + healthcheck
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

## Railway

1. Connect the GitHub repo to Railway
2. Attach MongoDB (plugin `MONGO_URL` or your own `MONGODB_URI`)
3. Copy vars from `.env.example` into the Railway dashboard
4. Deploy (`npm run build` / `npm run start` via `railway.toml`)
5. Set `NEXT_PUBLIC_SITE_URL` to your public domain and redeploy
6. Point health checks at `/api/health`
7. Schedule crons (arXiv, PubMed, process-queue, process-scheduled-posts)

Full detail: [`SETUP.md`](./SETUP.md).
