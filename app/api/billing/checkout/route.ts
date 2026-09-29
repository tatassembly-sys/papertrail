import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/user-auth";
import { findUserById } from "@/lib/users";
import { isBillingConfigured, isProUser } from "@/lib/entitlements";
import { createCheckoutSession, StripeConfigError } from "@/lib/stripe";
import { JSON_LIMIT_DEFAULT, asRecord, readJsonBody } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isBillingConfigured()) {
    return NextResponse.json(
      { error: "Checkout is not live yet. Stripe keys and price IDs are required." },
      { status: 503 }
    );
  }

  const session = await getCurrentUserSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sign in to subscribe.", login: "/user-login?next=/pricing" },
      { status: 401 }
    );
  }

  const user = await findUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  if (isProUser(user) && user.stripe_subscription_id && user.plan_status === "active") {
    return NextResponse.json(
      { error: "You already have Pro. Manage it from your account." },
      { status: 409 }
    );
  }

  const parsed = await readJsonBody(req, JSON_LIMIT_DEFAULT);
  if (!parsed.ok) return parsed.response;
  const body = asRecord(parsed.value) || {};
  const interval = body.interval === "year" ? "year" : "month";

  try {
    const checkout = await createCheckoutSession({
      userId: session.userId,
      email: user.email,
      interval,
      customerId: user.stripe_customer_id,
    });
    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    if (err instanceof StripeConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("checkout error:", err);
    return NextResponse.json(
      { error: "Could not start checkout. Try again shortly." },
      { status: 502 }
    );
  }
}
