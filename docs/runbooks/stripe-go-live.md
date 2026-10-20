# Stripe go-live (Paper Trail Pro)

Owner steps for turning billing on. Do this in the Stripe Dashboard and in
Vercel. Never commit a secret key, webhook secret, or price id that is live.
Test-mode examples below use placeholders only.

Billing stays off while `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY`, or
`STRIPE_PRICE_YEARLY` is unset. Checkout and the billing portal then return
HTTP 503, and the pricing page says Stripe is not configured. Reading stays
free. Rollback is unsetting those keys (below).

M6.4 (account activation and pasting keys into Vercel) is owner-only. This
file is the checklist for that.

## 1. Products and prices

In **test mode** first (Dashboard toggle "Test mode"):

1. Product catalog → Add product. Name: `Paper Trail Pro`.
2. Add two recurring GBP prices. The figures on `/pricing` are VAT-inclusive,
   so the Stripe Price must use **tax behavior: Inclusive** (do not add 20%
   on top of the amount the page shows):
   - Monthly: £8.00 GBP, billed every month. Put the `price_...` id in
     `STRIPE_PRICE_MONTHLY`.
   - Yearly: £72.00 GBP, billed every year. Put the `price_...` id in
     `STRIPE_PRICE_YEARLY`.
3. Optional display overrides, if the amounts change: `BILLING_MONTHLY_LABEL`
   and `BILLING_YEARLY_LABEL` (defaults `£8` and `£72`). Keep them equal to
   the inclusive price the customer pays.

Do not create a second VAT product. The page already says prices include VAT.

## 2. Tax

1. Stripe Tax → set the business origin address in test mode.
2. Leave the prices **inclusive**, as above.
3. Set `STRIPE_AUTOMATIC_TAX=true` only after that origin address exists.
   The checkout route sends `automatic_tax[enabled]=true` when this variable
   is the string `true`. If it is unset or anything else, Checkout does not
   ask Stripe Tax to calculate a breakdown.
4. Confirm a test checkout still charges £8 or £72, not £8 plus VAT.

## 3. Webhook

Endpoint URL:

`https://<vercel>/api/billing/webhook`

Replace `<vercel>` with the deployment host (the project `*.vercel.app` host,
or the custom domain once DNS points at it). Same path on Preview and
Production. Use a **test-mode** endpoint for Preview and a separate
**live-mode** endpoint only at launch.

Subscribe to these events (the handler also accepts
`customer.subscription.created` and `invoice.paid`):

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET`. The route
checks `Stripe-Signature` (HMAC, 5 minute window) and returns 400 on a bad
signature. It returns 503 when that secret is unset.

Processed `event.id` values are stored in MongoDB collection `stripe_events`
(the document `_id` is the event id). A duplicate delivery returns HTTP 200
with `duplicate: true` and does not change the user's plan again. A handler
failure returns 500 and deletes the in-progress row so Stripe can retry.
If the process dies after the plan was updated but before that row is marked
done, later retries stay at 500 until the row is deleted — delete it only
when you know the account was not updated. Rows expire after 90 days, which
is past Stripe's retry window.

Local forwarder, secret only in `.env.local`:

`stripe listen --forward-to localhost:3000/api/billing/webhook`

## 4. Customer portal

Dashboard → Settings → Billing → Customer portal (test mode, then live mode
when you launch):

- Allow customers to update their payment method, view invoices, and cancel.
- Cancellation can be at period end. The app records `cancel_at_period_end`
  and keeps Pro until the subscription is no longer active, trialing, or
  past_due.
- Save the configuration. The app opens the portal with
  `POST /api/billing/portal` and sets `return_url` to `<site>/account`.

No portal secret goes in the repo.

## 5. Environment (Vercel)

Set these on **Preview** with test-mode values before Production. Names only:

| Name | Notes |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` until launch. Live `sk_live_...` only for Production at launch. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for that mode's webhook endpoint. |
| `STRIPE_PRICE_MONTHLY` | Inclusive monthly price id for that mode. |
| `STRIPE_PRICE_YEARLY` | Inclusive yearly price id for that mode. |
| `STRIPE_AUTOMATIC_TAX` | `true` or `false`. |
| `BILLING_MONTHLY_LABEL` | Optional. Default `£8`. |
| `BILLING_YEARLY_LABEL` | Optional. Default `£72`. |

Redeploy after changing variables. Vercel does not apply env edits to the
deployment that is already running.

There is no publishable key in this app. Checkout is a server-created Stripe
Checkout Session.

## 6. Test cards

Use these only while the secret key is test-mode. Any future expiry, any CVC,
any postcode.

| Card | Result |
|---|---|
| `4242 4242 4242 4242` | Payment succeeds. |
| `4000 0025 0000 3155` | Requires authentication (3D Secure). |
| `4000 0000 0000 9995` | Card declined. |

Do not type a real card number into test mode. Do not copy the card or any
secret into git.

After `4242`, confirm `/account` shows Pro, then send the same webhook again
from the Stripe event log and confirm the plan does not flip a second time.
Cancel in the portal and confirm the subscription deleted event returns the
account to Free at period end (or immediately, if you cancel immediately).
Use the declined card and confirm `invoice.payment_failed` does not grant Pro
on its own.

## 7. Rollback

Unset these four variables and redeploy:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_MONTHLY`
- `STRIPE_PRICE_YEARLY`

Checkout and the portal return 503 again. The webhook returns 503. The
pricing page keeps the free reading path and the "Stripe is not configured"
message. Comp Pro (`BILLING_GRANT_EMAILS` or the admin grant) is unchanged.
Do not delete Stripe customers or the `stripe_events` collection as part of
rollback.

Switching off live mode is the same action: unset the live keys. Do not leave
a live secret key in Preview.
