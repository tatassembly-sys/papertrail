import { TRANSLATOR_SYSTEM_PROMPT, TranslatedArticle } from "./prompts";
import { getSiteUrl } from "./site-url";
import { draftFromExtract } from "./extract-draft";
import { isXaiConfigured, xaiChat } from "./xai";

const REQUIRED_KEYS: (keyof TranslatedArticle)[] = [
  "title",
  "headline",
  "why_it_matters",
  "plain_explanation",
  "caveats",
];

/**
 * Free-only policy:
 * 1. Prefer OpenRouter’s free auto-router: `openrouter/free`
 * 2. Fall through a free-model picker (`:free` models) when the router is busy/unavailable
 *
 * @see https://openrouter.ai/docs/guides/routing/routers/free-models-router
 * @see https://openrouter.ai/collections/free-models
 */
export const FREE_AUTO_ROUTER = "openrouter/free";

/** Static free fallbacks — order is preference after the auto-router. */
const DEFAULT_FREE_FALLBACKS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-27b-it:free",
  "qwen/qwen3-8b:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "openai/gpt-oss-20b:free",
  "microsoft/phi-4-reasoning-plus:free",
] as const;

export function isFreeOpenRouterModel(model: string): boolean {
  const id = model.trim().toLowerCase();
  return id === FREE_AUTO_ROUTER || id.endsWith(":free");
}

/**
 * Resolves the primary model preference (auto-router by default).
 * Paid models are rejected so env cannot accidentally burn credits.
 */
export function resolveOpenRouterModel(): string {
  const requested = (process.env.OPENROUTER_MODEL || FREE_AUTO_ROUTER).trim();
  if (isFreeOpenRouterModel(requested)) return requested;

  console.warn(
    `[openrouter] OPENROUTER_MODEL="${requested}" is not a free model; ` +
      `forcing ${FREE_AUTO_ROUTER}. Use a model id ending in :free or openrouter/free.`
  );
  return FREE_AUTO_ROUTER;
}

/** In-memory cache of live free model ids from OpenRouter (1h). */
let liveFreeCache: { at: number; models: string[] } | null = null;
const LIVE_FREE_TTL_MS = 60 * 60 * 1000;

function dedupeFreeModels(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of ids) {
    const id = m.trim();
    if (!id || seen.has(id) || !isFreeOpenRouterModel(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Builds the free-model attempt list (sync / static + env):
 * primary → openrouter/free → OPENROUTER_FREE_MODELS → static free fallbacks.
 */
export function getFreeModelCandidates(): string[] {
  const primary = resolveOpenRouterModel();

  const fromEnv = (process.env.OPENROUTER_FREE_MODELS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return dedupeFreeModels([
    primary,
    FREE_AUTO_ROUTER,
    ...fromEnv,
    ...DEFAULT_FREE_FALLBACKS,
  ]);
}

/**
 * Fetches currently free models from OpenRouter and merges them into the
 * static picker. Failures fall back to the static list (never blocks).
 */
export async function getFreeModelCandidatesLive(apiKey: string): Promise<string[]> {
  const base = getFreeModelCandidates();
  const now = Date.now();

  if (liveFreeCache && now - liveFreeCache.at < LIVE_FREE_TTL_MS) {
    return dedupeFreeModels([...base, ...liveFreeCache.models]);
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn("[openrouter] models list failed", res.status);
      return base;
    }
    const data = (await res.json()) as {
      data?: { id?: string; pricing?: { prompt?: string; completion?: string } }[];
    };
    const live: string[] = [];
    for (const m of data.data || []) {
      const id = typeof m.id === "string" ? m.id : "";
      if (!id) continue;
      // Free policy: only auto-router or explicit :free suffix (never paid ids)
      if (id === FREE_AUTO_ROUTER || id.endsWith(":free")) {
        live.push(id);
      }
    }
    const freeOnly = live.filter(isFreeOpenRouterModel);
    liveFreeCache = { at: now, models: freeOnly.slice(0, 40) };
    return dedupeFreeModels([...base, ...freeOnly]);
  } catch (err) {
    console.warn("[openrouter] live free-model fetch failed", err);
    return base;
  }
}

export interface OpenRouterChatOptions {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature?: number;
  maxTokens?: number;
  /** Attribution title for OpenRouter dashboard */
  title?: string;
  /** Max free models to try (including auto-router) */
  maxAttempts?: number;
}

export interface OpenRouterChatResult {
  content: string;
  model: string;
  attempts: { model: string; status: number | "network"; detail?: string }[];
}

function openRouterHeaders(apiKey: string, title: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": getSiteUrl(),
    "X-Title": title,
  };
}

/**
 * Chat completion against free models only.
 * Tries `openrouter/free` first, then free-model picker fallbacks on 429/5xx/empty.
 */
export async function openRouterChat(
  options: OpenRouterChatOptions
): Promise<OpenRouterChatResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set.");

  // Auto-router first, then env/static free list, then live free catalog
  const candidates = await getFreeModelCandidatesLive(apiKey);
  const maxAttempts = Math.min(
    options.maxAttempts ?? candidates.length,
    candidates.length,
    6
  );
  const attempts: OpenRouterChatResult["attempts"] = [];
  let lastError = "OpenRouter free models unavailable.";

  for (let i = 0; i < maxAttempts; i++) {
    const model = candidates[i];
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: openRouterHeaders(apiKey, options.title || "Paper Trail"),
        body: JSON.stringify({
          model,
          temperature: options.temperature ?? 0.4,
          max_tokens: options.maxTokens ?? 2000,
          messages: options.messages,
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (response.status === 401) {
        throw new Error(
          "OpenRouter rejected the API key (401). Update OPENROUTER_API_KEY on Railway."
        );
      }

      if (!response.ok) {
        const errBody = await response.text();
        attempts.push({
          model,
          status: response.status,
          detail: errBody.slice(0, 160),
        });
        lastError = `OpenRouter ${model} failed (${response.status})`;
        // Try next free model on rate limits / provider outages / unknown model
        if (
          response.status === 404 ||
          response.status === 408 ||
          response.status === 429 ||
          response.status >= 500
        ) {
          if (i < maxAttempts - 1) {
            await new Promise((r) => setTimeout(r, 400 + i * 200));
          }
          continue;
        }
        // 402 payment / other client errors — free-only path should skip
        if (response.status === 402 || response.status === 403) {
          continue;
        }
        continue;
      }

      const data = await response.json();
      const content: string | undefined = data?.choices?.[0]?.message?.content?.trim();
      if (!content) {
        attempts.push({ model, status: response.status, detail: "empty content" });
        lastError = `OpenRouter ${model} returned no content`;
        continue;
      }

      const usedModel =
        typeof data?.model === "string" && data.model ? data.model : model;
      attempts.push({ model: usedModel, status: response.status });
      return { content, model: usedModel, attempts };
    } catch (err) {
      if (err instanceof Error && /OPENROUTER_API_KEY|rejected the API key/i.test(err.message)) {
        throw err;
      }
      const message = err instanceof Error ? err.message : "network error";
      attempts.push({ model, status: "network", detail: message });
      lastError = message;
      if (i < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 400 + i * 200));
      }
    }
  }

  console.error("[openrouter] free-model picker exhausted", attempts);
  throw new Error(`${lastError}. Tried: ${attempts.map((a) => a.model).join(", ")}`);
}

