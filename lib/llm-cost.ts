/** Which model wrote a draft and what it cost (M9.3). Money in integer micro-USD. */
export interface LlmUsage {
  provider: "openrouter" | "xai" | "extract";
  model: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  /** Integer micro-USD (1 USD = 1_000_000). null when unknown. */
  cost_microusd: number | null;
}

function intOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
}

/**
 * Build usage from an OpenRouter-style `usage` block. OpenRouter reports
 * `usage.cost` in USD; free (`:free` / openrouter/free) models cost 0.
 */
export function usageFrom(
  provider: LlmUsage["provider"],
  model: string,
  usage?: unknown
): LlmUsage {
  const u = (usage && typeof usage === "object" ? usage : {}) as Record<string, unknown>;
  const reported = typeof u.cost === "number" && Number.isFinite(u.cost) && u.cost >= 0 ? u.cost : null;
  const free = provider === "extract" || /:free$|^openrouter\/free$/i.test(model);
  return {
    provider,
    model: model.slice(0, 120) || "unknown",
    prompt_tokens: intOrNull(u.prompt_tokens),
    completion_tokens: intOrNull(u.completion_tokens),
    cost_microusd: reported !== null ? Math.round(reported * 1_000_000) : free ? 0 : null,
  };
}

/** "free", "$0.0012", or "cost unknown". */
export function formatCost(micro: number | null | undefined): string {
  if (micro === null || micro === undefined) return "cost unknown";
  if (micro === 0) return "free";
  return `$${(micro / 1_000_000).toFixed(4)}`;
}

/** Short admin label, e.g. "openrouter · meta-llama/x:free · free". */
export function llmLabel(llm: LlmUsage | null | undefined): string {
  if (!llm) return "model not recorded";
  if (llm.provider === "extract") return "extract only (no AI) · free";
  return `${llm.provider} · ${llm.model} · ${formatCost(llm.cost_microusd)}`;
}
