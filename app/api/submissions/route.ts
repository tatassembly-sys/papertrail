import { NextRequest, NextResponse } from "next/server";
import { createSubmission, getSubmissions, hasPendingSubmission, isRateLimited } from "@/lib/submissions";
import { requireAdmin } from "@/lib/auth-server";
import { getClientIp, hashIp } from "@/lib/request-ip";
import { JSON_LIMIT_DEFAULT, asRecord, readJsonBody } from "@/lib/json-body";

export const runtime = "nodejs";

const MAX_NOTE_LENGTH = 500;
const MAX_URL_LENGTH = 500;

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = req.nextUrl.searchParams.get("status");
  const validStatus = status === "pending" || status === "processed" || status === "dismissed" ? status : undefined;
  const submissions = await getSubmissions(validStatus);
  return NextResponse.json({ submissions });
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await readJsonBody(req, JSON_LIMIT_DEFAULT);
    if (!parsed.ok) return parsed.response;
    const body = asRecord(parsed.value);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const url: string | undefined = typeof body.url === "string" ? body.url.trim() : undefined;
    const note: string | undefined =
      typeof body.note === "string" ? body.note.trim().slice(0, MAX_NOTE_LENGTH) : undefined;

    // Honeypot: a hidden field real visitors never fill in. If it's set,
    // silently pretend success rather than telling a bot what tripped it.
    if (typeof body.website === "string" && body.website.length > 0) {
      return NextResponse.json({ success: true }, { status: 201 });
    }

    if (!url || !isValidUrl(url) || url.length > MAX_URL_LENGTH) {
      return NextResponse.json({ error: "Please provide a valid URL." }, { status: 400 });
    }

    const ipHash = hashIp(getClientIp(req));

    if (await isRateLimited(ipHash)) {
      return NextResponse.json(
        { error: "You've hit the submission limit for now — please try again later." },
        { status: 429 }
      );
    }

    if (await hasPendingSubmission(url)) {
      return NextResponse.json({
        success: true,
        note: "That link is already awaiting review — thanks for the suggestion!",
      });
    }

    await createSubmission(url, note, ipHash);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("submission error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
