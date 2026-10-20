# Data inventory (draft for owner review)

Last updated: 19 October 2026. This describes collections and fields the application code writes. It is **not** a legal sign-off, a DPIA, or an ICO registration decision (those are owner tasks, M5.7).

Lawful-basis labels below use UK GDPR Article 6(1). Each one is a **draft for the owner to confirm or replace**. Do not treat this file as advice that a basis has been chosen.

No secrets, connection strings, or token values belong in this document.

## Processors

| Processor | Role | Personal data they can see | Transfer note (draft) |
|---|---|---|---|
| MongoDB Atlas | Database for every collection below | Everything stored in Mongo | Cluster region is chosen in the Atlas project, not in this repo. It may be in the UK, the EEA, or the US. Owner must record the live region. |
| Vercel | Application host (`vercel.json` region `lhr1`) | Request metadata, application logs, anything the app sends through the runtime | Compute is requested in London. Vercel is a US company; logs and edge control traffic may leave the UK. |
| Resend | Email when `RESEND_API_KEY` is set. If the key is missing, `lib/mail.ts` logs a redacted preview and does not call Resend | Recipient address, subject, and message body (confirm, reset, and newsletter links) | Resend processes mail outside the UK (United States). |
| OpenRouter | Plain-English drafts and article chat when `OPENROUTER_API_KEY` is set | Paper text sent for translation, and the chat question plus article context | OpenRouter and the model provider may process prompts outside the UK. |
| Stripe | Card payments only when billing keys are set. Checkout, portal, and webhook return 503 when they are not | Email on the Checkout session, Stripe customer id, subscription id. Card numbers stay at Stripe | Stripe processes in the US and other regions it publishes. This app stores ids, not the card number. |

Optional, only if those keys are set: xAI (chat or translation fallback) may receive the same prompt text as OpenRouter. X, Reddit, Facebook, and Instagram may receive a public article caption when social posting is switched on. They are not used for account or newsletter data. Railway environment names remain in the repo as a legacy host; new hosting in this inventory is Vercel.

arXiv and NCBI PubMed are sources of papers. They are not processors of Paper Trail account data. NCBI asks for a tool name and contact email on E-utilities requests (`PUBMED_TOOL_NAME`, `PUBMED_CONTACT_EMAIL`).

## Not stored in Mongo

| Item | Where | Personal data | Purpose | Draft basis | Retention |
|---|---|---|---|---|---|
| `pt_session` | HTTP cookie | Admin session JWT | Keep a staff editor signed in | Art. 6(1)(b) contract / Art. 6(1)(f) legitimate interests (securing the admin tool) | 7 days, or until logout |
| `pt_user` | HTTP cookie | Reader session JWT (user id, email, token version) | Keep a reader signed in | Art. 6(1)(b) contract | 14 days, or until logout or account deletion |
| `pt_chat` | HTTP cookie | Random session key for anonymous article chat | Continue one chat thread and apply abuse limits | Art. 6(1)(f) legitimate interests | 30 days |
| Theme | `localStorage` key on the device | None (light or dark). Not sent to the server as an account field | Remember a display preference | Not personal data if it stays on the device | Until the reader clears site data |

These cookies are strictly necessary for the feature they support. The app does not set an analytics cookie.

## Collections

Indexes are created in `lib/indexes.ts`. Writes are the `db.collection(...)` call sites under `lib/` and `scripts/`.

### `users`

Written by `lib/users.ts` and billing sync.

