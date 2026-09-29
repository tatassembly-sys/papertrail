import { ObjectId } from "mongodb";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { getDb } from "./mongodb";
import { isValidObjectId } from "./object-id";
import { hashToken, tokenLookupValues } from "./token-hash";
import { entitlementsFor, isProUser, type Entitlements, type PlanName } from "./entitlements";

export { hashToken } from "./token-hash";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;
const MAX_EMAIL_LENGTH = 254;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("timing-pad", 10);

export interface UserDoc {
  _id: ObjectId;
  email: string;
  password_hash: string;
  name: string;
  email_verified: boolean;
  verify_token?: string | null;
  reset_token?: string | null;
  reset_token_expires?: Date | null;
  saved_slugs: string[];
  bookmarks: string[];
  followed_topics: string[];
  reading_history: { slug: string; at: Date }[];
  token_version?: number;
  plan?: PlanName;
  plan_status?: string | null;
  plan_interval?: "month" | "year" | null;
  plan_period_end?: Date | null;
  plan_cancel_at_period_end?: boolean;
  plan_override?: "pro" | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  created_at: Date;
}

export interface UserPublic {
  id: string;
  email: string;
  name: string;
  email_verified: boolean;
  saved_slugs: string[];
  bookmarks: string[];
  followed_topics: string[];
  reading_history: { slug: string; at: string }[];
  plan: PlanName;
  plan_status: string | null;
  plan_interval: "month" | "year" | null;
  plan_period_end: string | null;
  cancel_at_period_end: boolean;
  entitlements: Entitlements;
}

function toPublic(u: UserDoc): UserPublic {
  return {
    id: u._id.toString(),
    email: u.email,
    name: u.name,
    email_verified: u.email_verified,
    saved_slugs: u.saved_slugs || [],
    bookmarks: u.bookmarks || [],
    followed_topics: u.followed_topics || [],
    reading_history: (u.reading_history || []).map((h) => ({
      slug: h.slug,
      at: h.at.toISOString(),
    })),
    plan: isProUser(u) ? "pro" : "free",
    plan_status: u.plan_status || null,
    plan_interval: u.plan_interval || null,
    plan_period_end: u.plan_period_end ? u.plan_period_end.toISOString() : null,
    cancel_at_period_end: Boolean(u.plan_cancel_at_period_end),
    entitlements: entitlementsFor(u),
  };
}

async function users() {
  const db = await getDb();
  return db.collection<UserDoc>("users");
}

export async function findUserByEmail(email: string): Promise<UserDoc | null> {
  const col = await users();
  return col.findOne({ email: email.trim().toLowerCase() });
}

export async function findUserById(id: string): Promise<UserDoc | null> {
  if (!isValidObjectId(id)) return null;
  const col = await users();
  return col.findOne({ _id: new ObjectId(id) });
}

export async function registerUser(
  email: string,
  password: string,
  name: string
): Promise<{ user: UserPublic; verifyToken: string } | { error: string }> {
  const normalized = email.trim().toLowerCase();
  if (
    !normalized.includes("@") ||
    normalized.length > MAX_EMAIL_LENGTH ||
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    return { error: "Valid email and password (8–72 chars) required." };
  }
  const existing = await findUserByEmail(normalized);
  if (existing) {
    // Spend a bcrypt compare so existence isn't obvious from timing.
    try {
      bcrypt.compareSync(password, existing.password_hash);
    } catch {
      /* ignore */
    }
    return { error: "Unable to create that account. Try signing in instead." };
  }

  const verifyToken = randomBytes(24).toString("hex");
  const col = await users();
  const doc: Omit<UserDoc, "_id"> = {
    email: normalized,
    password_hash: bcrypt.hashSync(password, 10),
    name: (name.trim() || normalized.split("@")[0]).slice(0, 80),
    email_verified: false,
    verify_token: hashToken(verifyToken),
    reset_token: null,
    reset_token_expires: null,
    saved_slugs: [],
    bookmarks: [],
    followed_topics: [],
    reading_history: [],
    token_version: 1,
    created_at: new Date(),
  };
  const result = await col.insertOne(doc as UserDoc);
  const user = toPublic({ ...doc, _id: result.insertedId } as UserDoc);
  return { user, verifyToken };
}

export async function verifyUserPassword(
  email: string,
  password: string
): Promise<UserPublic | null> {
  const user = await findUserByEmail(email);
  const hash = user?.password_hash || DUMMY_PASSWORD_HASH;
  try {
    const ok = bcrypt.compareSync(password, hash);
    if (!user || !ok) return null;
    return toPublic(user);
  } catch {
    return null;
  }
}

export async function issueEmailVerifyToken(userId: string): Promise<string | null> {
  const user = await findUserById(userId);
  if (!user || user.email_verified) return null;
  const token = randomBytes(24).toString("hex");
  const col = await users();
  await col.updateOne(
    { _id: user._id },
    { $set: { verify_token: hashToken(token) } }
  );
  return token;
}

export async function verifyEmailToken(token: string): Promise<boolean> {
  const candidates = tokenLookupValues(token);
  if (candidates.length === 0) return false;
  const col = await users();
  const result = await col.updateOne(
    { verify_token: { $in: candidates } },
    { $set: { email_verified: true, verify_token: null } }
  );
  return result.modifiedCount > 0;
}

