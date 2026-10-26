import { deleteArticle, getArticleById, updateArticle } from "./articles";
import { PublishGateError, publishBlocker } from "./publish-gate";

export const BULK_MAX = 100;
export type BulkAction = "publish" | "reject";
export interface BulkResult {
  id: string;
  ok: boolean;
  error?: string;
}

/** Validate a bulk request body: { action, ids }. Returns an error string or the parsed value. */
export function parseBulkBody(body: unknown): { action: BulkAction; ids: string[] } | string {
  if (!body || typeof body !== "object") return "Invalid JSON body.";
  const { action, ids } = body as { action?: unknown; ids?: unknown };
  if (action !== "publish" && action !== "reject") return "action must be publish or reject.";
  if (!Array.isArray(ids) || ids.length === 0) return "ids must be a non-empty array.";
  if (ids.length > BULK_MAX) return `At most ${BULK_MAX} ids per request.`;
  if (!ids.every((id) => typeof id === "string" && id.length <= 64)) return "ids must be strings.";
  return { action, ids: [...new Set(ids as string[])] };
}

/**
 * Publish or reject (delete) drafts one by one, applying the same publish gate
 * as the single-article PATCH. Published articles are never deleted here.
 */
export async function bulkReview(action: BulkAction, ids: string[]): Promise<BulkResult[]> {
  const results: BulkResult[] = [];
  for (const id of ids) {
    const article = await getArticleById(id);
    if (!article) {
      results.push({ id, ok: false, error: "not found" });
      continue;
    }
    if (article.status !== "draft") {
      results.push({ id, ok: false, error: "not a draft" });
      continue;
    }
    if (action === "reject") {
      results.push({ id, ok: await deleteArticle(id) });
      continue;
    }
    const blocked = publishBlocker({ sourceUrl: article.source_url, caveats: article.caveats });
    if (blocked) {
      results.push({ id, ok: false, error: blocked });
      continue;
    }
    try {
      const updated = await updateArticle(id, { status: "published" });
      results.push(updated ? { id, ok: true } : { id, ok: false, error: "update failed" });
    } catch (err) {
      results.push({ id, ok: false, error: err instanceof PublishGateError ? err.message : "update failed" });
    }
  }
  return results;
}
