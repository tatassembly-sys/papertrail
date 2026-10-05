import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
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
