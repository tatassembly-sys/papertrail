import { createHmac, timingSafeEqual } from "crypto";
import { getSiteUrl } from "./site-url";

const STRIPE_API = "https://api.stripe.com/v1";

export class StripeConfigError extends Error {
  constructor(message = "Billing is not configured.") {
    super(message);
    this.name = "StripeConfigError";
  }
}

function secretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new StripeConfigError();
  return key;
}

function priceId(interval: "month" | "year"): string {
  const id =
    interval === "year"
      ? process.env.STRIPE_PRICE_YEARLY?.trim()
      : process.env.STRIPE_PRICE_MONTHLY?.trim();
  if (!id) throw new StripeConfigError("Stripe price IDs are not set.");
  return id;
}

async function stripeForm(
  method: "GET" | "POST" | "DELETE",
  path: string,
  params?: Record<string, string>
): Promise<Record<string, unknown>> {
  const url =
    method === "GET" && params
      ? `${STRIPE_API}${path}?${new URLSearchParams(params).toString()}`
      : `${STRIPE_API}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey()}`,
  };
  let body: string | undefined;
  if (method === "POST" && params) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(params).toString();
  }

  const res = await fetch(url, { method, headers, body });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error;
    const message =
      err && typeof err === "object" && "message" in err && typeof err.message === "string"
        ? err.message
        : "Stripe request failed.";
    const wrapped = new Error(message);
    wrapped.name = "StripeApiError";
    throw wrapped;
  }
  return json;
}

export async function createCheckoutSession(opts: {
  userId: string;
  email: string;
  interval: "month" | "year";
  customerId?: string | null;
}): Promise<{ url: string; id: string }> {
  const success = `${getSiteUrl()}/account?billing=success`;
  const cancel = `${getSiteUrl()}/pricing?billing=canceled`;
  const params: Record<string, string> = {
    mode: "subscription",
    success_url: success,
    cancel_url: cancel,
    client_reference_id: opts.userId,
    "line_items[0][price]": priceId(opts.interval),
    "line_items[0][quantity]": "1",
    "metadata[userId]": opts.userId,
    "subscription_data[metadata][userId]": opts.userId,
    allow_promotion_codes: "true",
    billing_address_collection: "auto",
  };
  if (process.env.STRIPE_AUTOMATIC_TAX === "true") {
    params["automatic_tax[enabled]"] = "true";
  }
  if (opts.customerId) {
    params.customer = opts.customerId;
  } else {
    params.customer_email = opts.email;
  }

  const session = await stripeForm("POST", "/checkout/sessions", params);
  const url = typeof session.url === "string" ? session.url : "";
  const id = typeof session.id === "string" ? session.id : "";
  if (!url) throw new Error("Checkout session missing URL.");
  return { url, id };
}

export async function createPortalSession(customerId: string): Promise<string> {
  const session = await stripeForm("POST", "/billing_portal/sessions", {
    customer: customerId,
    return_url: `${getSiteUrl()}/account`,
  });
  const url = typeof session.url === "string" ? session.url : "";
  if (!url) throw new Error("Billing portal missing URL.");
  return url;
}

export async function retrieveSubscription(
  subscriptionId: string
): Promise<Record<string, unknown>> {
  return stripeForm("GET", `/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

export async function cancelSubscriptionNow(subscriptionId: string): Promise<void> {
  await stripeForm("DELETE", `/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

export interface NormalizedSubscription {
  id: string;
  customerId: string;
  status: string;
  interval: "month" | "year" | null;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export function normalizeSubscription(raw: Record<string, unknown>): NormalizedSubscription {
  const id = typeof raw.id === "string" ? raw.id : "";
  const customer =
    typeof raw.customer === "string"
      ? raw.customer
      : raw.customer && typeof raw.customer === "object" && "id" in raw.customer
        ? String((raw.customer as { id: unknown }).id)
        : "";
  const status = typeof raw.status === "string" ? raw.status : "canceled";
  const items = raw.items as
    | {
        data?: Array<{
          current_period_end?: unknown;
          price?: { recurring?: { interval?: string } };
        }>;
      }
    | undefined;
  // Stripe API 2025-03-31 ("basil") and later moved current_period_end from
  // the subscription onto each subscription item. Accept both shapes so
  // accounts pinned to a newer default API version still record the period.
  const itemPeriodEnds = (items?.data ?? [])
    .map((item) => item?.current_period_end)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const periodEndUnix =
    typeof raw.current_period_end === "number"
      ? raw.current_period_end
      : itemPeriodEnds.length
        ? Math.max(...itemPeriodEnds)
        : null;
  const intervalRaw = items?.data?.[0]?.price?.recurring?.interval;
  const interval = intervalRaw === "year" || intervalRaw === "month" ? intervalRaw : null;
  return {
    id,
    customerId: customer,
    status,
    interval,
    periodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
    cancelAtPeriodEnd: Boolean(raw.cancel_at_period_end),
  };
}

/**
 * Subscription id on an invoice event. Legacy API versions expose
 * `invoice.subscription`; 2025-03-31+ moved it to
 * `invoice.parent.subscription_details.subscription`.
 */
export function invoiceSubscriptionId(invoice: Record<string, unknown>): string | null {
  const pick = (value: unknown): string | null => {
    if (typeof value === "string" && value) return value;
    if (value && typeof value === "object" && "id" in value) {
      const id = (value as { id: unknown }).id;
      if (typeof id === "string" && id) return id;
    }
    return null;
  };
  const legacy = pick(invoice.subscription);
  if (legacy) return legacy;
  const parent = invoice.parent;
  if (parent && typeof parent === "object") {
    const details = (parent as { subscription_details?: unknown }).subscription_details;
    if (details && typeof details === "object") {
      return pick((details as { subscription?: unknown }).subscription);
    }
  }
  return null;
}

/**
 * Verify Stripe-Signature. Rejects stale timestamps (>5 min) and
 * uses timing-safe compare on the hex digest.
 */
export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string
): boolean {
  if (!header || !secret || !payload) return false;
  const parts = header.split(",").map((p) => p.trim());
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq);
    const v = part.slice(eq + 1);
    if (k === "t") timestamp = v;
    if (k === "v1") signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const expectedHex = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const expected = Buffer.from(expectedHex, "utf8");
  for (const sig of signatures) {
    const got = Buffer.from(sig, "utf8");
    if (got.length === expected.length && timingSafeEqual(got, expected)) {
      return true;
    }
  }
  return false;
}
