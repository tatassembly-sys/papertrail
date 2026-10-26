# API route matrix

Audit of `app/api/**/route.ts`. "Public" means the handler does useful work without an admin session or cron bearer. User-session routes are still internet-reachable and are rate limited.

Limits are per hashed client IP unless noted. Schema means a size-capped JSON or form body with typed fields.

| Route | Methods | Auth | Rate limit | Input validation |
|---|---|---|---|---|
| `app/api/admin/billing/grant/route.ts` | POST | admin | admin session | JSON body |
| `app/api/admin/articles/bulk/route.ts` | POST | admin | admin session | JSON ≤16 KB; `action` publish/reject, ≤100 string ids; publish gate per article; only drafts |
| `app/api/admin/queue/retry/route.ts` | POST | admin | admin session | JSON ≤16 KB; optional `ids` (strings, ≤500) |
| `app/api/admin/publish-mix/route.ts` | POST | cron bearer or admin | cron compare / admin session | none (no body) |
| `app/api/admin/status/route.ts` | GET | admin | admin session | none |
| `app/api/articles/[id]/approve-share/route.ts` | POST | admin | admin session | JSON body |
| `app/api/articles/[id]/chat/route.ts` | GET, POST | public; optional user | POST: free daily quota, hourly IP, `chat_ip_day`, `chat_user_day` | JSON `message` max 2000 |
| `app/api/articles/[id]/export/route.ts` | GET | user and Pro plan | user session | id param |
| `app/api/articles/[id]/route.ts` | PATCH, DELETE | admin | admin session | JSON body on PATCH |
| `app/api/articles/[id]/schedule/route.ts` | GET, POST | admin | admin session | JSON body on POST |
| `app/api/articles/[id]/share/route.ts` | POST | admin | admin session | JSON body |
| `app/api/auth/forgot-password/route.ts` | POST | public | `forgot_password` 8/hour | JSON email |
| `app/api/auth/login/route.ts` | POST | public | login lockout 5 failures / 15 min | JSON email + password length cap |
| `app/api/auth/logout/route.ts` | POST | public | `admin_logout` 30/hour | none |
| `app/api/auth/register/route.ts` | POST | public | `register` 8/hour | JSON email, password policy, name |
| `app/api/auth/resend-verify/route.ts` | POST | user | `resend_verify` 5/hour | none |
| `app/api/auth/reset-password/route.ts` | POST | public | `reset_password` 10/hour | JSON token + password policy |
| `app/api/auth/user-login/route.ts` | POST | public | login lockout 5 failures / 15 min | JSON email + password length cap |
| `app/api/auth/user-logout/route.ts` | POST | public | `user_logout` 30/hour | none |
| `app/api/auth/verify-email/route.ts` | GET, POST | public | POST `verify_email` 20/hour | token from JSON or form, max 128 |
| `app/api/billing/checkout/route.ts` | POST | user | `billing_checkout` 10/hour | JSON `interval` month or year |
| `app/api/billing/inquiry/route.ts` | POST | public | `billing_inquiry` 3/day | JSON body |
| `app/api/billing/portal/route.ts` | POST | user | `billing_portal` 10/hour | none |
| `app/api/billing/webhook/route.ts` | POST | Stripe signature | none on purpose (retries must not be dropped) | raw body + signature |
| `app/api/collections/route.ts` | GET, POST | user | POST `collections_post` 30/hour | JSON name, description, public |
| `app/api/collections/[id]/route.ts` | GET, PATCH, DELETE | user (public GET if the list is public) | PATCH 60/hour, DELETE 30/hour | JSON fields on PATCH |
| `app/api/cron-fetch/route.ts` | GET | cron bearer | constant-time bearer compare | none |
| `app/api/cron-fetch-pubmed/route.ts` | GET | cron bearer | constant-time bearer compare | none |
| `app/api/cron-publish-mix/route.ts` | GET | cron bearer | constant-time bearer compare | none |
| `app/api/health/route.ts` | GET | public | none (readiness) | none |
| `app/api/highlights/route.ts` | GET, POST | user | POST `highlights_post` 60/hour | JSON slug, quote, note |
| `app/api/highlights/[id]/route.ts` | DELETE | user | `highlights_delete` 60/hour | id param |
| `app/api/me/route.ts` | GET, PATCH, DELETE | user (GET also reports admin cookie) | PATCH 60/hour, DELETE 5/hour | JSON profile fields |
| `app/api/me/export/route.ts` | GET | user | `me_export` 10/hour | none |
| `app/api/newsletter/digest/route.ts` | GET, POST | cron bearer or admin | constant-time bearer compare | none |
| `app/api/newsletter/subscribe/route.ts` | POST | public | `newsletter_subscribe` 10/hour | JSON email |
| `app/api/newsletter/unsubscribe/route.ts` | GET, POST | public token | POST `newsletter_unsubscribe` 30/hour | token from query, JSON, or form, max 128 |
| `app/api/newsletter/verify/route.ts` | GET, POST | public token | POST `newsletter_verify` 20/hour | token from JSON or form, max 128 |
| `app/api/posts/published/route.ts` | GET | public | none (read) | query |
| `app/api/process-paper/route.ts` | POST | admin | `process_paper_ip_day` and `process_paper_admin_day` 40/day | JSON url or rawText |
| `app/api/process-queue/route.ts` | GET | cron bearer | constant-time bearer compare | none |
| `app/api/process-scheduled-posts/route.ts` | GET | cron bearer | constant-time bearer compare | none |
| `app/api/scheduled-posts/[id]/route.ts` | DELETE | admin | admin session | id param |
| `app/api/search/suggest/route.ts` | GET | public | `search-suggest` 60/minute | query string |
| `app/api/submissions/route.ts` | GET, POST | GET admin; POST user | POST per-user day or per-week | JSON url and note |
| `app/api/submissions/[id]/route.ts` | PATCH | admin | admin session | JSON body |

Public POSTs that previously had a schema but no rate limit now call `tooManyPublicWrites`. Admin and cron handlers are not given a second IP limiter. The Stripe webhook stays signature-only.
