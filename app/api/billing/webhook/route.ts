import { NextRequest, NextResponse } from "next/server";
import { stripeWebhookConfigured } from "@/lib/entitlements";
import { normalizeSubscription, retrieveSubscription, verifyStripeSignature } from "@/lib/stripe";
import { asRecord } from "@/lib/json-body";
import {
  resolveUserIdFromStripe,
  syncNormalizedSubscription,
  syncStripeSubscriptionId,
} from "@/lib/billing";
import { applyBillingState } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stripeId(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id: unknown }).id;
    if (typeof id === "string" && id) return id;
  }
  return null;
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

  const type = typeof event.type === "string" ? event.type : "";
  const data = asRecord(event.data);
  const object = data ? asRecord(data.object) : null;
  if (!object) {
    return NextResponse.json({ received: true });
  }

  try {
    if (type === "checkout.session.completed") {
      const userIdMeta =
        (asRecord(object.metadata)?.userId as string | undefined) ||
        (typeof object.client_reference_id === "string"
          ? object.client_reference_id
          : null);
      const customerId = stripeId(object.customer);
      const subscriptionId = stripeId(object.subscription);
      const userId = await resolveUserIdFromStripe({
        userId: userIdMeta,
        customerId,
      });
      if (userId && subscriptionId) {
        await syncStripeSubscriptionId(userId, subscriptionId);
      } else if (userId && customerId) {
        await applyBillingState(userId, {
          plan: "pro",
          plan_status: "active",
          stripe_customer_id: customerId,
        });
      }
    } else if (
      type === "customer.subscription.created" ||
      type === "customer.subscription.updated" ||
      type === "customer.subscription.deleted"
    ) {
      const sub = normalizeSubscription(object);
      const metaUser =
        (asRecord(object.metadata)?.userId as string | undefined) || null;
      const userId = await resolveUserIdFromStripe({
        userId: metaUser,
        customerId: sub.customerId,
      });
      if (userId) {
        await syncNormalizedSubscription(userId, sub);
      }
    } else if (type === "invoice.paid" || type === "invoice.payment_failed") {
      const subscriptionId = stripeId(object.subscription);
      const customerId = stripeId(object.customer);
      const userId = await resolveUserIdFromStripe({ customerId });
      if (userId && subscriptionId) {
        const rawSub = await retrieveSubscription(subscriptionId);
        await syncNormalizedSubscription(userId, normalizeSubscription(rawSub));
      }
    }
  } catch (err) {
    console.error("stripe webhook handler:", err);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
