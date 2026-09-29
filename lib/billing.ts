import {
  applyBillingState,
  findUserById,
  findUserByStripeCustomerId,
} from "./users";
import {
  normalizeSubscription,
  retrieveSubscription,
  type NormalizedSubscription,
} from "./stripe";

const LIVE = new Set(["active", "trialing", "past_due"]);

export async function syncNormalizedSubscription(
  userId: string,
  sub: NormalizedSubscription
) {
  const live = LIVE.has(sub.status);
  return applyBillingState(userId, {
    plan: live ? "pro" : "free",
    plan_status: sub.status,
    plan_interval: sub.interval,
    plan_period_end: sub.periodEnd,
    plan_cancel_at_period_end: sub.cancelAtPeriodEnd,
    stripe_customer_id: sub.customerId || undefined,
    stripe_subscription_id: sub.id || null,
  });
}

export async function syncStripeSubscriptionId(userId: string, subscriptionId: string) {
  const raw = await retrieveSubscription(subscriptionId);
  return syncNormalizedSubscription(userId, normalizeSubscription(raw));
}

export async function resolveUserIdFromStripe(opts: {
  userId?: string | null;
  customerId?: string | null;
}): Promise<string | null> {
  if (opts.userId) {
    const user = await findUserById(opts.userId);
    if (user) return user._id.toString();
  }
  if (opts.customerId) {
    const user = await findUserByStripeCustomerId(opts.customerId);
    if (user) return user._id.toString();
  }
  return null;
}
