export const FREE_CHAT_PER_DAY = 5;
export const FREE_SAVES = 20;
export const FREE_BOOKMARKS = 20;
export const FREE_TOPICS = 8;
export const FREE_SUBMISSIONS_PER_WEEK = 3;
export const PRO_SUBMISSIONS_PER_DAY = 20;
export const FREE_COLLECTIONS = 1;
export const FREE_HIGHLIGHTS = 15;
export const CHAT_ABUSE_PER_HOUR = 40;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;
export const HOUR_MS = 60 * 60 * 1000;

export const PLAN_COPY = {
  monthly: { amount: 8, currency: "GBP", interval: "month" as const, label: "£8" },
  yearly: { amount: 72, currency: "GBP", interval: "year" as const, label: "£72" },
};

export const LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export type PlanName = "free" | "pro";

export interface PlanUser {
  email?: string;
  plan?: PlanName;
  plan_status?: string | null;
  plan_override?: "pro" | null;
}

export interface Entitlements {
  plan: PlanName;
  chatPerDay: number | null;
  saves: number | null;
  bookmarks: number | null;
  topics: number | null;
  submissionsPerWeek: number | null;
  export: boolean;
  prioritySubmit: boolean;
  collections: number | null;
  highlights: number | null;
}

export function grantedProEmails(): Set<string> {
  const raw = process.env.BILLING_GRANT_EMAILS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isProUser(user: PlanUser | null | undefined): boolean {
  if (!user) return false;
  if (user.plan_override === "pro") return true;
  if (user.email && grantedProEmails().has(user.email.trim().toLowerCase())) {
    return true;
  }
  if (user.plan !== "pro") return false;
  return LIVE_STATUSES.has(user.plan_status || "");
}

export function entitlementsFor(user: PlanUser | null | undefined): Entitlements {
  if (isProUser(user)) {
    return {
      plan: "pro",
      chatPerDay: null,
      saves: null,
      bookmarks: null,
      topics: null,
      submissionsPerWeek: null,
      export: true,
      prioritySubmit: true,
      collections: null,
      highlights: null,
    };
  }
  return {
    plan: "free",
    chatPerDay: FREE_CHAT_PER_DAY,
    saves: FREE_SAVES,
    bookmarks: FREE_BOOKMARKS,
    topics: FREE_TOPICS,
    submissionsPerWeek: FREE_SUBMISSIONS_PER_WEEK,
    export: false,
    prioritySubmit: false,
    collections: FREE_COLLECTIONS,
    highlights: FREE_HIGHLIGHTS,
  };
}

export function billingPublicConfig() {
  return {
    configured: isBillingConfigured(),
    currency: PLAN_COPY.monthly.currency,
    monthly: {
      label: process.env.BILLING_MONTHLY_LABEL?.trim() || PLAN_COPY.monthly.label,
      amount: PLAN_COPY.monthly.amount,
      interval: PLAN_COPY.monthly.interval,
    },
    yearly: {
      label: process.env.BILLING_YEARLY_LABEL?.trim() || PLAN_COPY.yearly.label,
      amount: PLAN_COPY.yearly.amount,
      interval: PLAN_COPY.yearly.interval,
    },
  };
}

export function isBillingConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.STRIPE_PRICE_MONTHLY?.trim() &&
      process.env.STRIPE_PRICE_YEARLY?.trim()
  );
}

export function stripeWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
}
