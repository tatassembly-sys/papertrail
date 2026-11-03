#!/usr/bin/env node
// Local throwaway MongoDB for e2e/lighthouse runs (the box blocks 27017; this
// picks a random port). Prints MONGODB_URI, seeds one published post and one
// draft (so admin bulk-select is visible), and stays up until Ctrl+C.
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
