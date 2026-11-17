// RSS escaping against an in-memory Mongo. No network.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { NextRequest } from "next/server";

let mongod: MongoMemoryServer;
const published = new Date("2026-06-15T12:00:00.000Z");

before(async () => {
  mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = "papertrail_feed";
  process.env.NEXT_PUBLIC_SITE_URL = "https://paper.example";
  const client = await new MongoClient(process.env.MONGODB_URI).connect();
  await client.db("papertrail_feed").collection("articles").insertMany([
    {
      title: 'Sleep & dreams <b> "café" 😴',
      headline: 'Why & how <brains> "rest"',
      slug: "sleep-dreams",
      status: "published",
      authors: ["Ann Lee"],
      tags: ["neuroscience"],
      category: "q-bio",
      published_at: published,
      created_at: published,
      plain_explanation: "body",
      caveats: "none",
      why_it_matters: ["rest"],
    },
    {
      title: "A longer byline",
      headline: "Not the exact author",
      slug: "longer-byline",
      status: "published",
      authors: ["Ann Lee Smith"],
      tags: ["neuroscience"],
      category: "q-bio",
      published_at: new Date("2026-06-14T12:00:00.000Z"),
      created_at: new Date("2026-06-14T12:00:00.000Z"),
      plain_explanation: "body",
      caveats: "none",
      why_it_matters: ["rest"],
    },
  ]);
  await client.close();
});

after(async () => {
  const g = globalThis as { _mongoClientPromise?: Promise<MongoClient> };
  if (g._mongoClientPromise) await (await g._mongoClientPromise).close();
  g._mongoClientPromise = undefined;
  await mongod?.stop();
});

test("feed escapes titles, dates items in RFC 822, and keeps the byline", async () => {
  const { GET } = await import("../app/feed/route");
  const res = await GET(
    new NextRequest("https://paper.example/feed?author=Ann%20Lee&authorExact=1")
  );
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") || "", /xml/);
  const xml = await res.text();
  assert.match(xml, /^<\?xml/);
  assert.match(xml, /<rss /);
  assert.match(xml, /Sleep &amp; dreams &lt;b&gt; &quot;café&quot; 😴/);
  assert.match(xml, /Why &amp; how &lt;brains&gt; &quot;rest&quot;/);
  assert.equal(xml.includes("<b>"), false);
  assert.match(xml, new RegExp(`<pubDate>${published.toUTCString()}</pubDate>`));
  assert.match(xml, /Paper Trail — Research, Translated · Ann Lee/);
  assert.equal(xml.includes("Ann Lee Smith"), false);
  assert.equal((xml.match(/<item>/g) || []).length, 1);
});
