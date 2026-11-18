#!/usr/bin/env node
// Local throwaway MongoDB for e2e/lighthouse runs (the box blocks 27017; this
// picks a random port). Prints MONGODB_URI, seeds three published posts (two
// bylines that share a prefix, for exact-author search) and one draft, and
// stays up until Ctrl+C.
// Never point this at a real database.
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";

const mongod = await MongoMemoryServer.create({
  instance: { launchTimeout: 60_000 },
});
const uri = mongod.getUri();
const client = await new MongoClient(uri).connect();
const db = client.db(process.env.MONGODB_DB || "papertrail");
const now = new Date();
await db.collection("articles").insertOne({
  title: "How sleep clears the brain",
  headline: "A plain-English note on a sample paper used for local checks.",
  slug: "how-sleep-clears-the-brain",
  status: "published",
  category: "q-bio",
  tags: ["neuroscience"],
  keywords: ["sleep"],
  authors: ["A. Researcher"],
  plain_explanation: "Sample body text for local accessibility and performance checks.",
  caveats: "Sample only.",
  source: "arxiv",
  source_url: "https://arxiv.org/abs/0000.00000",
  published_at: now,
  created_at: now,
});
await db.collection("articles").insertOne({
  title: "Night signals from the cortex",
  headline: "A second published note, filed under Ann Lee only.",
  slug: "night-signals-from-the-cortex",
  status: "published",
  category: "q-bio",
  tags: ["neuroscience"],
  keywords: ["signals"],
  authors: ["Ann Lee"],
  plain_explanation: "Sample body for exact-author search.",
  caveats: "Sample only.",
  source: "arxiv",
  source_url: "https://example.test/ann-lee",
  published_at: new Date(now.getTime() - 60_000),
  created_at: new Date(now.getTime() - 60_000),
});
await db.collection("articles").insertOne({
  title: "Smith catalogue of local glaciers",
  headline: "A longer byline that must not match an exact Ann Lee search.",
  slug: "smith-catalogue-of-local-glaciers",
  status: "published",
  category: "physics",
  tags: ["climate"],
  keywords: ["glaciers"],
  authors: ["Ann Lee Smith"],
  plain_explanation: "Sample body for the longer byline.",
  caveats: "Sample only.",
  source: "arxiv",
  source_url: "https://example.test/ann-lee-smith",
  published_at: new Date(now.getTime() - 120_000),
  created_at: new Date(now.getTime() - 120_000),
});
await db.collection("articles").insertOne({
  title: "Draft note on local glaciers",
  headline: "A draft used so the admin bulk-select checkbox renders.",
  slug: "draft-note-on-local-glaciers",
  status: "draft",
  category: "physics",
  tags: ["climate"],
  keywords: ["ice"],
  authors: ["B. Reviewer"],
  plain_explanation: "Draft body. Not on the public site.",
  caveats: "Sample only.",
  source: "manual",
  source_url: "https://example.test/draft",
  published_at: null,
  created_at: now,
});
await client.close();
console.log(`MONGODB_URI=${uri}`);
const stop = async () => {
  await mongod.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
