import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST as postCheckout } from "../app/api/billing/checkout/route";
import { POST as postPortal } from "../app/api/billing/portal/route";

test("pricing page shows VAT-inclusive prices and links to terms", () => {
  const page = readFileSync("app/pricing/page.tsx", "utf8");
  assert.match(page, /Prices include VAT/);
  assert.match(page, /valueAddedTaxIncluded: true/);
  assert.match(page, /href="\/terms"/);
  const buttons = readFileSync("components/CheckoutButtons.tsx", "utf8");
  assert.match(buttons, /Stripe is not configured/);
  assert.match(
    buttons,
    /Checkout is not live yet\. The owner still needs to add Stripe keys\./
  );
});

test("checkout and portal return 503 when billing keys are unset", async () => {
  const keys = ["STRIPE_SECRET_KEY", "STRIPE_PRICE_MONTHLY", "STRIPE_PRICE_YEARLY"] as const;
  const saved = new Map<string, string | undefined>();
  for (const key of keys) saved.set(key, process.env[key]);
  for (const key of keys) delete process.env[key];
  try {
    const checkout = await postCheckout(
      new NextRequest("https://example.test/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ interval: "month" }),
      })
    );
    assert.equal(checkout.status, 503);
    const checkoutBody = (await checkout.json()) as { error?: string };
    assert.match(checkoutBody.error || "", /Stripe keys and price IDs are required/);

    const portal = await postPortal(
      new NextRequest("https://example.test/api/billing/portal", { method: "POST" })
    );
    assert.equal(portal.status, 503);
    const portalBody = (await portal.json()) as { error?: string };
    assert.match(portalBody.error || "", /not configured/);
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
