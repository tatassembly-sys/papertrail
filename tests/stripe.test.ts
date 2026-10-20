import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { POST as postWebhook } from "../app/api/billing/webhook/route";
import { setBillingEffectsForTests } from "../lib/billing";
import { isBillingConfigured } from "../lib/entitlements";
import {
  createStripeEventStore,
  setStripeEventStoreForTests,
  type StripeEventCollection,
  type StripeEventDoc,
} from "../lib/stripe-events";
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

function duplicateKeyError(): Error {
  const err = new Error("E11000 duplicate key");
  return Object.assign(err, { code: 11000 });
}

function fakeStripeEvents(): { docs: Map<string, StripeEventDoc>; col: StripeEventCollection } {
  const docs = new Map<string, StripeEventDoc>();
  const col: StripeEventCollection = {
    async insertOne(doc) {
      if (docs.has(doc._id)) throw duplicateKeyError();
      docs.set(doc._id, { ...doc });
    },
    async findOne(filter) {
      const doc = docs.get(filter._id);
      return doc ? { ...doc } : null;
    },
    async updateOne(filter, update) {
      const doc = docs.get(filter._id);
      if (doc) docs.set(filter._id, { ...doc, ...update.$set });
    },
    async deleteOne(filter) {
      const doc = docs.get(filter._id);
      if (doc?.status === filter.status) docs.delete(filter._id);
    },
  };
  return { docs, col };
}

test("stripe event store records an id once and keeps a failed claim retryable", async () => {
  const { docs, col } = fakeStripeEvents();
  const store = createStripeEventStore(col);
  assert.equal(await store.claim("evt_1", "invoice.payment_failed"), "new");
  assert.equal(docs.get("evt_1")?.status, "processing");
  assert.equal(await store.claim("evt_1", "invoice.payment_failed"), "busy");
  await store.finish("evt_1");
  assert.equal(docs.get("evt_1")?.status, "done");
  assert.equal(await store.claim("evt_1", "invoice.payment_failed"), "done");
  await store.release("evt_1");
  assert.equal(docs.has("evt_1"), true);

  assert.equal(await store.claim("evt_2", "customer.subscription.deleted"), "new");
  await store.release("evt_2");
  assert.equal(docs.has("evt_2"), false);
  assert.equal(await store.claim("evt_2", "customer.subscription.deleted"), "new");
});

function checkoutEvent(id: string) {
  return JSON.stringify({
    id,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test",
        object: "checkout.session",
        client_reference_id: "user_test",
        customer: "cus_test",
        subscription: "sub_checkout",
        metadata: { userId: "user_test" },
      },
    },
  });
}

function invoiceFailedEvent(id: string) {
  return JSON.stringify({
    id,
    object: "event",
    type: "invoice.payment_failed",
    data: {
      object: {
        id: "in_test",
        object: "invoice",
        customer: "cus_test",
        subscription: "sub_invoice",
      },
    },
  });
}

