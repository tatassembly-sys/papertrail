import { NextRequest, NextResponse } from "next/server";
import { billingEffects } from "@/lib/billing";
import { stripeWebhookConfigured } from "@/lib/entitlements";
import { asRecord } from "@/lib/json-body";
import { getStripeEventStore } from "@/lib/stripe-events";
import {
  invoiceSubscriptionId,
  normalizeSubscription,
  verifyStripeSignature,
} from "@/lib/stripe";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EVENT_ID = 255;

function stripeId(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id: unknown }).id;
    if (typeof id === "string" && id) return id;
  }
  return null;
}

async function applyStripeEvent(type: string, object: Record<string, unknown>) {
  const fx = billingEffects();
  if (type === "checkout.session.completed") {
    const userIdMeta =
      (asRecord(object.metadata)?.userId as string | undefined) ||
      (typeof object.client_reference_id === "string" ? object.client_reference_id : null);
    const customerId = stripeId(object.customer);
    const subscriptionId = stripeId(object.subscription);
    const userId = await fx.resolveUserIdFromStripe({
      userId: userIdMeta,
      customerId,
    });
    if (userId && subscriptionId) {
      await fx.syncStripeSubscriptionId(userId, subscriptionId);
    } else if (userId && customerId) {
      // Remember the customer, but do not grant Pro without a subscription.
      // checkout.session.completed can fire without one (setup / abandoned).
      await fx.applyBillingState(userId, {
        stripe_customer_id: customerId,
      });
    }
    return;
  }

  if (
    type === "customer.subscription.created" ||
    type === "customer.subscription.updated" ||
    type === "customer.subscription.deleted"
  ) {
    const sub = normalizeSubscription(object);
    const metaUser = (asRecord(object.metadata)?.userId as string | undefined) || null;
    const userId = await fx.resolveUserIdFromStripe({
      userId: metaUser,
      customerId: sub.customerId,
    });
    if (userId) await fx.syncNormalizedSubscription(userId, sub);
    return;
  }

  if (type === "invoice.paid" || type === "invoice.payment_failed") {
    const subscriptionId = invoiceSubscriptionId(object);
    const customerId = stripeId(object.customer);
    const userId = await fx.resolveUserIdFromStripe({ customerId });
    if (userId && subscriptionId) {
      const rawSub = await fx.retrieveSubscription(subscriptionId);
      await fx.syncNormalizedSubscription(userId, normalizeSubscription(rawSub));
    }
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
  if (!stripeWebhookConfigured() || !secret) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  const raw = await req.text();
  const header = req.headers.get("stripe-signature");
  if (!verifyStripeSignature(raw, header, secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const eventId = typeof event.id === "string" ? event.id.trim() : "";
  if (!eventId || eventId.length > MAX_EVENT_ID) {
    return NextResponse.json({ error: "Missing event id." }, { status: 400 });
  }

  const type = typeof event.type === "string" ? event.type : "";
  const store = getStripeEventStore();
  let claim: Awaited<ReturnType<typeof store.claim>>;
  try {
    claim = await store.claim(eventId, type);
  } catch (err) {
    log.error("stripe webhook claim", err, { route: "/api/billing/webhook" });
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
  if (claim === "done") {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (claim === "busy") {
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  const data = asRecord(event.data);
  const object = data ? asRecord(data.object) : null;
  try {
    if (object) await applyStripeEvent(type, object);
  } catch (err) {
    log.error("stripe webhook handler", err, { route: "/api/billing/webhook" });
    try {
      await store.release(eventId);
    } catch (releaseErr) {
      log.error("stripe webhook release", releaseErr, { route: "/api/billing/webhook" });
    }
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  try {
    await store.finish(eventId);
  } catch (err) {
    // Applied already. Do not release, or a retry would apply the event twice.
    log.error("stripe webhook finish", err, { route: "/api/billing/webhook" });
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
