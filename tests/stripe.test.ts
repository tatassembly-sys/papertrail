import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { POST as postWebhook } from "../app/api/billing/webhook/route";
import { isBillingConfigured } from "../lib/entitlements";
import {
  invoiceSubscriptionId,
  normalizeSubscription,
  verifyStripeSignature,
} from "../lib/stripe";

test("normalizeSubscription reads legacy top-level current_period_end", () => {
  const sub = normalizeSubscription({
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    current_period_end: 1_800_000_000,
    cancel_at_period_end: false,
    items: { data: [{ price: { recurring: { interval: "month" } } }] },
  });
  assert.equal(sub.id, "sub_1");
  assert.equal(sub.customerId, "cus_1");
  assert.equal(sub.interval, "month");
  assert.equal(sub.periodEnd?.getTime(), 1_800_000_000 * 1000);
});

test("normalizeSubscription reads item-level current_period_end (API 2025-03-31+)", () => {
  const sub = normalizeSubscription({
    id: "sub_2",
    customer: { id: "cus_2" },
    status: "trialing",
    cancel_at_period_end: true,
    items: {
      data: [
        { current_period_end: 1_800_000_000, price: { recurring: { interval: "year" } } },
        { current_period_end: 1_800_000_500 },
      ],
    },
  });
  assert.equal(sub.customerId, "cus_2");
  assert.equal(sub.interval, "year");
  assert.equal(sub.cancelAtPeriodEnd, true);
  assert.equal(sub.periodEnd?.getTime(), 1_800_000_500 * 1000);
});

test("normalizeSubscription tolerates missing fields", () => {
  const sub = normalizeSubscription({});
  assert.equal(sub.status, "canceled");
  assert.equal(sub.periodEnd, null);
  assert.equal(sub.interval, null);
});

test("invoiceSubscriptionId handles legacy and parent.subscription_details shapes", () => {
  assert.equal(invoiceSubscriptionId({ subscription: "sub_legacy" }), "sub_legacy");
  assert.equal(invoiceSubscriptionId({ subscription: { id: "sub_obj" } }), "sub_obj");
  assert.equal(
    invoiceSubscriptionId({
      subscription: null,
      parent: { type: "subscription_details", subscription_details: { subscription: "sub_new" } },
    }),
    "sub_new"
  );
  assert.equal(invoiceSubscriptionId({ parent: null }), null);
  assert.equal(invoiceSubscriptionId({}), null);
});

function sign(payload: string, secret: string, ts = Math.floor(Date.now() / 1000)) {
  const sig = createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex");
  return `t=${ts},v1=${sig}`;
}

test("verifyStripeSignature accepts a fresh valid signature", () => {
  const payload = JSON.stringify({ id: "evt_1" });
  assert.equal(verifyStripeSignature(payload, sign(payload, "whsec_x"), "whsec_x"), true);
});

test("verifyStripeSignature rejects wrong secret, tampered body, stale timestamp", () => {
  const payload = JSON.stringify({ id: "evt_1" });
  assert.equal(verifyStripeSignature(payload, sign(payload, "whsec_x"), "whsec_y"), false);
  assert.equal(verifyStripeSignature(payload + " ", sign(payload, "whsec_x"), "whsec_x"), false);
  const stale = Math.floor(Date.now() / 1000) - 3600;
  assert.equal(verifyStripeSignature(payload, sign(payload, "whsec_x", stale), "whsec_x"), false);
  assert.equal(verifyStripeSignature(payload, null, "whsec_x"), false);
});

// Not a stored user, so the handler returns before Mongo or the Stripe API.
const UNKNOWN_USER = "not-a-user";
const WEBHOOK_SECRET = "whsec_x";

function subscriptionEvent(opts: {
  id: string;
  type: string;
  created: number;
  subscriptionId: string;
  status: string;
}) {
  return JSON.stringify({
    id: opts.id,
    object: "event",
    type: opts.type,
    created: opts.created,
    data: {
      object: {
        id: opts.subscriptionId,
        object: "subscription",
        status: opts.status,
        cancel_at_period_end: false,
        metadata: { userId: UNKNOWN_USER },
        items: { data: [{ price: { recurring: { interval: "month" } } }] },
      },
    },
  });
}

function leadingBogusV1(header: string) {
  const comma = header.indexOf(",");
  const sig = header.slice(header.indexOf("v1=") + 3);
  return `${header.slice(0, comma)},v1=${"0".repeat(sig.length)},v1=${sig}`;
}

function duplicateV1(header: string) {
  return `${header},${header.slice(header.indexOf("v1="))}`;
}

async function postSigned(payload: string, header: string) {
  const res = await postWebhook(
    new NextRequest("https://example.test/api/billing/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": header,
      },
      body: payload,
    })
  );
  return { status: res.status, body: await res.json() };
}

test("duplicate and out-of-order webhooks verify without live Stripe keys", async () => {
  const billingBefore = isBillingConfigured();
  const keyBefore = process.env.STRIPE_SECRET_KEY;
  const monthBefore = process.env.STRIPE_PRICE_MONTHLY;
  const yearBefore = process.env.STRIPE_PRICE_YEARLY;
  const secretBefore = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  try {
    const active = subscriptionEvent({
      id: "evt_dup",
      type: "customer.subscription.updated",
      created: 1_700_000_200,
      subscriptionId: "sub_live",
      status: "active",
    });
    const header = sign(active, WEBHOOK_SECRET);
    const replayHeader = duplicateV1(header);
    assert.equal(verifyStripeSignature(active, header, WEBHOOK_SECRET), true);
    assert.equal(verifyStripeSignature(active, header, WEBHOOK_SECRET), true);
    assert.equal(verifyStripeSignature(active, replayHeader, WEBHOOK_SECRET), true);

    const first = await postSigned(active, header);
    const second = await postSigned(active, header);
    assert.equal(first.status, 200);
    assert.deepEqual(first.body, { received: true });
    assert.deepEqual(second, first);
    const replayed = await postSigned(active, replayHeader);
    assert.deepEqual(replayed, first);

    const staleCancel = subscriptionEvent({
      id: "evt_old",
      type: "customer.subscription.deleted",
      created: 1_700_000_000,
      subscriptionId: "sub_old",
      status: "canceled",
    });
    const staleHeader = sign(staleCancel, WEBHOOK_SECRET);
    assert.equal(verifyStripeSignature(staleCancel, staleHeader, WEBHOOK_SECRET), true);
    assert.ok(JSON.parse(staleCancel).created < JSON.parse(active).created);

    const newerFirst = await postSigned(active, header);
    const olderAfter = await postSigned(staleCancel, staleHeader);
    const olderFirst = await postSigned(staleCancel, staleHeader);
    const newerAfter = await postSigned(active, header);
    assert.deepEqual(newerFirst, first);
    assert.deepEqual(olderAfter, first);
    assert.deepEqual(olderFirst, first);
    assert.deepEqual(newerAfter, first);

    const disordered = leadingBogusV1(header);
    assert.equal(verifyStripeSignature(active, disordered, WEBHOOK_SECRET), true);
    const rotated = await postSigned(active, disordered);
    assert.deepEqual(rotated, first);
  } finally {
    if (secretBefore === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = secretBefore;
  }
  assert.equal(process.env.STRIPE_SECRET_KEY, keyBefore);
  assert.equal(process.env.STRIPE_PRICE_MONTHLY, monthBefore);
  assert.equal(process.env.STRIPE_PRICE_YEARLY, yearBefore);
  assert.equal(isBillingConfigured(), billingBefore);
});
