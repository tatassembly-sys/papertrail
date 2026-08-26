/**
 * Publish a small mix of drafts across fields so public search is not
 * biology-only. Never publishes the whole queue. Requires source_url.
 *
 *   railway run --service papertrail node scripts/publish-mix.mjs
 */
import { MongoClient } from "mongodb";

const PER_FIELD = 2;
const MAX_PUBLISH = 16;

const FIELDS = [
  ["cs", /^cs(\.|$)/i],
  ["math", /^math(\.|$)/i],
  ["stat", /^stat(\.|$)/i],
  ["eess", /^eess(\.|$)/i],
  ["econ", /^econ(\.|$)/i],
  ["q-fin", /^q-fin/i],
  ["physics.med-ph", /^physics\.med-ph/i],
  ["physics.ao-ph", /^physics\.ao-ph/i],
  ["physics", /^physics(\.|$)/i],
  ["astro-ph", /^astro-ph/i],
  ["quant-ph", /^quant-ph/i],
  ["cond-mat", /^cond-mat/i],
  ["q-bio", /^q-bio/i],
];

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function fieldOf(category) {
  const raw = (category || "").trim();
  for (const [name, rx] of FIELDS) {
    if (rx.test(raw)) return name;
  }
  return raw || "other";
}

function clip(value, max) {
  const t = String(value || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40);
}

async function fetchArxiv(id) {
  const res = await fetch(`https://export.arxiv.org/api/query?id_list=${id}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`arxiv ${id} ${res.status}`);
  const xml = await res.text();
  const title =
    xml
      .match(/<title>([\s\S]*?)<\/title>/g)?.[1]
      ?.replace(/<\/?title>/g, "")
      .replace(/\s+/g, " ")
      .trim() || `arXiv ${id}`;
  const abstract =
    xml.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.replace(/\s+/g, " ").trim() || "";
  return { title, abstract };
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!uri) throw new Error("MONGODB_URI / MONGO_URL not set");
  const dbName = process.env.MONGODB_DB || "papertrail";

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 8000,
  });
  await client.connect();
  const db = client.db(dbName);
  const col = db.collection("articles");
  const queue = db.collection("fetch_queue");

  const drafts = await col
    .find({
      status: "draft",
      source_url: { $type: "string", $ne: "" },
      title: { $type: "string", $ne: "" },
    })
    .project({
      title: 1,
      headline: 1,
      category: 1,
      source_url: 1,
      slug: 1,
      tags: 1,
    })
    .sort({ created_at: -1 })
    .limit(400)
    .toArray();

  const byField = new Map();
  for (const d of drafts) {
    const field = fieldOf(d.category);
    if (!byField.has(field)) byField.set(field, []);
    byField.get(field).push(d);
  }

  console.log("draft_fields", [...byField.entries()].map(([k, v]) => `${k}:${v.length}`).join(" "));

  const chosen = [];
  for (const [name] of FIELDS) {
    const pool = byField.get(name) || [];
    for (const doc of pool) {
      if (chosen.length >= MAX_PUBLISH) break;
      if (chosen.filter((c) => fieldOf(c.category) === name).length >= PER_FIELD) break;
      if (chosen.some((c) => String(c._id) === String(doc._id))) continue;
      chosen.push(doc);
    }
  }

  // If a field has no draft yet, file one from a pending queue row (abstract only).
  for (const [name, rx] of FIELDS) {
    if (chosen.filter((c) => fieldOf(c.category) === name).length >= PER_FIELD) continue;
    if (chosen.length >= MAX_PUBLISH) break;
    const pending = await queue
      .find({
        status: "pending",
        source: "arxiv",
        category: { $regex: rx },
      })
      .sort({ created_at: -1 })
      .limit(PER_FIELD)
      .toArray();

    for (const row of pending) {
      if (chosen.filter((c) => fieldOf(c.category) === name).length >= PER_FIELD) break;
      if (chosen.length >= MAX_PUBLISH) break;
      try {
        const meta = await fetchArxiv(row.external_id);
        if (!meta.abstract || meta.abstract.length < 80) continue;
        const sentences = splitSentences(meta.abstract);
        const why = sentences.slice(1, 4);
        while (why.length < 3) why.push("See the original paper for methods and limits.");
        const slugBase = slugify(meta.title) || `arxiv-${row.external_id.replace(".", "-")}`;
        const doc = {
          title: clip(meta.title, 160),
          headline: clip(sentences[0] || meta.abstract, 240),
          why_it_matters: why.slice(0, 3).map((s) => clip(s, 220)),
          plain_explanation: clip(meta.abstract, 4000),
          caveats:
            "Filed from the paper abstract so public search covers this field. Review sample, setting, and claims before treating this as a finished translation.",
          keywords: [],
          tags: ["source-text", "needs-review"],
          authors: [],
          institutions: [],
          slug: slugBase,
          source_url: row.url || `https://arxiv.org/abs/${row.external_id}`,
          source: "arxiv",
          status: "draft",
          created_at: new Date(),
          published_at: null,
          category: row.category || name,
          share_approved: false,
        };
        try {
          const ins = await col.insertOne(doc);
          chosen.push({ ...doc, _id: ins.insertedId });
        } catch (err) {
          if (err && err.code === 11000) {
            doc.slug = `${slugBase}-${Date.now().toString(36)}`;
            const ins = await col.insertOne(doc);
            chosen.push({ ...doc, _id: ins.insertedId });
          } else {
            throw err;
          }
        }
        await queue.updateOne(
          { _id: row._id },
          { $set: { status: "done" } }
        );
      } catch (err) {
        console.log(`skip ${name} ${row.external_id}: ${err instanceof Error ? err.message : "fail"}`);
      }
    }
  }

  if (chosen.length === 0) {
    console.log("nothing_to_publish");
    await client.close();
    process.exit(0);
  }

  const now = new Date();
  const ids = chosen.map((d) => d._id);
  const result = await col.updateMany(
    { _id: { $in: ids }, status: "draft", source_url: { $type: "string", $ne: "" } },
    { $set: { status: "published", published_at: now } }
  );

  console.log(`published ${result.modifiedCount}`);
  for (const d of chosen) {
    console.log(`- ${fieldOf(d.category)} | ${d.slug || slugify(d.title)} | ${d.title}`);
  }

  const published = await col
    .aggregate([{ $match: { status: "published" } }, { $group: { _id: "$category", n: { $sum: 1 } } }])
    .toArray();
  console.log(
    "published_now",
    published
      .map((r) => `${r._id || "none"}:${r.n}`)
      .sort()
      .join(" ")
  );

  await client.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "publish-mix failed");
  process.exit(1);
});
