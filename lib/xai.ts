/**
 * SpaceXAI / xAI chat fallback when OpenRouter is unavailable.
 * Uses XAI_API_KEY against the OpenAI-compatible API.
 */

const XAI_BASE = "https://api.x.ai/v1";
const DEFAULT_MODEL = "grok-4.5";

export function isXaiConfigured(): boolean {
  return Boolean(process.env.XAI_API_KEY?.trim());
}

export async function xaiChat(options: {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) throw new Error("XAI_API_KEY is not set.");

  const model = (process.env.XAI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const res = await fetch(`${XAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 2000,
      messages: options.messages,
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 180);
    throw new Error(`xAI ${model} failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("xAI returned no content.");
  return content;
}
