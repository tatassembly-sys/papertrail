import type { CreateIndexesOptions, Db, IndexSpecification } from "mongodb";

let indexesReady = false;
let indexesPromise: Promise<void> | null = null;

/**
 * Idempotent index bootstrap so production does not depend on a manual mongosh
 * step for the required text index (homepage/admin search).
 * Failures are logged and do not crash the request path permanently.
 */
export async function ensureIndexes(db: Db): Promise<void> {
  if (indexesReady) return;
  if (indexesPromise) return indexesPromise;

  indexesPromise = createAll(db)
    .then(() => {
      indexesReady = true;
    })
    .catch((err) => {
      console.error("ensureIndexes failed (will retry on next request):", err);
      indexesPromise = null;
    });

  return indexesPromise;
}

const TEXT_INDEX_SPEC: IndexSpecification = {
  title: "text",
  headline: "text",
  plain_explanation: "text",
  caveats: "text",
  authors: "text",
  institutions: "text",
  keywords: "text",
  tags: "text",
};

const TEXT_INDEX_OPTS: CreateIndexesOptions = {
  name: "articles_text_search_v2",
  weights: {
    title: 10,
    headline: 8,
    keywords: 6,
    tags: 6,
    authors: 5,
    institutions: 4,
    plain_explanation: 3,
    caveats: 2,
  },
  default_language: "english",
};

async function createAll(db: Db): Promise<void> {
  const articles = db.collection("articles");

  // Mongo allows only one text index per collection. Recreate when options differ.
  await ensureTextIndex(articles);

  await safeIndex(articles, { slug: 1 }, { unique: true, name: "articles_slug_unique" });
  await safeIndex(articles, { status: 1, created_at: -1 }, { name: "articles_status_created" });
  await safeIndex(articles, { status: 1, published_at: -1 }, { name: "articles_status_published" });
  await safeIndex(articles, { status: 1, category: 1 }, { name: "articles_status_category" });
  await safeIndex(articles, { status: 1, source: 1 }, { name: "articles_status_source" });
  await safeIndex(articles, { source_url: 1 }, { name: "articles_source_url" });
  await ensureSourceUrlUnique(articles);
  await safeIndex(articles, { tags: 1 }, { name: "articles_tags" });
  await safeIndex(articles, { authors: 1 }, { name: "articles_authors" });
  await safeIndex(articles, { status: 1, share_approved: 1 }, { name: "articles_share_approved" });

  const queue = db.collection("fetch_queue");
  await safeIndex(queue, { source: 1, external_id: 1 }, {
    unique: true,
    name: "queue_source_external",
  });
  await safeIndex(queue, { status: 1, created_at: 1 }, { name: "queue_status_created" });

  const scheduled = db.collection("scheduled_posts");
  await safeIndex(scheduled, { status: 1, scheduled_for: 1 }, { name: "scheduled_status_for" });
  await safeIndex(scheduled, { article_id: 1 }, { name: "scheduled_article" });

  const submissions = db.collection("submissions");
  await safeIndex(submissions, { status: 1, submitted_at: -1 }, {
    name: "submissions_status_submitted",
  });
  await safeIndex(submissions, { ip_hash: 1, submitted_at: -1 }, {
    name: "submissions_ip_submitted",
  });

  const loginAttempts = db.collection("login_attempts");
  await safeIndex(loginAttempts, { ip_hash: 1, attempted_at: -1 }, {
    name: "login_ip_attempted",
  });
  await safeIndex(loginAttempts, { attempted_at: 1 }, {
    expireAfterSeconds: 3600,
    name: "login_ttl",
  });

  const rateLimits = db.collection("rate_limits");
  await safeIndex(rateLimits, { bucket: 1, key: 1, window: 1 }, {
    unique: true,
    sparse: true,
    name: "rate_bucket_key_window",
  });
  await safeIndex(rateLimits, { bucket: 1, key: 1, at: -1 }, { name: "rate_bucket_key_at" });
  await ensureRateLimitTtl(rateLimits);

  const users = db.collection("users");
  await safeIndex(users, { email: 1 }, { unique: true, name: "users_email_unique" });
  await safeIndex(users, { verify_token: 1 }, { name: "users_verify_token" });
  await safeIndex(users, { reset_token: 1 }, { name: "users_reset_token" });
  await safeIndex(
    users,
    { stripe_customer_id: 1 },
    { unique: true, sparse: true, name: "users_stripe_customer" }
  );
  await safeIndex(users, { plan: 1, plan_status: 1 }, { name: "users_plan_status" });

  const newsletter = db.collection("newsletter_subscribers");
  await safeIndex(newsletter, { email: 1 }, { unique: true, name: "newsletter_email_unique" });
  await safeIndex(newsletter, { verify_token: 1 }, { name: "newsletter_verify" });
  await safeIndex(newsletter, { unsubscribe_token: 1 }, { name: "newsletter_unsub" });
  await safeIndex(newsletter, { status: 1 }, { name: "newsletter_status" });

  const chats = db.collection("article_chats");
  await safeIndex(
    chats,
    { article_slug: 1, session_key: 1 },
    { unique: true, name: "chat_slug_session" }
  );
  await safeIndex(chats, { updated_at: -1 }, { name: "chat_updated" });

  const runs = db.collection("newsletter_runs");
  await safeIndex(runs, { at: -1 }, { name: "newsletter_runs_at" });

  const mixRuns = db.collection("publish_mix_runs");
  await safeIndex(mixRuns, { dateKey: 1 }, { unique: true, name: "publish_mix_date" });

  const inquiries = db.collection("billing_inquiries");
  await safeIndex(inquiries, { created_at: -1 }, { name: "billing_inquiries_created" });
  await safeIndex(inquiries, { email: 1 }, { name: "billing_inquiries_email" });

  const collections = db.collection("collections");
  await safeIndex(collections, { user_id: 1, updated_at: -1 }, { name: "collections_user_updated" });
  await safeIndex(collections, { public: 1, updated_at: -1 }, { name: "collections_public" });

  const highlights = db.collection("highlights");
  await safeIndex(highlights, { user_id: 1, created_at: -1 }, { name: "highlights_user_created" });
  await safeIndex(highlights, { user_id: 1, article_slug: 1 }, { name: "highlights_user_slug" });
}

