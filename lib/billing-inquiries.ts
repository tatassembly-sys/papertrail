import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";

export interface BillingInquiryDoc {
  _id: ObjectId;
  name: string;
  email: string;
  org: string;
  seats?: string;
  note?: string;
  created_at: Date;
}

export interface BillingInquiryRow {
  id: string;
  name: string;
  email: string;
  org: string;
  seats?: string;
  note?: string;
  created_at: string;
}

async function collection() {
  const db = await getDb();
  return db.collection<BillingInquiryDoc>("billing_inquiries");
}

export async function createBillingInquiry(input: {
  name: string;
  email: string;
  org: string;
  seats?: string;
  note?: string;
}): Promise<BillingInquiryRow> {
  const col = await collection();
  const doc: Omit<BillingInquiryDoc, "_id"> = {
    name: input.name.slice(0, 80),
    email: input.email.trim().toLowerCase().slice(0, 254),
    org: input.org.slice(0, 120),
    seats: input.seats?.slice(0, 40),
    note: input.note?.slice(0, 500),
    created_at: new Date(),
  };
  const result = await col.insertOne(doc as BillingInquiryDoc);
  return {
    id: result.insertedId.toString(),
    name: doc.name,
    email: doc.email,
    org: doc.org,
    seats: doc.seats,
    note: doc.note,
    created_at: doc.created_at.toISOString(),
  };
}

export async function countBillingInquiries(): Promise<number> {
  const col = await collection();
  return col.countDocuments();
}

export async function recentBillingInquiries(limit = 20): Promise<BillingInquiryRow[]> {
  const col = await collection();
  const docs = await col.find().sort({ created_at: -1 }).limit(limit).toArray();
  return docs.map((d) => ({
    id: d._id.toString(),
    name: d.name,
    email: d.email,
    org: d.org,
    seats: d.seats,
    note: d.note,
    created_at: d.created_at.toISOString(),
  }));
}
