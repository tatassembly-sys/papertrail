import type { TranslatedArticle } from "./prompts";

/**
 * Build a reviewable draft from extracted paper text when no LLM is available.
 * Admin still has to publish. Caveats mark this as a source-text filing.
 */
export function draftFromExtract(
  paperText: string,
  fallbackTitle?: string
): TranslatedArticle {
  const lines = paperText
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const rawTitle =
    fallbackTitle?.trim() ||
    lines.find((line) => line.length > 12 && line.length < 220) ||
    "Untitled paper";

  const body = lines.join(" ");
  const sentences = splitSentences(body).filter((s) => s.length > 40);
  const usable = sentences.length ? sentences : [body.slice(0, 280)];

  const headline = clip(usable[0], 240);
  const why = usable.slice(1, 4).map((s) => clip(s, 220));
  while (why.length < 3) {
    why.push("See the original paper for methods, sample, and limits.");
  }

  const explanation = usable.slice(0, 14).join(" ");

  return {
    title: clip(simplifyTitle(rawTitle), 160),
    headline,
    why_it_matters: why.slice(0, 3),
    plain_explanation: clip(explanation, 4000),
    caveats:
      "This draft was filed from the paper’s own abstract and extracted text because the AI translator was unavailable. It is not a rewritten plain-language note. Check sample size, setting (human vs model vs animal), and what the authors say they cannot claim before publishing.",
    keywords: [],
    tags: ["source-text", "needs-review"],
  };
}

/** Pick sentences from the filed article that best match the question. */
export function answerFromArticle(
  fields: {
    title: string;
    headline: string;
    why_it_matters: string[];
    plain_explanation: string;
    caveats: string;
  },
  question: string
): string {
  const q = question.toLowerCase();
  const wantsLimits = /limit|caveat|cannot|can't|weak|sample|bias/.test(q);
  const wantsWhy = /why|matter|impact|useful|practical|application/.test(q);
  const wantsSimple = /simple|explain|eli5|plain|summary|what is|what's/.test(q);

  if (wantsLimits && fields.caveats.trim()) {
    return withOfflineNote(fields.caveats);
  }
  if (wantsWhy && fields.why_it_matters.length) {
    return withOfflineNote(fields.why_it_matters.map((p, i) => `${i + 1}. ${p}`).join("\n"));
  }
  if (wantsSimple) {
    return withOfflineNote(`${fields.headline}\n\n${clip(fields.plain_explanation, 900)}`);
  }

  const pool = [
    fields.headline,
    ...fields.why_it_matters,
    ...splitSentences(fields.plain_explanation),
    fields.caveats,
  ].filter((s) => s && s.trim().length > 20);

  const terms = q.split(/[^a-z0-9]+/).filter((t) => t.length > 3);
  const scored = pool
    .map((sentence) => {
      const lower = sentence.toLowerCase();
      const score = terms.reduce((n, term) => n + (lower.includes(term) ? 1 : 0), 0);
      return { sentence, score };
    })
    .sort((a, b) => b.score - a.score);

  const picked = (scored[0]?.score ? scored.slice(0, 3) : scored.slice(0, 2)).map(
    (s) => s.sentence
  );
  return withOfflineNote(picked.join("\n\n") || fields.headline);
}

function withOfflineNote(body: string): string {
  return `${body.trim()}\n\n— Answered from this filing’s text (AI translator offline).`;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function clip(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function simplifyTitle(title: string): string {
  return title
    .replace(/^title:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