| Field | Personal data? | Purpose | Draft lawful basis | Retention | Processor |
|---|---|---|---|---|---|
| `email` | Yes | Account identity, sign-in, mail | Art. 6(1)(b) contract | Until the reader deletes the account | Atlas; copied to Resend or Stripe only when those flows run |
| `password_hash` | Yes (credential) | Check the password. The plaintext password is not stored | Art. 6(1)(b) contract | Until account deletion or password change | Atlas |
| `name` | Yes | Display name on the account | Art. 6(1)(b) contract | Until account deletion or the reader edits it | Atlas |
| `email_verified` | Yes | Whether the address was confirmed | Art. 6(1)(b) contract | Until account deletion | Atlas |
| `verify_token` | Yes (secret, stored as SHA-256) | Email confirmation link | Art. 6(1)(b) contract | Cleared when the address is verified | Atlas |
| `reset_token`, `reset_token_expires` | Yes (secret, stored as SHA-256) | Password reset. Expires after 1 hour | Art. 6(1)(b) contract | Cleared on reset, or after expiry | Atlas |
| `saved_slugs`, `bookmarks` | Yes (reading preferences) | Library | Art. 6(1)(b) contract | Until account deletion or the reader removes them | Atlas |
| `followed_topics` | Yes (interests) | “For you” ordering and the newsletter section | Art. 6(1)(b) contract | Until account deletion or the reader edits them | Atlas; topic labels may be used to pick public article titles in a digest |
| `reading_history` (`slug`, `at`) | Yes | Recently opened notes while signed in | Art. 6(1)(b) contract | Until account deletion | Atlas |
| `token_version` | No (session counter) | Invalidate old sign-in cookies | Art. 6(1)(f) legitimate interests | Until account deletion | Atlas |
| `plan`, `plan_status`, `plan_interval`, `plan_period_end`, `plan_cancel_at_period_end`, `plan_override` | Yes (subscription status) | Paper Trail Pro entitlement | Art. 6(1)(b) contract | Until account deletion | Atlas; Stripe holds the payment record |
| `stripe_customer_id`, `stripe_subscription_id` | Yes (payment identifiers, not the card) | Match webhooks to the account | Art. 6(1)(b) contract | Until account deletion. Deletion cancels a live subscription first | Atlas and Stripe |
| `created_at` | Yes | Account record | Art. 6(1)(b) contract | Until account deletion | Atlas |

Account deletion (`DELETE /api/me`) removes that user’s document by `_id` only. It does not drop the collection.

### `newsletter_subscribers`

Written by `lib/newsletter.ts`.

| Field | Personal data? | Purpose | Draft lawful basis | Retention | Processor |
|---|---|---|---|---|---|
| `email` | Yes | Send the digest the person asked for | Art. 6(1)(a) consent | Kept after unsubscribe so the address is not treated as a new subscriber. No extra deletion job exists in code. Owner to set a horizon | Atlas; Resend when a message is sent |
| `status` | Yes | `pending`, `active`, or `unsubscribed` | Art. 6(1)(a) consent | Same as the row | Atlas |
| `verify_token` | Yes (SHA-256) | Double opt-in. A GET of the link does not confirm | Art. 6(1)(a) consent | Cleared on confirm | Atlas |
| `unsubscribe_token` | Yes (SHA-256) | One-click unsubscribe | Art. 6(1)(a) consent | Rotated only after Resend accepts a digest send | Atlas |
| `created_at` | Yes | When the address was added | Art. 6(1)(a) consent | Same as the row | Atlas |
| `verified_at` | Yes | When double opt-in completed | Art. 6(1)(a) consent | Same as the row | Atlas |
| `unsubscribed_at` | Yes | When they opted out | Art. 6(1)(a) consent | Same as the row | Atlas |

Confirmation is `POST /api/newsletter/verify` only. Scanners that GET the link are redirected to a page and do not change `status`.

### `article_chats`

Written by `lib/article-chat.ts`.

| Field | Personal data? | Purpose | Draft lawful basis | Retention | Processor |
|---|---|---|---|---|---|
| `user_id` | Yes when signed in | Tie the thread to an account | Art. 6(1)(b) if signed in; Art. 6(1)(f) if only a cookie key | Deleted with the account (`user_id` filter). Anonymous rows have no TTL in code | Atlas |
| `session_key` | Yes (pseudonymous) | Find the thread for `pt_chat` or `user:<id>` | Art. 6(1)(f) legitimate interests | Same as the thread | Atlas |
| `article_id`, `article_slug` | No | Which published note the question was about | — | Same as the thread | Atlas |
| `messages` (`role`, `content`, `at`) | Yes (the question, and the reply which may quote it) | Show the thread again | Art. 6(1)(b) or Art. 6(1)(f) as above | Same as the thread | Atlas. The question and article context are sent to OpenRouter (and xAI if that fallback runs) |
| `created_at`, `updated_at` | Yes | Ordering | Same as the thread | Same as the thread | Atlas |

### `collections`

Reading lists. Written by `lib/collections.ts`.