describe("stripe webhook route", { concurrency: 1 }, () => {
  test("duplicate and out-of-order webhooks verify without live Stripe keys", async () => {
    const billingBefore = isBillingConfigured();
    const keyBefore = process.env.STRIPE_SECRET_KEY;
    const monthBefore = process.env.STRIPE_PRICE_MONTHLY;
    const yearBefore = process.env.STRIPE_PRICE_YEARLY;
    const secretBefore = process.env.STRIPE_WEBHOOK_SECRET;
    const { col } = fakeStripeEvents();
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    setStripeEventStoreForTests(createStripeEventStore(col));
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
      assert.equal(second.status, 200);
      assert.deepEqual(second.body, { received: true, duplicate: true });
      const replayed = await postSigned(active, replayHeader);
      assert.deepEqual(replayed, second);

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
      const olderAgain = await postSigned(staleCancel, staleHeader);
      const newerAfter = await postSigned(active, header);
      assert.deepEqual(newerFirst.body, { received: true, duplicate: true });
      assert.deepEqual(olderAfter.body, { received: true });
      assert.deepEqual(olderAgain.body, { received: true, duplicate: true });
      assert.deepEqual(newerAfter.body, { received: true, duplicate: true });

      const disordered = leadingBogusV1(header);
      assert.equal(verifyStripeSignature(active, disordered, WEBHOOK_SECRET), true);
      const rotated = await postSigned(active, disordered);
      assert.deepEqual(rotated.body, { received: true, duplicate: true });
    } finally {
      setStripeEventStoreForTests(null);
      if (secretBefore === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = secretBefore;
    }
    assert.equal(process.env.STRIPE_SECRET_KEY, keyBefore);
    assert.equal(process.env.STRIPE_PRICE_MONTHLY, monthBefore);
    assert.equal(process.env.STRIPE_PRICE_YEARLY, yearBefore);
    assert.equal(isBillingConfigured(), billingBefore);
  });

  test("webhook returns 503 when the signing secret is unset", async () => {
    const secretBefore = process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    try {
      const payload = checkoutEvent("evt_off");
      const res = await postSigned(payload, sign(payload, WEBHOOK_SECRET));
      assert.equal(res.status, 503);
      assert.match(String(res.body.error), /not configured/i);
    } finally {
      if (secretBefore === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = secretBefore;
    }
  });

  test("webhook rejects a bad signature and does not record the event", async () => {
    const secretBefore = process.env.STRIPE_WEBHOOK_SECRET;
    const { docs, col } = fakeStripeEvents();
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    setStripeEventStoreForTests(createStripeEventStore(col));
    const applied: string[] = [];
    setBillingEffectsForTests({
      syncNormalizedSubscription: async () => {
        applied.push("sync");
        return null;
      },
    });
    try {
      const payload = subscriptionEvent({
        id: "evt_bad_sig",
        type: "customer.subscription.updated",
        created: 1_700_000_300,
        subscriptionId: "sub_bad",
        status: "active",
      });
      const bad = await postSigned(payload, sign(payload, "whsec_other"));
      assert.equal(bad.status, 400);
      assert.equal(docs.size, 0);
      assert.deepEqual(applied, []);

      const good = await postSigned(payload, sign(payload, WEBHOOK_SECRET));
      assert.equal(good.status, 200);
      assert.deepEqual(good.body, { received: true });
      assert.equal(docs.size, 1);
    } finally {
      setBillingEffectsForTests(null);
      setStripeEventStoreForTests(null);
      if (secretBefore === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = secretBefore;
    }
  });

  test("webhook applies each billing event once and ignores a duplicate id", async () => {
    const secretBefore = process.env.STRIPE_WEBHOOK_SECRET;
    const { col } = fakeStripeEvents();
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    setStripeEventStoreForTests(createStripeEventStore(col));
    const applied: string[] = [];
    setBillingEffectsForTests({
      resolveUserIdFromStripe: async () => "user_test",
      syncStripeSubscriptionId: async (_userId, subscriptionId) => {
        applied.push(`checkout:${subscriptionId}`);
        return null;
      },
      syncNormalizedSubscription: async (_userId, sub) => {
        applied.push(`sub:${sub.id}:${sub.status}`);
        return null;
      },
      retrieveSubscription: async (subscriptionId) =>
        ({
          id: subscriptionId,
          customer: "cus_test",
          status: "past_due",
          cancel_at_period_end: false,
          items: { data: [{ price: { recurring: { interval: "month" } } }] },
        }) as Record<string, unknown>,
    });
    try {
      const events = [
        checkoutEvent("evt_checkout"),
        subscriptionEvent({
          id: "evt_updated",
          type: "customer.subscription.updated",
          created: 1_700_000_400,
          subscriptionId: "sub_updated",
          status: "active",
        }),
        subscriptionEvent({
          id: "evt_deleted",
          type: "customer.subscription.deleted",
          created: 1_700_000_500,
          subscriptionId: "sub_deleted",
          status: "canceled",
        }),
        invoiceFailedEvent("evt_invoice"),
      ];
      for (const payload of events) {
        const res = await postSigned(payload, sign(payload, WEBHOOK_SECRET));
        assert.equal(res.status, 200);
        assert.deepEqual(res.body, { received: true });
      }
      assert.deepEqual(applied, [
        "checkout:sub_checkout",
        "sub:sub_updated:active",
        "sub:sub_deleted:canceled",
        "sub:sub_invoice:past_due",
      ]);

      const duplicate = events[1];
      const again = await postSigned(duplicate, sign(duplicate, WEBHOOK_SECRET));
      assert.equal(again.status, 200);
      assert.deepEqual(again.body, { received: true, duplicate: true });
      assert.equal(applied.length, 4);
    } finally {
      setBillingEffectsForTests(null);
      setStripeEventStoreForTests(null);
      if (secretBefore === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = secretBefore;
    }
  });

  test("webhook releases a failed event so a retry can apply once", async () => {
    const secretBefore = process.env.STRIPE_WEBHOOK_SECRET;
    const { docs, col } = fakeStripeEvents();
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    setStripeEventStoreForTests(createStripeEventStore(col));
    let fail = true;
    const applied: string[] = [];
    setBillingEffectsForTests({
      resolveUserIdFromStripe: async () => "user_test",
      syncNormalizedSubscription: async () => {
        if (fail) {
          fail = false;
          throw new Error("transient");
        }
        applied.push("synced");
        return null;
      },
    });
    try {
      const payload = subscriptionEvent({
        id: "evt_retry",
        type: "customer.subscription.updated",
        created: 1_700_000_600,
        subscriptionId: "sub_retry",
        status: "active",
      });
      const header = sign(payload, WEBHOOK_SECRET);
      const first = await postSigned(payload, header);
      assert.equal(first.status, 500);
      assert.equal(docs.has("evt_retry"), false);
      const second = await postSigned(payload, header);
      assert.equal(second.status, 200);
      assert.deepEqual(second.body, { received: true });
      assert.deepEqual(applied, ["synced"]);
      const third = await postSigned(payload, header);
      assert.deepEqual(third.body, { received: true, duplicate: true });
      assert.deepEqual(applied, ["synced"]);
    } finally {
      setBillingEffectsForTests(null);
      setStripeEventStoreForTests(null);
      if (secretBefore === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = secretBefore;
    }
  });
});
