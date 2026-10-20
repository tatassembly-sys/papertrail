import { getDb } from "./mongodb";
import { isValidObjectId } from "./object-id";
import { findUserById, type UserDoc } from "./users";
import type { CollectionDoc } from "./collections";
import type { HighlightDoc } from "./highlights";
import type { ChatMessage, ChatThreadDoc } from "./article-chat";
import type { SubmissionDoc } from "./submissions";
import type { BillingInquiryDoc } from "./billing-inquiries";

export interface NewsletterExportSource {
  email: string;
  status: string;
  created_at?: Date | null;
  verified_at?: Date | null;
  unsubscribed_at?: Date | null;
  consent_at?: Date | null;
  consent_source?: string | null;
}

function iso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : null;
}

/** Shape a reader's own records. Secrets and other people's rows never belong here. */
export function buildUserExport(input: {
  exportedAt: Date;
  user: UserDoc;
  collections: CollectionDoc[];
  highlights: HighlightDoc[];
  chats: ChatThreadDoc[];
  submissions: SubmissionDoc[];
  newsletter: NewsletterExportSource | null;
  billingInquiries: BillingInquiryDoc[];
}) {
  const user = input.user;
  return {
    exported_at: input.exportedAt.toISOString(),
    account: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      email_verified: Boolean(user.email_verified),
      saved_slugs: user.saved_slugs || [],
      bookmarks: user.bookmarks || [],
      followed_topics: user.followed_topics || [],
      reading_history: (user.reading_history || []).map((row) => ({
        slug: row.slug,
        at: row.at instanceof Date ? row.at.toISOString() : String(row.at),
      })),
      plan: user.plan === "pro" ? "pro" : "free",
      plan_status: user.plan_status || null,
      plan_interval: user.plan_interval || null,
      plan_period_end: iso(user.plan_period_end),
      cancel_at_period_end: Boolean(user.plan_cancel_at_period_end),
      plan_override: user.plan_override || null,
      stripe_customer_id: user.stripe_customer_id || null,
      stripe_subscription_id: user.stripe_subscription_id || null,
      created_at: iso(user.created_at),
    },
    collections: input.collections
      .filter((row) => row.user_id === user._id.toString())
      .map((row) => ({
        id: row._id.toString(),
        name: row.name,
        slug: row.slug,
        description: row.description || "",
        slugs: row.slugs || [],
        public: Boolean(row.public),
        created_at: iso(row.created_at),
        updated_at: iso(row.updated_at),
      })),
    highlights: input.highlights
      .filter((row) => row.user_id === user._id.toString())
      .map((row) => ({
        id: row._id.toString(),
        article_slug: row.article_slug,
        quote: row.quote,
        note: row.note || "",
        created_at: iso(row.created_at),
      })),
    chats: input.chats
      .filter((row) => row.user_id === user._id.toString())
      .map((row) => ({
        article_slug: row.article_slug,
        created_at: iso(row.created_at),
        updated_at: iso(row.updated_at),
        messages: (row.messages || []).map((message: ChatMessage) => ({
          role: message.role,
          content: message.content,
          at: iso(message.at),
        })),
      })),
    submissions: input.submissions
      .filter((row) => row.user_id === user._id.toString())
      .map((row) => ({
        id: row._id.toString(),
        url: row.url,
        note: row.note || "",
        status: row.status,
        submitted_at: iso(row.submitted_at),
        priority: Boolean(row.priority),
      })),
    newsletter: input.newsletter
      ? {
          email: input.newsletter.email,
          status: input.newsletter.status,
          created_at: iso(input.newsletter.created_at),
          verified_at: iso(input.newsletter.verified_at),
          unsubscribed_at: iso(input.newsletter.unsubscribed_at),
          consent_at: iso(input.newsletter.consent_at),
          consent_source: input.newsletter.consent_source || null,
        }
      : null,
    billing_inquiries: input.billingInquiries
      .filter((row) => row.email === user.email)
      .map((row) => ({
        id: row._id.toString(),
        name: row.name,
        email: row.email,
        org: row.org,
        seats: row.seats || "",
        note: row.note || "",
        created_at: iso(row.created_at),
      })),
  };
}

export async function exportUserData(userId: string) {
  if (!userId || !isValidObjectId(userId)) return null;
  const user = await findUserById(userId);
  if (!user || user._id.toString() !== userId) return null;

  const db = await getDb();
  const [collections, highlights, chats, submissions, newsletter, billingInquiries] =
    await Promise.all([
      db.collection<CollectionDoc>("collections").find({ user_id: userId }).limit(200).toArray(),
      db.collection<HighlightDoc>("highlights").find({ user_id: userId }).limit(500).toArray(),
      db.collection<ChatThreadDoc>("article_chats").find({ user_id: userId }).limit(200).toArray(),
      db.collection<SubmissionDoc>("submissions").find({ user_id: userId }).limit(200).toArray(),
      db.collection<NewsletterExportSource>("newsletter_subscribers").findOne(
        { email: user.email },
        {
          projection: {
            email: 1,
            status: 1,
            created_at: 1,
            verified_at: 1,
            unsubscribed_at: 1,
            consent_at: 1,
            consent_source: 1,
          },
        }
      ),
      db
        .collection<BillingInquiryDoc>("billing_inquiries")
        .find({ email: user.email })
        .limit(50)
        .toArray(),
    ]);

  return buildUserExport({
    exportedAt: new Date(),
    user,
    collections,
    highlights,
    chats,
    submissions,
    newsletter,
    billingInquiries,
  });
}
