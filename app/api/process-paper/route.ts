import { NextRequest, NextResponse } from "next/server";
import { extractPaperText } from "@/lib/paper-extract";
import { translatePaperToArticle } from "@/lib/openrouter";
import { requireAdmin } from "@/lib/auth-server";
import { insertDraftArticle } from "@/lib/articles";
import type { TranslatedArticle } from "@/lib/prompts";
import { publicErrorMessage } from "@/lib/safe-error";
import { sanitizeHttpUrl } from "@/lib/http-url";
import { JSON_LIMIT_ARTICLE, asRecord, readJsonBody } from "@/lib/json-body";

export const runtime = "nodejs"; // required for PDF parsing (unpdf), the mongo driver, and larger fetches
export const maxDuration = 60; // allow time for PDF download + LLM call

const MIN_TEXT_LENGTH = 200;
const MAX_RAW_TEXT_LENGTH = 20000; // guard against pasting something absurd

export async function POST(req: NextRequest) {
  try {
    // This route triggers a paid LLM call and (for URL submissions) a PDF
    // download — never leave it open to unauthenticated callers, even though
    // middleware also guards the /admin UI that links here. Defense in depth:
    // the route checks itself.
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await readJsonBody(req, JSON_LIMIT_ARTICLE);
    if (!parsed.ok) return parsed.response;
    const body = asRecord(parsed.value);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
    const url: string | undefined = rawUrl
      ? sanitizeHttpUrl(rawUrl) ||
        (/(\d{4}\.\d{4,5})(v\d+)?/.test(rawUrl) && rawUrl.length <= 200 ? rawUrl : undefined)
      : undefined;
    const rawText: string | undefined =
      typeof body.rawText === "string" ? body.rawText.trim() : undefined;
    const sourceUrl: string | undefined =
      typeof body.sourceUrl === "string" ? sanitizeHttpUrl(body.sourceUrl) || undefined : undefined;

    if (!url && !rawText) {
      return NextResponse.json(
        { error: "Provide either a 'url' or 'rawText' field." },
        { status: 400 }
      );
    }

    let article: TranslatedArticle;
    let finalSourceUrl: string;
    let fallbackTitle: string;
    let category: string | null = null;
    let authors: string[] = [];
    let institutions: string[] = [];
    let sourceKind: "arxiv" | "pubmed" | "manual" = "manual";

    if (url) {
      // URL path: currently optimized for arXiv (abstract API + PDF text).
      const extracted = await extractPaperText(url);

      if (!extracted.text || extracted.text.length < MIN_TEXT_LENGTH) {
        return NextResponse.json(
          { error: "Could not extract enough text from the provided paper." },
          { status: 422 }
        );
      }

      article = await translatePaperToArticle(extracted.text, {
        fallbackTitle: extracted.title,
      });
      finalSourceUrl = extracted.sourceUrl;
      fallbackTitle = extracted.title;
      category = extracted.category;
      authors = extracted.authors || [];
      institutions = extracted.institutions || [];
      sourceKind = "arxiv";
    } else {
      // Raw-text path: for non-arXiv or paywalled sources where automatic
      // extraction isn't reliable. The person pastes the abstract/text
      // directly, but a source URL is still required — every article on
      // this site links back to its original paper, no exceptions.
      if (!rawText || rawText.length < MIN_TEXT_LENGTH) {
        return NextResponse.json(
          { error: `Pasted text must be at least ${MIN_TEXT_LENGTH} characters.` },
          { status: 400 }
        );
      }

      if (!sourceUrl) {
        return NextResponse.json(
          { error: "A source URL is required so the article can link back to the original paper." },
          { status: 400 }
        );
      }

      const trimmedText =
        rawText.length > MAX_RAW_TEXT_LENGTH ? rawText.slice(0, MAX_RAW_TEXT_LENGTH) : rawText;

      article = await translatePaperToArticle(trimmedText, {
        fallbackTitle: "Untitled submission",
      });
      finalSourceUrl = sourceUrl;
      fallbackTitle = "Untitled submission";
      if (sourceUrl.includes("pubmed")) sourceKind = "pubmed";
      else if (sourceUrl.includes("arxiv")) sourceKind = "arxiv";
    }

    const data = await insertDraftArticle(article, finalSourceUrl, fallbackTitle, category, {
      source: sourceKind,
      authors,
      institutions,
    });
    return NextResponse.json({ success: true, article: data }, { status: 201 });
  } catch (err) {
    console.error("process-paper error:", err);
    return NextResponse.json(
      { error: publicErrorMessage(err, "Could not process that paper. Try again.") },
      { status: 500 }
    );
  }
}
