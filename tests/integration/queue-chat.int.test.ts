// Queue and article chat against in-memory Mongo. OpenRouter and xAI are stubbed.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { MongoClient } from "mongodb";
import type { ArticleRow } from "../../lib/prompts";

let mongod: MongoMemoryServer;
const originalFetch = globalThis.fetch;
const savedKey = process.env.OPENROUTER_API_KEY;
const savedXai = process.env.XAI_API_KEY;

function article(): ArticleRow {
  return {
    title: "Sleep",
    headline: "Brains flush waste",
    why_it_matters: ["Rest matters"],
    plain_explanation: "The paper says sleep helps.",
    caveats: "Small sample.",
    slug: "sleep-note",
    source_url: "https://example.test/sleep",
    status: "published",
  };
}

before(async () => {
  mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = "papertrail_queue_chat";
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.XAI_API_KEY;
});

after(async () => {
  globalThis.fetch = originalFetch;
  if (savedKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = savedKey;
  if (savedXai === undefined) delete process.env.XAI_API_KEY;
  else process.env.XAI_API_KEY = savedXai;
  const g = globalThis as { _mongoClientPromise?: Promise<MongoClient> };
  if (g._mongoClientPromise) await (await g._mongoClientPromise).close();
  g._mongoClientPromise = undefined;
  await mongod?.stop();
});

describe("fetch queue", () => {
  it("claims, completes, retries, redacts and ignores a second insert", async () => {
    const queue = await import("../../lib/queue");
    const { formatQueueLastError } = await import("../../lib/queue-last-error");
    const { getDb } = await import("../../lib/mongodb");

    const first = await queue.enqueuePapers("arxiv", [
      { externalId: "2401.00001", url: "https://example.test/2401.00001" },
      { externalId: "2401.00002", url: "https://example.test/2401.00002" },
    ]);
    assert.equal(first, 2);
    const again = await queue.enqueuePapers("arxiv", [
      { externalId: "2401.00001", url: "https://example.test/2401.00001" },
    ]);
    assert.equal(again, 0);
    const known = await queue.getQueuedExternalIds("arxiv", ["2401.00001", "missing"]);
    assert.deepEqual([...known], ["2401.00001"]);

    const claimed = await queue.claimQueueBatch(1);
    assert.equal(claimed.length, 1);
    assert.equal(claimed[0].status, "processing");
    assert.equal(claimed[0].attempts, 1);
    const secondClaim = await queue.claimQueueBatch(10);
    assert.equal(secondClaim.length, 1);
    assert.notEqual(secondClaim[0].external_id, claimed[0].external_id);

    await queue.markQueueDone(claimed[0]._id);
    await queue.markQueueDone(claimed[0]._id);
    const secret =
      "mongodb+srv://user:pass@cluster.example/db Bearer test-key-not-real sk-secretvalue";
    await queue.markQueueError(secondClaim[0]._id, "pending", secondClaim[0].attempts, secret);
    const db = await getDb();
    const erred = await db.collection("fetch_queue").findOne({ _id: secondClaim[0]._id });
    const shown = formatQueueLastError(erred);
    assert.ok(shown);
    assert.match(shown, /\[redacted\]/);
    assert.equal(shown.includes("pass@"), false);
    assert.equal(shown.includes("sk-secret"), false);

    await queue.releaseQueueClaim(secondClaim[0]._id, "config");
    const released = await db.collection("fetch_queue").findOne({ _id: secondClaim[0]._id });
    assert.equal(released?.status, "pending");
    assert.equal(released?.attempts, secondClaim[0].attempts - 1);

    const reclaimed = await queue.claimQueueBatch(5);
    assert.equal(reclaimed.length, 1);
    await queue.markQueueError(reclaimed[0]._id, "error", 3, "gave up");
    assert.equal((await queue.claimQueueBatch(5)).length, 0);
    assert.equal(await queue.retryFailedQueueItems([reclaimed[0]._id.toString()]), 1);
    assert.equal(await queue.retryFailedQueueItems(["not-an-id"]), 0);
    const fresh = await queue.claimQueueBatch(5);
    assert.equal(fresh.length, 1);
    assert.equal(fresh[0].attempts, 1);
    await queue.markQueueDone(fresh[0]._id);

    const stuckAt = new Date(Date.now() - 20 * 60 * 1000);
    await db.collection("fetch_queue").insertOne({
      source: "pubmed",
      external_id: "555",
      url: "https://example.test/pmid/555",
      status: "processing",
      attempts: 1,
      created_at: stuckAt,
      processing_started_at: stuckAt,
    });
    const stuck = await queue.claimQueueBatch(5);
    assert.equal(stuck.length, 1);
    assert.equal(stuck[0].external_id, "555");
    assert.equal(stuck[0].attempts, 2);
    await queue.markQueueDone(stuck[0]._id);
    assert.equal(await queue.enqueuePapers("arxiv", []), 0);
  });
});

describe("article chat", () => {
  it("refuses a missing key, accepts a stubbed reply, and falls back offline", async () => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.XAI_API_KEY;
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      throw new Error("network should not be used");
    };
    const chat = await import("../../lib/article-chat");
    const row = article();
    await assert.rejects(
      () => chat.askArticleAssistant(row, "s-missing", "what is the limit"),
      /OPENROUTER_API_KEY is not set/
    );
    assert.equal(calls, 0);

    process.env.OPENROUTER_API_KEY = "test-key-not-real";
    process.env.XAI_API_KEY = "test-key-not-real";
    globalThis.fetch = async (input) => {
      const url = String(input);
      calls += 1;
      if (url.includes("api/v1/models")) return new Response("no", { status: 500 });
      if (url.includes("api.x.ai")) return new Response("xai", { status: 200 });
      return new Response("no", { status: 401 });
    };
    calls = 0;
    await assert.rejects(
      () => chat.askArticleAssistant(row, "s-401", "hello"),
      /rejected the API key/
    );
    assert.equal(calls > 0, true);

    const chatBody = JSON.parse(readFileSync("tests/fixtures/openrouter-chat.json", "utf8"));
    const long = "a".repeat(2500);
    let sentUser = "";
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("api/v1/models")) return new Response("no", { status: 500 });
      const body = JSON.parse(String(init?.body)) as { messages: { content: string }[] };
      sentUser = body.messages[body.messages.length - 1].content;
      return new Response(JSON.stringify(chatBody), { status: 200 });
    };
    delete process.env.XAI_API_KEY;
    const ok = await chat.askArticleAssistant(row, "s-ok", long, "user-1");
    assert.equal(ok.reply, "From the model");
    assert.equal(sentUser.length, 2000);
    assert.equal(ok.messages.length, 2);
    const again = await chat.getOrCreateThread(row, "s-ok", "user-1");
    assert.equal(again.messages.length, 2);

    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("api/v1/models")) return new Response("no", { status: 500 });
      return new Response("down", { status: 500 });
    };
    const offline = await chat.askArticleAssistant(row, "s-offline", "what is the limit of the sample");
    assert.match(offline.reply, /Small sample/);
    assert.match(offline.reply, /offline/);

    process.env.XAI_API_KEY = "test-key-not-real";
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("api.x.ai")) {
        return new Response(JSON.stringify({ choices: [{ message: { content: "from xai" } }] }), {
          status: 200,
        });
      }
      if (url.includes("api/v1/models")) return new Response("no", { status: 500 });
      return new Response("down", { status: 500 });
    };
    const viaXai = await chat.askArticleAssistant(row, "s-xai", "explain the paper");
    assert.equal(viaXai.reply, "from xai");

    const raced = await Promise.all([
      chat.getOrCreateThread(row, "s-race", "user-2"),
      chat.getOrCreateThread(row, "s-race", "user-2"),
    ]);
    assert.equal(String(raced[0]._id), String(raced[1]._id));
    assert.deepEqual(await chat.getThreadMessages("missing", "nope"), []);
    await chat.deleteThreadsForUser("user-1");
    assert.deepEqual(await chat.getThreadMessages(row.slug, "s-ok"), []);
    await chat.deleteThreadsForUser("");
  });
});
