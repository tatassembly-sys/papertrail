import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { publishBlocker } from "@/lib/publish-gate";

const PER_FIELD = 1;
const MAX_PUBLISH = 12;

const FIELDS: [string, RegExp][] = [
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

export interface PublishMixItem {
  field: string;
  title: unknown;
  slug: unknown;
}

export interface PublishMixResult {
  published: number;
  skipped: string | null;
  dateKey: string;
  items: PublishMixItem[];
}

function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function fieldOf(category: string | null | undefined): string {
  const raw = (category || "").trim();
  for (const [name, rx] of FIELDS) {
    if (rx.test(raw)) return name;
  }
  return raw || "other";
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function clip(value: string, max: number): string {
  const t = value.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40);
}

async function fetchArxivBatch(
  ids: string[]
): Promise<Map<string, { title: string; abstract: string }>> {
  const out = new Map<string, { title: string; abstract: string }>();
  if (ids.length === 0) return out;
  const res = await fetch(
    `https://export.arxiv.org/api/query?id_list=${ids.join(",")}&max_results=${ids.length}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`arxiv ${res.status}`);
  const xml = await res.text();
  for (const entry of xml.split("<entry>").slice(1)) {
    const idUrl = entry.match(/<id>([^<]+)<\/id>/)?.[1] || "";
    const id = idUrl.match(/(\d{4}\.\d{4,5})/)?.[1];
    if (!id) continue;
    const title =
      entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g, " ").trim() ||
      `arXiv ${id}`;
    const abstract =
      entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.replace(/\s+/g, " ").trim() || "";
    out.set(id, { title, abstract });
  }
  return out;
}

/**
 * Publish at most one new paper per field (cap 12). Skips if a mix already
 * ran today unless `force` is set. Never dumps the queue.
 */
export async function publishDailyFieldMix(options: {
  force?: boolean;
} = {}): Promise<PublishMixResult> {
  const dateKey = utcDateKey();
  const db = await getDb();
  const col = db.collection("articles");
  const queue = db.collection("fetch_queue");
  const runs = db.collection("publish_mix_runs");

  let claimed = false;
  if (!options.force) {
    try {
      await runs.insertOne({ dateKey, at: new Date(), published: 0, items: [] });
      claimed = true;
    } catch (err) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? (err as { code: number }).code
          : 0;
      if (code === 11000) {
        return {
          published: 0,
          skipped: "already_ran_today",
          dateKey,
          items: [],
        };
      }
      throw err;
    }
  }

  try {
  const drafts = await col
    .find({
      status: "draft",
      source_url: { $type: "string", $ne: "" },
      title: { $type: "string", $ne: "" },
    })
    .project({ title: 1, category: 1, source_url: 1, slug: 1, caveats: 1 })
    .sort({ created_at: -1 })
    .limit(400)
    .toArray();

  const byField = new Map<string, typeof drafts>();
  for (const d of drafts) {
    if (
      publishBlocker({
        sourceUrl: typeof d.source_url === "string" ? d.source_url : null,
        caveats: typeof d.caveats === "string" ? d.caveats : "",
      })
    ) {
      continue;
    }
    const field = fieldOf(typeof d.category === "string" ? d.category : "");
    const list = byField.get(field) || [];
    list.push(d);
    byField.set(field, list);
  }

  const chosen: { _id: ObjectId; category?: unknown; title?: unknown; slug?: unknown }[] = [];

  for (const [name] of FIELDS) {
    const pool = byField.get(name) || [];
    for (const doc of pool) {
      if (chosen.length >= MAX_PUBLISH) break;
      if (chosen.filter((c) => fieldOf(String(c.category || "")) === name).length >= PER_FIELD) {
        break;
      }
      if (chosen.some((c) => String(c._id) === String(doc._id))) continue;
      chosen.push({
        _id: doc._id as ObjectId,
        category: doc.category,
        title: doc.title,
        slug: doc.slug,
      });
    }
  }

  type QueueRow = {
    _id: ObjectId;
    external_id?: string;
    url?: string;
    category?: string;
  };
  const toFile: { name: string; row: QueueRow }[] = [];

  for (const [name, rx] of FIELDS) {
    if (chosen.filter((c) => fieldOf(String(c.category || "")) === name).length >= PER_FIELD) {
      continue;
    }
    if (chosen.length + toFile.length >= MAX_PUBLISH) break;
    const row = (await queue.findOneAndUpdate(
      { status: "pending", source: "arxiv", category: { $regex: rx } },
      { $set: { status: "processing", processing_started_at: new Date() } },
      { sort: { created_at: -1 }, returnDocument: "after" }
    )) as QueueRow | null;
    if (row?.external_id) toFile.push({ name, row });
  }

  let metas = new Map<string, { title: string; abstract: string }>();
  try {
    metas = await fetchArxivBatch(toFile.map((f) => String(f.row.external_id)));
  } catch (err) {
    console.warn("publish-mix arxiv batch failed; using queue ids", err);
  }

  for (const { name, row } of toFile) {
    const id = String(row.external_id);
    const meta = metas.get(id);
    const abstract = meta?.abstract || "";
    const title = meta?.title || `${name} paper ${id}`;
    const sentences = splitSentences(abstract);
    const why = sentences.slice(1, 4);
    while (why.length < 3) {
      why.push("Open the original paper for methods, sample, and what the authors cannot claim.");
    }
    const slugBase = slugify(title) || `arxiv-${id.replace(".", "-")}`;
    const explanation =
      abstract.length >= 80
        ? clip(abstract, 4000)
        : `This ${name} paper is on file from arXiv (${id}) so the field is searchable. Read the original for the full argument.`;
    const doc = {
      title: clip(title, 160),
      headline: clip(sentences[0] || `${name} research from arXiv ${id}.`, 240),
      why_it_matters: why.slice(0, 3).map((s) => clip(s, 220)),
      plain_explanation: explanation,
      caveats:
        "Auto-filed in the daily field mix. Confirm claims against the original paper.",
      keywords: [],
      tags: ["daily-mix", "needs-review"],
      authors: [],
      institutions: [],
      slug: slugBase,
      source_url: row.url || `https://arxiv.org/abs/${id}`,
      source: "arxiv",
      status: "draft",
      created_at: new Date(),
      published_at: null,
      category: row.category || name,
      share_approved: false,
    };
    try {
      const ins = await col.insertOne(doc);
      chosen.push({
        _id: ins.insertedId,
        category: doc.category,
        title: doc.title,
        slug: doc.slug,
      });
    } catch (err) {
      const code = typeof err === "object" && err && "code" in err ? (err as { code: number }).code : 0;
      if (code !== 11000) throw err;
      const keyValue =
        typeof err === "object" && err && "keyValue" in err
          ? (err as { keyValue?: Record<string, unknown> }).keyValue
          : undefined;
      if (keyValue && typeof keyValue.source_url === "string") {
        await queue.updateOne({ _id: row._id }, { $set: { status: "done" } });
        continue;
      }
      const retrySlug = `${slugBase}-${Date.now().toString(36)}`;
      const ins = await col.insertOne({ ...doc, slug: retrySlug });
      chosen.push({
        _id: ins.insertedId,
        category: doc.category,
        title: doc.title,
        slug: retrySlug,
      });
    }
    await queue.updateOne({ _id: row._id }, { $set: { status: "done" } });
  }

  if (chosen.length === 0) {
    if (claimed) await runs.deleteOne({ dateKey, published: 0 });
    return { published: 0, skipped: null, dateKey, items: [] };
  }

  const publishedIds: string[] = [];
  for (const c of chosen) {
    const result = await col.updateOne(
      {
        _id: c._id,
        status: "draft",
        source_url: { $type: "string", $ne: "" },
        caveats: { $regex: /\S/ },
      },
      { $set: { status: "published", published_at: new Date() } }
    );
    if (result.modifiedCount) publishedIds.push(String(c._id));
  }

  const items = chosen
    .filter((c) => publishedIds.includes(String(c._id)))
    .map((c) => ({
      field: fieldOf(String(c.category || "")),
      title: c.title,
      slug: c.slug,
    }));

  if (items.length === 0) {
    if (claimed) await runs.deleteOne({ dateKey, published: 0 });
    return { published: 0, skipped: null, dateKey, items: [] };
  }

  await runs.updateOne(
    { dateKey },
    {
      $set: { at: new Date(), published: items.length, items },
      $setOnInsert: { dateKey },
    },
    { upsert: true }
  );

  return {
    published: items.length,
    skipped: null,
    dateKey,
    items,
  };
  } catch (err) {
    if (claimed) {
      try {
        await runs.deleteOne({ dateKey, published: 0 });
      } catch (cleanupErr) {
        console.error("publish-mix claim cleanup failed:", cleanupErr);
      }
    }
    throw err;
  }
}

export async function getLastPublishMix(): Promise<{
  dateKey: string;
  published: number;
  at: string | null;
  items: PublishMixItem[];
} | null> {
  const db = await getDb();
  const row = await db
    .collection("publish_mix_runs")
    .find()
    .sort({ at: -1 })
    .limit(1)
    .next();
  if (!row) return null;
  const raw = Array.isArray(row.items) ? row.items : [];
  const items: PublishMixItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const slug = typeof rec.slug === "string" ? rec.slug : "";
    if (!slug) continue;
    items.push({
      field: typeof rec.field === "string" ? rec.field : "other",
      title: rec.title,
      slug,
    });
  }
  return {
    dateKey: typeof row.dateKey === "string" ? row.dateKey : "",
    published: typeof row.published === "number" ? row.published : items.length,
    at: row.at instanceof Date ? row.at.toISOString() : row.at ? String(row.at) : null,
    items,
  };
}
