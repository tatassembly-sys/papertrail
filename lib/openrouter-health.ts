import { FREE_AUTO_ROUTER, getFreeModelCandidates, resolveOpenRouterModel } from "./openrouter";

/**
 * Lightweight OpenRouter readiness check for admin/ops dashboards.
 * Does not call the chat API — only verifies the key is accepted by /auth/key.
 */
export async function probeOpenRouterKey(): Promise<{
  configured: boolean;
  ok: boolean;
  message: string;
  primaryModel: string;
  freeCandidates: string[];
  autoRouter: string;
}> {
  const primaryModel = resolveOpenRouterModel();
  const freeCandidates = getFreeModelCandidates();
  const autoRouter = FREE_AUTO_ROUTER;

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return {
      configured: false,
      ok: false,
      message: "OPENROUTER_API_KEY is not set.",
      primaryModel,
      freeCandidates,
      autoRouter,
    };
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${apiKey}` },
      // Short timeout — status page only
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 401 || res.status === 403) {
      return {
        configured: true,
        ok: false,
        message: "OpenRouter rejected the API key. Create a new key and update Railway.",
        primaryModel,
        freeCandidates,
        autoRouter,
      };
    }

    if (!res.ok) {
      const body = await res.text();
      return {
        configured: true,
        ok: false,
        message: `OpenRouter auth check failed (${res.status}): ${body.slice(0, 120)}`,
        primaryModel,
        freeCandidates,
        autoRouter,
      };
    }

    return {
      configured: true,
      ok: true,
      message: `OpenRouter API key accepted. Free routing via ${primaryModel} + ${freeCandidates.length - 1} free fallbacks.`,
      primaryModel,
      freeCandidates,
      autoRouter,
    };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      message:
        err instanceof Error
          ? `OpenRouter unreachable: ${err.message}`
          : "OpenRouter unreachable.",
      primaryModel,
      freeCandidates,
      autoRouter,
    };
  }
}

export function isOpenRouterConfigError(message: string): boolean {
  return (
    /OPENROUTER_API_KEY is not set/i.test(message) ||
    /OpenRouter rejected the API key/i.test(message) ||
    /OpenRouter request failed \(401\)/i.test(message) ||
    /User not found/i.test(message)
  );
}
