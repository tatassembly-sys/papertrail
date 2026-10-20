import { NextRequest, NextResponse } from "next/server";
import { tooManyPublicWrites } from "@/lib/rate-limit";
import { getCurrentUserSession } from "@/lib/user-auth";
import { findUserById } from "@/lib/users";
import { isBillingConfigured } from "@/lib/entitlements";
import { createPortalSession, StripeConfigError } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const limited = await tooManyPublicWrites(req, "billing_portal", 10, 60 * 60 * 1000);
  if (limited) return limited;
  if (!isBillingConfigured()) {
    return NextResponse.json(
      { error: "Billing portal is not configured." },
      { status: 503 }
    );
  }

  const session = await getCurrentUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await findUserById(session.userId);
  if (!user?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing customer on this account yet." },
      { status: 404 }
    );
  }

  try {
    const url = await createPortalSession(user.stripe_customer_id);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof StripeConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("portal error:", err);
    return NextResponse.json(
      { error: "Could not open billing portal." },
      { status: 502 }
    );
  }
}