| Field | Personal data? | Purpose | Draft lawful basis | Retention | Processor |
|---|---|---|---|---|---|
| `user_id` | Yes | Owner of the list | Art. 6(1)(b) contract | Deleted with the account (`user_id` filter) | Atlas |
| `name`, `slug`, `description` | Yes if the reader writes them | The list | Art. 6(1)(b) contract | Until the reader deletes the list or the account | Atlas. A list marked `public` is shown without the account email |
| `slugs` | Yes (what they saved) | Papers on the list | Art. 6(1)(b) contract | Same | Atlas |
| `public` | No | Whether the list is on the public site | Art. 6(1)(b) contract | Same | Atlas |
| `created_at`, `updated_at` | Yes | Ordering | Art. 6(1)(b) contract | Same | Atlas |

### `highlights`

Written by `lib/highlights.ts`.

| Field | Personal data? | Purpose | Draft lawful basis | Retention | Processor |
|---|---|---|---|---|---|
| `user_id` | Yes | Owner | Art. 6(1)(b) contract | Deleted with the account (`user_id` filter) | Atlas |
| `article_slug` | Yes (what they marked) | Which note | Art. 6(1)(b) contract | Same | Atlas |
| `quote`, `note` | Yes | Passage and the reader’s note | Art. 6(1)(b) contract | Until they delete the highlight or the account | Atlas |
| `created_at` | Yes | Ordering | Art. 6(1)(b) contract | Same | Atlas |

### `submissions`

“Suggest a paper”. Written by `lib/submissions.ts`.

| Field | Personal data? | Purpose | Draft lawful basis | Retention | Processor |
|---|---|---|---|---|---|
| `url` | Maybe (the link itself) | Editorial queue | Art. 6(1)(f) legitimate interests (running suggestions) | Kept for the queue. No TTL in code | Atlas |
| `note` | Yes if the sender writes one | Context for the editor | Art. 6(1)(f) legitimate interests | Same | Atlas |
| `ip_hash` | Yes (SHA-256 of the IP, not the raw address) | Rate limit (3 per hour per hash) | Art. 6(1)(f) legitimate interests | Same as the row. There is no separate TTL | Atlas |
| `user_id` | Yes when signed in | Priority submissions for an account | Art. 6(1)(b) contract when they are signed in | Same | Atlas |
| `status`, `submitted_at`, `priority` | `submitted_at` can be linked to a person | Queue handling | Art. 6(1)(f) legitimate interests | Same | Atlas |

### `billing_inquiries`

Lab or team enquiries. Written by `lib/billing-inquiries.ts`. Not a card payment.

| Field | Personal data? | Purpose | Draft lawful basis | Retention | Processor |
|---|---|---|---|---|---|
| `name`, `email`, `org` | Yes | Reply to the enquiry | Art. 6(1)(b) steps before a contract, or Art. 6(1)(f) | No TTL in code. Owner to set a horizon | Atlas |
| `seats`, `note` | Yes if it identifies someone | What they asked for | Same | Same | Atlas |
| `created_at` | Yes | Ordering | Same | Same | Atlas |

### `login_attempts`

Written by `lib/loginAttempts.ts`.

| Field | Personal data? | Purpose | Draft lawful basis | Retention | Processor |
|---|---|---|---|---|---|
| `ip_hash` | Yes (pseudonymous) | Lock out after 5 failures in 15 minutes | Art. 6(1)(f) legitimate interests | TTL index `login_ttl`: 3600 seconds | Atlas |
| `attempted_at` | Yes when tied to the hash | The window | Art. 6(1)(f) legitimate interests | Same TTL | Atlas |

The raw IP address is not stored. Successful sign-in deletes that hash’s rows (`ip_hash` filter).

### `rate_limits`

Written by `lib/rate-limit.ts`.

| Field | Personal data? | Purpose | Draft lawful basis | Retention | Processor |
|---|---|---|---|---|---|
| `bucket` | No | Which limit (register, chat, and so on) | Art. 6(1)(f) legitimate interests | TTL index `rate_limits_ttl`: 8 days | Atlas |
| `key` | Yes (SHA-256 of an IP, or a user id on account-scoped buckets) | Who is being counted | Art. 6(1)(f) legitimate interests | Same TTL | Atlas |
| `window`, `count`, `at` | The key makes the count personal | Enforce the cap | Art. 6(1)(f) legitimate interests | Same TTL | Atlas |

