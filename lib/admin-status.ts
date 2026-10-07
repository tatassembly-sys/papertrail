import { getDb } from "@/lib/mongodb";
import { isEmailConfigured } from "@/lib/mail";
import { getSiteUrl } from "@/lib/site-url";
import { probeOpenRouterKey } from "@/lib/openrouter-health";
import { isBillingConfigured } from "@/lib/entitlements";
import { countProUsers } from "@/lib/users";
import { countBillingInquiries } from "@/lib/billing-inquiries";
import { formatQueueLastError } from "@/lib/queue-last-error";

export interface AdminOpsStatus {
  siteUrl: string;
  email: { configured: boolean; mode: "resend" | "log" };
  openrouter: Awaited<ReturnType<typeof probeOpenRouterKey>>;
  articles: { drafts: number; published: number };
  queue: {
    pending: number;
    processing: number;
    error: number;
    done: number;
    /** Latest stored fetch_queue error_message, or null. */
    lastError: string | null;
  };
  newsletter: {
    active: number;
    pending: number;
    lastRun: {
      at?: unknown;
      sent?: unknown;
      failed?: unknown;
      mode?: unknown;
      articleCount?: unknown;
    } | null;
  };
  submissionsPending: number;
  scheduledPending: number;
  lastMix: { at?: unknown; published?: unknown; dateKey?: unknown } | null;
  billing: { configured: boolean; mode: "stripe" | "off"; proUsers: number; inquiries: number };
  blockers: string[];
}

export async function getAdminOpsStatus(): Promise<AdminOpsStatus> {
  const db = await getDb();

  const [
    drafts,
    published,
    queuePending,
    queueProcessing,
    queueError,
    queueDone,
    subsActive,
    subsPending,
    submissionsPending,
    scheduledPending,
    lastDigest,
    lastMix,
    openrouter,
    proUsers,
    inquiries,
    lastQueueError,
  ] = await Promise.all([
    db.collection("articles").countDocuments({ status: "draft" }),
    db.collection("articles").countDocuments({ status: "published" }),
    db.collection("fetch_queue").countDocuments({ status: "pending" }),
    db.collection("fetch_queue").countDocuments({ status: "processing" }),
    db.collection("fetch_queue").countDocuments({ status: "error" }),
    db.collection("fetch_queue").countDocuments({ status: "done" }),
    db.collection("newsletter_subscribers").countDocuments({ status: "active" }),
    db.collection("newsletter_subscribers").countDocuments({ status: "pending" }),
    db.collection("submissions").countDocuments({ status: "pending" }),
    db.collection("scheduled_posts").countDocuments({ status: "pending" }),
    db.collection("newsletter_runs").find().sort({ at: -1 }).limit(1).next(),
    db.collection("publish_mix_runs").find().sort({ at: -1 }).limit(1).next(),
    probeOpenRouterKey(),
    countProUsers(),
    countBillingInquiries(),
    db
      .collection("fetch_queue")
      .find(
        { status: "error", error_message: { $type: "string", $gt: "" } },
        { projection: { error_message: 1, source: 1, external_id: 1, attempts: 1, status: 1 } }
      )
      .sort({ created_at: -1 })
      .limit(1)
      .next(),
  ]);

  const emailConfigured = isEmailConfigured();
  const blockers = [
    !openrouter.ok
      ? `${openrouter.message} Drafts and chat fall back to source text (and xAI if XAI_API_KEY is set).`
      : null,
    !emailConfigured
      ? "Email is log-mode only (set RESEND_API_KEY for real delivery)."
      : null,
    !isBillingConfigured()
      ? "Stripe billing is off (set STRIPE_SECRET_KEY and price IDs to take payments)."
      : null,
  ].filter((item): item is string => Boolean(item));

  return {
    siteUrl: getSiteUrl(),
    email: {
      configured: emailConfigured,
      mode: emailConfigured ? "resend" : "log",
    },
    openrouter,
    articles: { drafts, published },
    queue: {
      pending: queuePending,
      processing: queueProcessing,
      error: queueError,
      done: queueDone,
      lastError: formatQueueLastError(lastQueueError),
    },
    newsletter: {
      active: subsActive,
      pending: subsPending,
      lastRun: lastDigest
        ? {
            at: lastDigest.at,
            sent: lastDigest.sent,
            failed: lastDigest.failed,
            mode: lastDigest.mode,
            articleCount: lastDigest.articleCount,
          }
        : null,
    },
    submissionsPending,
    scheduledPending,
    lastMix: lastMix
      ? { at: lastMix.at, published: lastMix.published, dateKey: lastMix.dateKey }
      : null,
    billing: {
      configured: isBillingConfigured(),
      mode: isBillingConfigured() ? "stripe" : "off",
      proUsers,
      inquiries,
    },
    blockers,
  };
}
