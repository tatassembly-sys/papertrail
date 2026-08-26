import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "papertrail";
if (!uri) {
  console.error("MONGODB_URI required");
  process.exit(1);
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 });
await client.connect();
const db = client.db(dbName);
const articles = db.collection("articles");
const queue = db.collection("fetch_queue");

const byStatus = await articles
  .aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }])
  .toArray();
const byCatPub = await articles
  .aggregate([
    { $match: { status: "published" } },
    { $group: { _id: "$category", n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ])
  .toArray();
const byCatDraft = await articles
  .aggregate([
    { $match: { status: "draft" } },
    { $group: { _id: "$category", n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ])
  .toArray();
const qStatus = await queue
  .aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }])
  .toArray();
const qErrors = await queue
  .find({ status: "error" })
  .sort({ created_at: -1 })
  .limit(5)
  .project({ external_id: 1, source: 1, error_message: 1, attempts: 1 })
  .toArray();
const recentDrafts = await articles
  .find({ status: "draft" })
  .sort({ created_at: -1 })
  .limit(8)
  .project({ title: 1, category: 1, source_url: 1, created_at: 1 })
  .toArray();
const recentPub = await articles
  .find({ status: "published" })
  .sort({ published_at: -1 })
  .limit(10)
  .project({ title: 1, category: 1, slug: 1 })
  .toArray();

console.log(
  JSON.stringify(
    {
      byStatus,
      byCatPub,
      byCatDraft,
      qStatus,
      qErrors,
      recentDrafts,
      recentPub,
    },
    null,
    2
  )
);
await client.close();