### `articles`

Editorial notes, not reader accounts. Author names of the source paper are personal data about those researchers.

| Field | Personal data? | Purpose | Draft lawful basis | Retention | Processor |
|---|---|---|---|---|---|
| `authors`, `institutions` | Yes (researchers named on the paper) | Credit the source | Art. 6(1)(f) legitimate interests (citation). Journalism / academic exemption is for the owner to assess | Kept while the note exists | Atlas. Names may be sent to OpenRouter inside the paper text |
| `title`, `headline`, `why_it_matters`, `plain_explanation`, `caveats`, `keywords`, `tags` | Usually no. A note must not be the raw PDF of a non-open paper | The published explanation | Art. 6(1)(f) legitimate interests | Kept while the note is on the site | Atlas. The source text used to draft the note is sent to OpenRouter or xAI |
| `source_url`, `source`, `category`, `slug`, `status`, `created_at`, `published_at`, `shared_to`, `share_approved` | No | Publishing and linking back to the paper | — | Same | Atlas. `source_url` is public on the note |

### `fetch_queue`

arXiv ids and PubMed ids waiting to be drafted (`lib/queue.ts`). Fields: `source`, `external_id`, `url`, `category`, `status`, `attempts`, `error_message`, `created_at`, `processing_started_at`. These identify papers, not site visitors. No reader personal data. Retention: the row stays after `done` or `error`. No TTL in code. Processor: Atlas.

### `scheduled_posts`

`lib/scheduledPosts.ts`. Fields: `article_id`, `platform`, `scheduled_for`, `status`, `attempts`, `error_message`, `created_at`, `processing_started_at`. Operational. No reader personal data. Processor: Atlas. The public caption may be sent to a social network if posting is enabled.

### `newsletter_runs`

One row per digest attempt (`lib/newsletter.ts`): `at`, `mode`, `subscribers` (a count), `sent`, `failed`, `logged`, `subject`, `articleCount`, `aiSummary`. The summary is about published notes, not a list of email addresses. Processor: Atlas. The addresses themselves are read from `newsletter_subscribers` and sent through Resend when mail is configured. No TTL in code.

### `publish_mix_runs`

`lib/publish-mix.ts`. Fields: `dateKey`, `at`, `published` (a count), `items` (field, title, slug). Editorial operations. No reader personal data. Processor: Atlas.

### `cron_runs`

`lib/cron-run.ts`. Fields: `job`, `status`, `duration_ms`, `ok`, `error` (redacted), `at`. Operational logs. The error string is passed through a redaction helper and must not contain secrets. No reader personal data by design. No TTL in code. Processor: Atlas.

## Rights the product can already carry out

Draft mapping for the owner. This is not a statement that every request has been tested with a live user.

| Right | What the code does |
|---|---|
| Access and portability | `GET /api/me` returns the signed-in profile. `GET /api/me/export` returns that user’s account, lists, highlights, chats, suggestions, newsletter status, and lab enquiries as JSON. Password hashes and mail tokens are omitted. Every query is filtered by that user id or that email |
| Rectification | `PATCH /api/me` updates name and followed topics. Saves and bookmarks can be removed there |
| Erasure | `DELETE /api/me` deletes that user’s `users` row and their `collections`, `highlights`, and `article_chats` by `user_id`, unsubscribes that email, and cancels a Stripe subscription if one is stored. It does not drop a collection |
| Withdraw consent | Newsletter unsubscribe is one POST with the token. GET does not unsubscribe or confirm |
| Objection / restriction | No separate control in the product. The owner handles these by email once a contact address exists |

## Owner still has to decide

- Legal name and postal address of the controller (placeholder on the privacy page until then).
- Whether the draft Article 6 labels above are the ones they will rely on.
- Atlas cluster region, and the transfer tool (UK IDTA / Addendum or equivalent) for Vercel, Atlas, Resend, OpenRouter, and Stripe.
- How long unsubscribed newsletter rows, anonymous chats, submissions, enquiries, and ops logs are kept.
- ICO registration and a review of this inventory, the privacy page, and the cookie page (M5.7).