async function ensureRateLimitTtl(rateLimits: {
  createIndex: (spec: IndexSpecification, opts?: CreateIndexesOptions) => Promise<string>;
  dropIndex: (name: string) => Promise<unknown>;
}): Promise<void> {
  // Weekly submission windows are 7 days; a 24h TTL let free users reset after one day.
  const opts: CreateIndexesOptions = {
    expireAfterSeconds: 8 * 24 * 60 * 60,
    name: "rate_limits_ttl",
  };
  try {
    await rateLimits.createIndex({ at: 1 }, opts);
    return;
  } catch (err) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code: number }).code
        : 0;
    if (code !== 85 && code !== 86) {
      console.warn("rate_limits ttl index create failed:", err);
      return;
    }
  }
  try {
    await rateLimits.dropIndex("rate_limits_ttl");
  } catch {
    /* not present */
  }
  try {
    await rateLimits.createIndex({ at: 1 }, opts);
  } catch (err) {
    console.error("rate_limits ttl index recreate failed:", err);
  }
}

async function ensureSourceUrlUnique(articles: {
  createIndex: (spec: IndexSpecification, opts?: CreateIndexesOptions) => Promise<string>;
  dropIndex: (name: string) => Promise<unknown>;
}): Promise<void> {
  const opts: CreateIndexesOptions = {
    unique: true,
    name: "articles_source_url_unique",
    // Sparse still indexes explicit null. Only real URLs must be unique.
    partialFilterExpression: { source_url: { $type: "string" } },
  };
  try {
    await articles.createIndex({ source_url: 1 }, opts);
    return;
  } catch (err) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code: number }).code
        : 0;
    if (code !== 85 && code !== 86) {
      console.warn("source_url unique index create failed:", err);
      return;
    }
  }
  try {
    await articles.dropIndex("articles_source_url_unique");
  } catch {
    /* not present */
  }
  try {
    await articles.createIndex({ source_url: 1 }, opts);
  } catch (err) {
    console.error("source_url unique index recreate failed:", err);
  }
}

async function ensureTextIndex(
  articles: {
    createIndex: (spec: IndexSpecification, opts?: CreateIndexesOptions) => Promise<string>;
    dropIndex: (name: string) => Promise<unknown>;
  }
): Promise<void> {
  try {
    await articles.createIndex(TEXT_INDEX_SPEC, TEXT_INDEX_OPTS);
    return;
  } catch (err) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code: number }).code
        : 0;
    // 85 IndexOptionsConflict, 86 IndexKeySpecsConflict
    if (code !== 85 && code !== 86) {
      console.warn("text index create failed:", err);
    }
  }

  for (const name of ["articles_text_search_v2", "articles_text_search", "articles_text"]) {
    try {
      await articles.dropIndex(name);
    } catch {
      /* not present */
    }
  }

  try {
    await articles.createIndex(TEXT_INDEX_SPEC, TEXT_INDEX_OPTS);
  } catch (err) {
    console.error("text index recreate failed:", err);
  }
}

async function safeIndex(
  col: { createIndex: (spec: IndexSpecification, opts?: CreateIndexesOptions) => Promise<string> },
  spec: IndexSpecification,
  opts?: CreateIndexesOptions
): Promise<void> {
  try {
    await col.createIndex(spec, opts);
  } catch (err) {
    const name = opts?.name ?? "unnamed";
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code: number }).code
        : undefined;
    // 85/86 = same name different options; log only
    if (code === 85 || code === 86) {
      console.warn(`createIndex options conflict for ${name} (ok if already present)`);
      return;
    }
    console.error(`createIndex failed for ${name}:`, err);
  }
}