function isValidTranslatedArticle(obj: unknown): obj is TranslatedArticle {
  if (typeof obj !== "object" || obj === null) return false;
  const record = obj as Record<string, unknown>;
  if (!REQUIRED_KEYS.every((key) => key in record)) return false;
  if (!Array.isArray(record.why_it_matters)) return false;
  if (typeof record.title !== "string") return false;
  if (typeof record.headline !== "string") return false;
  if (typeof record.plain_explanation !== "string") return false;
  if (typeof record.caveats !== "string") return false;
  if (record.keywords !== undefined && !Array.isArray(record.keywords)) return false;
  if (record.tags !== undefined && !Array.isArray(record.tags)) return false;
  return true;
}

function cleanJsonResponse(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

export async function translatePaperToArticle(
  paperText: string,
  options?: { fallbackTitle?: string }
): Promise<TranslatedArticle> {
  const maxTokens = Number(process.env.OPENROUTER_MAX_TOKENS || 2500);

  // Truncate input — full PDFs can be huge; model only needs enough context
  // for a plain-language summary (keeps free-tier latency down).
  const truncated =
    paperText.length > 24000 ? `${paperText.slice(0, 24000)}\n\n[…truncated…]` : paperText;

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: TRANSLATOR_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Here is the raw academic text to translate:\n\n${truncated}`,
    },
  ];

  let rawContent: string | null = null;
  let model = "unknown";

  try {
    const result = await openRouterChat({
      title: "Paper Trail Translator",
      temperature: 0.4,
      maxTokens,
      maxAttempts: 5,
      messages,
    });
    rawContent = result.content;
    model = result.model;
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    // Config failures must surface so cron can release the batch instead of
    // filing extract-only drafts and marking the queue done.
    if (
      /OPENROUTER_API_KEY is not set/i.test(message) ||
      /OpenRouter rejected the API key/i.test(message)
    ) {
      throw err;
    }
    console.warn("[openrouter] translator failed, trying xAI then extract", err);
    if (isXaiConfigured()) {
      try {
        rawContent = await xaiChat({ messages, temperature: 0.4, maxTokens });
        model = "xai";
      } catch (xerr) {
        console.warn("[xai] translator failed, using extract draft", xerr);
      }
    }
  }

  if (!rawContent) {
    return draftFromExtract(paperText, options?.fallbackTitle);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJsonResponse(rawContent));
  } catch {
    console.warn(`[openrouter] invalid JSON from ${model}; using extract draft`);
    return draftFromExtract(paperText, options?.fallbackTitle);
  }

  if (!isValidTranslatedArticle(parsed)) {
    console.warn("[openrouter] schema mismatch; using extract draft");
    return draftFromExtract(paperText, options?.fallbackTitle);
  }

  const record = parsed as TranslatedArticle & {
    keywords?: unknown;
    tags?: unknown;
  };
  return {
    ...record,
    keywords: Array.isArray(record.keywords)
      ? record.keywords.filter((k): k is string => typeof k === "string")
      : [],
    tags: Array.isArray(record.tags)
      ? record.tags.filter((k): k is string => typeof k === "string")
      : [],
  };
}
