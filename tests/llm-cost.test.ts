import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { formatCost, llmLabel, usageFrom } from "../lib/llm-cost";
import { translatePaperToArticle } from "../lib/openrouter";

const realFetch = globalThis.fetch;
const realKey = process.env.OPENROUTER_API_KEY;
afterEach(() => {
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = realKey;
});

test("usageFrom: reported USD cost becomes integer micro-USD; free models cost 0", () => {
  assert.equal(usageFrom("openrouter", "paid/model", { cost: 0.0012345, prompt_tokens: 10, completion_tokens: 5 }).cost_microusd, 1235);
  assert.equal(usageFrom("openrouter", "meta/llama:free").cost_microusd, 0);
  assert.equal(usageFrom("openrouter", "openrouter/free").cost_microusd, 0);
  assert.equal(usageFrom("xai", "grok").cost_microusd, null);
  assert.equal(usageFrom("extract", "extract").cost_microusd, 0);
  const u = usageFrom("openrouter", "m:free", { prompt_tokens: 12.4, completion_tokens: -1 });
  assert.equal(u.prompt_tokens, 12);
  assert.equal(u.completion_tokens, null);
});

test("formatCost and llmLabel", () => {
  assert.equal(formatCost(0), "free");
  assert.equal(formatCost(null), "cost unknown");
  assert.equal(formatCost(1500), "$0.0015");
  assert.equal(llmLabel(null), "model not recorded");
  assert.match(llmLabel(usageFrom("openrouter", "a/b:free")), /openrouter · a\/b:free · free/);
  assert.match(llmLabel(usageFrom("extract", "extract")), /extract only/);
});

test("translatePaperToArticle records the model and usage from OpenRouter", async () => {
  process.env.OPENROUTER_API_KEY = "test-key";
  const article = {
    title: "T", headline: "H", why_it_matters: ["a"], plain_explanation: "Plain words.", caveats: "Small sample.",
  };
  globalThis.fetch = (async (url: string | URL) => {
    if (String(url).includes("/models")) return new Response(JSON.stringify({ data: [] }), { status: 200 });
    return new Response(
      JSON.stringify({
        model: "meta/llama-x:free",
        choices: [{ message: { content: JSON.stringify(article) } }],
        usage: { prompt_tokens: 100, completion_tokens: 50, cost: 0 },
      }),
      { status: 200 }
    );
  }) as typeof fetch;
  const out = await translatePaperToArticle("Some paper text about sleep.", { sourceKind: "abstract" });
  assert.equal(out.llm?.provider, "openrouter");
  assert.equal(out.llm?.model, "meta/llama-x:free");
  assert.equal(out.llm?.prompt_tokens, 100);
  assert.equal(out.llm?.cost_microusd, 0);
});