export async function createPasswordResetToken(
  email: string
): Promise<string | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const token = randomBytes(24).toString("hex");
  const col = await users();
  await col.updateOne(
    { _id: user._id },
    {
      $set: {
        reset_token: hashToken(token),
        reset_token_expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    }
  );
  return token;
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<boolean> {
  const candidates = tokenLookupValues(token);
  if (
    candidates.length === 0 ||
    newPassword.length < MIN_PASSWORD_LENGTH ||
    newPassword.length > MAX_PASSWORD_LENGTH
  ) {
    return false;
  }
  const col = await users();
  const user = await col.findOne({
    reset_token: { $in: candidates },
    reset_token_expires: { $gt: new Date() },
  });
  if (!user) return false;
  const nextVersion = (user.token_version ?? 1) + 1;
  await col.updateOne(
    { _id: user._id },
    {
      $set: {
        password_hash: bcrypt.hashSync(newPassword, 10),
        reset_token: null,
        reset_token_expires: null,
        token_version: nextVersion,
      },
    }
  );
  return true;
}

export async function deleteUserAccount(userId: string): Promise<boolean> {
  if (!isValidObjectId(userId)) return false;
  const col = await users();
  const result = await col.deleteOne({ _id: new ObjectId(userId) });
  return result.deletedCount > 0;
}

export async function bumpTokenVersion(userId: string): Promise<void> {
  if (!isValidObjectId(userId)) return;
  const col = await users();
  const user = await col.findOne({ _id: new ObjectId(userId) }, { projection: { token_version: 1 } });
  if (!user) return;
  await col.updateOne(
    { _id: user._id },
    { $set: { token_version: (user.token_version ?? 1) + 1 } }
  );
}

export async function getUserPublic(id: string): Promise<UserPublic | null> {
  const u = await findUserById(id);
  return u ? toPublic(u) : null;
}

export async function updateUserProfile(
  id: string,
  updates: { name?: string; followed_topics?: string[] }
): Promise<UserPublic | null> {
  if (!isValidObjectId(id)) return null;
  const col = await users();
  const $set: Record<string, unknown> = {};
  if (typeof updates.name === "string") $set.name = updates.name.trim().slice(0, 80);
  if (Array.isArray(updates.followed_topics)) {
    $set.followed_topics = updates.followed_topics
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 30);
  }
  if (!Object.keys($set).length) return getUserPublic(id);
  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set },
    { returnDocument: "after" }
  );
  return result ? toPublic(result) : null;
}

export async function toggleSavedSlug(
  userId: string,
  slug: string,
  field: "saved_slugs" | "bookmarks"
): Promise<UserPublic | null> {
  const user = await findUserById(userId);
  if (!user) return null;
  const list = user[field] || [];
  const has = list.includes(slug);
  const col = await users();
  await col.updateOne(
    { _id: user._id },
    has ? { $pull: { [field]: slug } } : { $addToSet: { [field]: slug } }
  );
  return getUserPublic(userId);
}

export async function recordReading(userId: string, slug: string): Promise<void> {
  if (!isValidObjectId(userId) || !slug) return;
  const col = await users();
  await col.updateOne({ _id: new ObjectId(userId) }, {
    $pull: { reading_history: { slug } },
  } as never);
  await col.updateOne(
    { _id: new ObjectId(userId) },
    {
      $push: {
        reading_history: {
          $each: [{ slug, at: new Date() }],
          $position: 0,
          $slice: 50,
        },
      },
    }
  );
}

export interface BillingState {
  plan: PlanName;
  plan_status: string;
  plan_interval?: "month" | "year" | null;
  plan_period_end?: Date | null;
  plan_cancel_at_period_end?: boolean;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
}

export async function applyBillingState(
  userId: string,
  state: BillingState
): Promise<UserPublic | null> {
  if (!isValidObjectId(userId)) return null;
  const col = await users();
  const $set: Record<string, unknown> = {
    plan: state.plan,
    plan_status: state.plan_status,
  };
  if (state.plan_interval !== undefined) $set.plan_interval = state.plan_interval;
  if (state.plan_period_end !== undefined) $set.plan_period_end = state.plan_period_end;
  if (state.plan_cancel_at_period_end !== undefined) {
    $set.plan_cancel_at_period_end = state.plan_cancel_at_period_end;
  }
  if (state.stripe_customer_id !== undefined) {
    $set.stripe_customer_id = state.stripe_customer_id;
  }
  if (state.stripe_subscription_id !== undefined) {
    $set.stripe_subscription_id = state.stripe_subscription_id;
  }
  const result = await col.findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set },
    { returnDocument: "after" }
  );
  return result ? toPublic(result) : null;
}

export async function findUserByStripeCustomerId(
  customerId: string
): Promise<UserDoc | null> {
  if (!customerId) return null;
  const col = await users();
  return col.findOne({ stripe_customer_id: customerId });
}

export async function setPlanOverride(
  email: string,
  override: "pro" | null
): Promise<UserPublic | null> {
  const col = await users();
  const result = await col.findOneAndUpdate(
    { email: email.trim().toLowerCase() },
    { $set: { plan_override: override } },
    { returnDocument: "after" }
  );
  return result ? toPublic(result) : null;
}

export async function countProUsers(): Promise<number> {
  const col = await users();
  return col.countDocuments({
    $or: [
      { plan: "pro", plan_status: { $in: ["active", "trialing", "past_due"] } },
      { plan_override: "pro" },
    ],
  });
}


