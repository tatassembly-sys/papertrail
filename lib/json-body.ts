import { NextRequest, NextResponse } from "next/server";

export const JSON_LIMIT_AUTH = 8 * 1024;
export const JSON_LIMIT_DEFAULT = 32 * 1024;
export const JSON_LIMIT_ARTICLE = 256 * 1024;

/**
 * Parse a JSON body with an explicit size cap. Content-Length is enforced
 * first; the raw text length is checked again after read.
 */
export async function readJsonBody(
  req: NextRequest,
  maxBytes = JSON_LIMIT_DEFAULT
): Promise<{ ok: true; value: unknown } | { ok: false; response: NextResponse }> {
  const lenHeader = req.headers.get("content-length");
  const declared = lenHeader ? Number(lenHeader) : NaN;
  if (Number.isFinite(declared) && declared > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Payload too large." }, { status: 413 }),
    };
  }

  const contentType = req.headers.get("content-type") || "";
  if (contentType && !contentType.toLowerCase().includes("application/json")) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }),
    };
  }

  let text: string;
  try {
    text = await req.text();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }),
    };
  }

  if (text.length > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Payload too large." }, { status: 413 }),
    };
  }

  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }),
    };
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
