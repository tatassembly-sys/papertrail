import { getDb } from "./mongodb";

export type StripeEventClaim = "new" | "done" | "busy";

export interface StripeEventDoc {
  _id: string;
  type: string;
  status: "processing" | "done";
  processed_at: Date;
}

/**
 * Narrow collection surface so unit tests can persist event ids without Mongo.
 * Production passes the native driver collection.
 */
export interface StripeEventCollection {
  insertOne(doc: StripeEventDoc): Promise<unknown>;
  findOne(filter: { _id: string }): Promise<StripeEventDoc | null>;
  updateOne(
    filter: { _id: string },
    update: { $set: Pick<StripeEventDoc, "status" | "processed_at"> }
  ): Promise<unknown>;
  deleteOne(filter: { _id: string; status: "processing" }): Promise<unknown>;
}

export interface StripeEventStore {
  /** `new` means this caller must apply the event. `done` means it already did. */
  claim(eventId: string, type: string): Promise<StripeEventClaim>;
  finish(eventId: string): Promise<void>;
  /** Drop an in-progress claim so a failed handler can be retried. */
  release(eventId: string): Promise<void>;
}

let storeOverride: StripeEventStore | null = null;

/** Unit tests inject a store. Production uses `stripe_events` in Mongo. */
export function setStripeEventStoreForTests(store: StripeEventStore | null): void {
  storeOverride = store;
}

export function getStripeEventStore(): StripeEventStore {
  return storeOverride ?? mongoStripeEventStore;
}

function isDuplicateKey(err: unknown): boolean {
  if (typeof err !== "object" || err === null || !("code" in err)) return false;
  const code = (err as { code: unknown }).code;
  return code === 11000 || code === 11001;
}

export function createStripeEventStore(col: StripeEventCollection): StripeEventStore {
  return {
    async claim(eventId, type) {
      try {
        await col.insertOne({
          _id: eventId,
          type,
          status: "processing",
          processed_at: new Date(),
        });
        return "new";
      } catch (err) {
        if (!isDuplicateKey(err)) throw err;
      }
      const existing = await col.findOne({ _id: eventId });
      if (existing?.status === "done") return "done";
      return "busy";
    },
    async finish(eventId) {
      await col.updateOne(
        { _id: eventId },
        { $set: { status: "done", processed_at: new Date() } }
      );
    },
    async release(eventId) {
      await col.deleteOne({ _id: eventId, status: "processing" });
    },
  };
}

async function collection(): Promise<StripeEventCollection> {
  const db = await getDb();
  const col = db.collection<StripeEventDoc>("stripe_events");
  return {
    insertOne: (doc) => col.insertOne(doc),
    findOne: async (filter) => (await col.findOne(filter)) ?? null,
    updateOne: (filter, update) => col.updateOne(filter, update),
    deleteOne: (filter) => col.deleteOne(filter),
  };
}

const mongoStripeEventStore: StripeEventStore = {
  async claim(eventId, type) {
    return createStripeEventStore(await collection()).claim(eventId, type);
  },
  async finish(eventId) {
    return createStripeEventStore(await collection()).finish(eventId);
  },
  async release(eventId) {
    return createStripeEventStore(await collection()).release(eventId);
  },
};
